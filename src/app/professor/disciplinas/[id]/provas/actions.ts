"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { generateExam } from "@/modules/m6-exams/ai";

type ActionState = { error?: string } | null;

/** Monta o material-fonte conforme o escopo (disciplina inteira ou unidades). */
async function scopeMaterial(disciplineId: string, unitIds: string[]) {
  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: {
      programUnits: {
        where: unitIds.length ? { id: { in: unitIds } } : undefined,
        orderBy: { order: "asc" },
      },
    },
  });
  if (!plan) return null;

  const lessons = await prisma.lesson.findMany({
    where: {
      lessonPlan: { teachingPlanId: plan.id },
      ...(unitIds.length ? { unitLinks: { some: { programUnitId: { in: unitIds } } } } : {}),
    },
    include: { content: true, materials: true },
    orderBy: { number: "asc" },
  });

  return [
    `Ementa: ${plan.ementa}`,
    ...plan.programUnits.map((u) => `${u.title}: ${u.content}`),
    ...lessons.flatMap((l) => [
      l.content?.markdown ? `Aula ${l.number} (${l.theme}):\n${l.content.markdown}` : "",
      ...l.materials.map((m) => m.extractedText ?? ""),
    ]),
  ]
    .filter(Boolean)
    .join("\n---\n");
}

/** Cria prova gerada por IA (formato ENADE/tradicional/atividade) com rubrica. */
export async function generateExamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const { discipline } = await requireDisciplineAccess(disciplineId, "draft");

  const kind = String(formData.get("kind")) as
    | "ENADE_EXAM"
    | "TRADITIONAL_EXAM"
    | "GRADED_ACTIVITY";
  const title = String(formData.get("title") || "Prova");
  const unitIds = formData.getAll("unitIds").map(String);
  const mcCount = Math.min(Number(formData.get("mcCount") ?? 4), 12);
  const essayCount = Math.min(Number(formData.get("essayCount") ?? 1), 5);
  const totalPoints = Number(formData.get("totalPoints") ?? 10);

  const material = await scopeMaterial(disciplineId, unitIds);
  if (!material || material.trim().length < 30) {
    return { error: "Sem material no escopo. Crie o plano de ensino (e conteúdos) primeiro." };
  }

  let examId: string;
  try {
    const generated = await generateExam({
      disciplineName: discipline.name,
      kind,
      mcCount,
      essayCount,
      totalPoints,
      sourceMaterial: material,
    });

    const exam = await prisma.exam.create({
      data: {
        disciplineId,
        kind,
        title,
        scope: unitIds.length ? { unitIds } : undefined,
        totalPoints,
      },
    });
    examId = exam.id;

    const createdQuestions: { id: string }[] = [];
    for (const [i, q] of generated.questions.entries()) {
      const question = await prisma.question.create({
        data: {
          disciplineId,
          type: q.type,
          difficulty: q.difficulty,
          source: "AI",
          baseText: q.baseText,
          statement: q.statement,
          options: q.options ?? undefined,
          correctKey: q.correctKey ?? null,
          answerKey: q.answerKey ?? null,
          theme: q.theme,
          unitId: unitIds[0] ?? null,
          reviewedAt: null, // exige revisão do professor
        },
      });
      createdQuestions.push(question);
      await prisma.examQuestion.create({
        data: { examId: exam.id, questionId: question.id, order: i + 1, points: q.points },
      });
    }

    await prisma.rubric.create({
      data: {
        examId: exam.id,
        criteria: {
          create: generated.rubric.criteria.map((c, i) => ({
            criterion: c.criterion,
            description: c.description,
            points: c.points,
            order: i,
            questionId:
              c.questionIndex !== undefined ? (createdQuestions[c.questionIndex]?.id ?? null) : null,
          })),
        },
      },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")) {
      return { error: "IA indisponível: configure ANTHROPIC_API_KEY no ambiente." };
    }
    return { error: `Falha na geração: ${msg.slice(0, 300)}` };
  }
  redirect(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
}

/** Cria prova vazia para montagem manual (questões do banco). */
export async function createEmptyExamAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const exam = await prisma.exam.create({
    data: {
      disciplineId,
      kind: String(formData.get("kind") || "TRADITIONAL_EXAM") as
        | "ENADE_EXAM"
        | "TRADITIONAL_EXAM"
        | "GRADED_ACTIVITY",
      title: String(formData.get("title") || "Prova"),
      totalPoints: Number(formData.get("totalPoints") ?? 10),
      rubric: { create: {} },
    },
  });
  redirect(`/professor/disciplinas/${disciplineId}/provas/${exam.id}`);
}

