"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { generateQuestions } from "@/modules/m5-activities/ai";

type ActionState = { error?: string; ok?: string } | null;

/** Geração por IA baseada nos materiais da aula/disciplina (PRD M5). */
export async function generateQuestionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const { discipline } = await requireDisciplineAccess(disciplineId, "draft");

  const lessonId = String(formData.get("lessonId") || "");
  const count = Math.min(Number(formData.get("count") ?? 5), 15);
  const types = formData.getAll("types").map(String) as (
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "ESSAY"
  )[];
  if (types.length === 0) return { error: "Selecione ao menos um tipo de questão." };

  // Material-fonte: conteúdo markdown + textos extraídos dos anexos.
  let sourceMaterial = "";
  let sourceLessonId: string | null = null;
  let unitId: string | null = null;
  if (lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, lessonPlan: { teachingPlan: { disciplineId } } },
      include: { content: true, materials: true, unitLinks: true },
    });
    if (!lesson) return { error: "Aula não encontrada." };
    sourceLessonId = lesson.id;
    unitId = lesson.unitLinks[0]?.programUnitId ?? null;
    sourceMaterial = [
      `Aula ${lesson.number}: ${lesson.theme}\n${lesson.objectives}`,
      lesson.content?.markdown ?? "",
      ...lesson.materials.map((m) => m.extractedText ?? ""),
    ]
      .filter(Boolean)
      .join("\n---\n");
  } else {
    const plan = await prisma.teachingPlan.findUnique({
      where: { disciplineId },
      include: { programUnits: { orderBy: { order: "asc" } } },
    });
    if (!plan) return { error: "Crie o plano de ensino primeiro." };
    sourceMaterial = [
      `Ementa: ${plan.ementa}`,
      ...plan.programUnits.map((u) => `${u.title}: ${u.content}`),
    ].join("\n");
  }
  if (sourceMaterial.trim().length < 30) {
    return { error: "Sem material suficiente. Gere o conteúdo da aula primeiro." };
  }

  try {
    const generated = await generateQuestions({
      disciplineName: discipline.name,
      count,
      types,
      sourceMaterial,
      theme: String(formData.get("theme") || "") || undefined,
    });
    await prisma.question.createMany({
      data: generated.map((q) => ({
        disciplineId,
        type: q.type,
        difficulty: q.difficulty,
        source: "AI" as const,
        baseText: q.baseText ?? null,
        statement: q.statement,
        options: q.options ?? undefined,
        correctKey: q.correctKey ?? null,
        answerKey: q.answerKey ?? null,
        theme: q.theme,
        lessonId: sourceLessonId,
        unitId,
        reviewedAt: null, // exige revisão do professor antes de uso
      })),
    });
    revalidatePath(`/professor/disciplinas/${disciplineId}/questoes`);
    return { ok: `${generated.length} questão(ões) gerada(s) — revise antes de usar.` };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")) {
      return { error: "IA indisponível: configure ANTHROPIC_API_KEY no ambiente." };
    }
    return { error: `Falha na geração: ${msg.slice(0, 300)}` };
  }
}

export async function createManualQuestionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");

  const type = String(formData.get("type")) as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "ESSAY";
  let options: { key: string; text: string }[] | undefined;
  let correctKey: string | null = null;

  if (type === "MULTIPLE_CHOICE") {
    options = ["A", "B", "C", "D", "E"]
      .map((key) => ({ key, text: String(formData.get(`option${key}`) ?? "").trim() }))
      .filter((o) => o.text);
    correctKey = String(formData.get("correctKey") || "A");
  } else if (type === "TRUE_FALSE") {
    options = [
      { key: "V", text: "Verdadeiro" },
      { key: "F", text: "Falso" },
    ];
    correctKey = String(formData.get("correctKey") || "V");
  }

  await prisma.question.create({
    data: {
      disciplineId,
      type,
      difficulty: String(formData.get("difficulty") || "MEDIUM") as "EASY" | "MEDIUM" | "HARD",
      source: "MANUAL",
      baseText: String(formData.get("baseText") || "") || null,
      statement: String(formData.get("statement") ?? ""),
      options: options ?? undefined,
      correctKey,
      answerKey: String(formData.get("answerKey") || "") || null,
      theme: String(formData.get("theme") || "") || null,
      reviewedAt: new Date(), // questão manual já nasce revisada
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/questoes`);
}

/** Revisão do professor: aprova questão gerada por IA para uso. */
export async function reviewQuestionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  await prisma.question.updateMany({
    where: { id: String(formData.get("questionId")), disciplineId },
    data: { reviewedAt: new Date() },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/questoes`);
}

export async function deleteQuestionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const questionId = String(formData.get("questionId"));
  const used = await prisma.question.findFirst({
    where: {
      id: questionId,
      disciplineId,
      OR: [{ activityLinks: { some: {} } }, { examLinks: { some: {} } }],
    },
  });
  if (used) return; // não remove questão em uso
  await prisma.question.deleteMany({ where: { id: questionId, disciplineId } });
  revalidatePath(`/professor/disciplinas/${disciplineId}/questoes`);
}