export async function addQuestionToExamAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const examId = String(formData.get("examId"));
  const questionId = String(formData.get("questionId"));
  const question = await prisma.question.findFirst({ where: { id: questionId, disciplineId } });
  if (!question?.reviewedAt) return; // só questões revisadas
  const count = await prisma.examQuestion.count({ where: { examId } });
  await prisma.examQuestion.upsert({
    where: { examId_questionId: { examId, questionId } },
    update: {},
    create: { examId, questionId, order: count + 1, points: Number(formData.get("points") ?? 1) },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
}

export async function removeQuestionFromExamAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const examId = String(formData.get("examId"));
  await prisma.examQuestion.deleteMany({
    where: { examId, questionId: String(formData.get("questionId")), exam: { disciplineId } },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
}

export async function addCriterionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const examId = String(formData.get("examId"));
  const exam = await prisma.exam.findFirst({
    where: { id: examId, disciplineId },
    include: { rubric: { include: { criteria: true } } },
  });
  if (!exam) return;
  const rubric =
    exam.rubric ?? (await prisma.rubric.create({ data: { examId }, include: { criteria: true } }));
  await prisma.rubricCriterion.create({
    data: {
      rubricId: rubric.id,
      criterion: String(formData.get("criterion") ?? ""),
      description: String(formData.get("description") ?? ""),
      points: Number(formData.get("points") ?? 1),
      questionId: String(formData.get("questionId") || "") || null,
      order: exam.rubric?.criteria.length ?? 0,
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
}

export async function removeCriterionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const examId = String(formData.get("examId"));
  await prisma.rubricCriterion.deleteMany({
    where: { id: String(formData.get("criterionId")), rubric: { exam: { disciplineId } } },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
}

/** Aprova de uma vez todas as questões de IA da prova (revisão em lote). */
export async function reviewAllExamQuestionsAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const examId = String(formData.get("examId"));
  await prisma.question.updateMany({
    where: { disciplineId, examLinks: { some: { examId } }, reviewedAt: null },
    data: { reviewedAt: new Date() },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
}

/**
 * Publica a prova. Gate P0 (PRD M6): rubrica com ≥1 critério é OBRIGATÓRIA;
 * todas as questões precisam estar revisadas.
 */
export async function toggleExamPublishAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "publish");
  const examId = String(formData.get("examId"));

  const exam = await prisma.exam.findFirst({
    where: { id: examId, disciplineId },
    include: {
      rubric: { include: { criteria: true } },
      questions: { include: { question: true } },
    },
  });
  if (!exam) return { error: "Prova não encontrada." };

  if (exam.status === "DRAFT") {
    if (exam.questions.length === 0) return { error: "Adicione questões antes de publicar." };
    if (!exam.rubric || exam.rubric.criteria.length === 0) {
      return { error: "Rubrica obrigatória: adicione ao menos um critério antes de publicar." };
    }
    const unreviewed = exam.questions.filter((q) => !q.question.reviewedAt).length;
    if (unreviewed > 0) {
      return { error: `${unreviewed} questão(ões) de IA aguardando revisão. Aprove-as antes.` };
    }
  }

  await prisma.exam.update({
    where: { id: exam.id },
    data: { status: exam.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/provas/${examId}`);
  return null;
}

export async function deleteExamAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  await prisma.exam.deleteMany({
    where: { id: String(formData.get("examId")), disciplineId, status: "DRAFT" },
  });
  redirect(`/professor/disciplinas/${disciplineId}/provas`);
}
