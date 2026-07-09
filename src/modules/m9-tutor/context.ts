import "server-only";
import { prisma } from "@/lib/db";

/**
 * Monta o contexto do tutor (PRD M9): plano de ensino, bibliografia,
 * conteúdo aula a aula, materiais, atividades publicadas e as correções
 * LIBERADAS do PRÓPRIO aluno. Regras inegociáveis:
 *  - só indexa material PUBLISHED/RELEASED;
 *  - correções são escopadas ao aluno logado (nunca de outros alunos).
 * Cada bloco carrega um rótulo de fonte para citação.
 */
export async function buildTutorContext(disciplineId: string, studentId: string) {
  const [discipline, plan, lessons, activities, submissions] = await Promise.all([
    prisma.discipline.findUnique({ where: { id: disciplineId } }),
    prisma.teachingPlan.findUnique({
      where: { disciplineId },
      include: {
        programUnits: { orderBy: { order: "asc" } },
        learningObjectives: { orderBy: { order: "asc" } },
        bibliography: { orderBy: { order: "asc" } },
      },
    }),
    prisma.lesson.findMany({
      where: { lessonPlan: { teachingPlan: { disciplineId } } },
      orderBy: { number: "asc" },
      include: {
        content: true,
        slideDeck: true,
        materials: { where: { status: "PUBLISHED" } },
      },
    }),
    prisma.activity.findMany({
      where: { disciplineId, status: "PUBLISHED" },
      orderBy: { dueAt: "asc" },
    }),
    prisma.submission.findMany({
      where: { studentId, status: "RELEASED", exam: { disciplineId } },
      include: {
        feedback: true,
        answers: true,
        criterionScores: { include: { criterion: true } },
        exam: {
          include: { questions: { orderBy: { order: "asc" }, include: { question: true } } },
        },
      },
    }),
  ]);

  const blocks: string[] = [];

  if (discipline && plan) {
    blocks.push(
      `[Fonte: Plano de Ensino]
Disciplina: ${discipline.name} (${discipline.course}, ${discipline.term}, ${discipline.workloadHours}h)
Ementa: ${plan.ementa}
Objetivos gerais: ${plan.objetivosGerais}
Critérios de avaliação (pesos): ${plan.criteriosAvaliacao}
Unidades: ${plan.programUnits.map((u) => u.title).join("; ")}`,
    );
    if (plan.bibliography.length > 0) {
      blocks.push(
        `[Fonte: Bibliografia]
${plan.bibliography.map((b) => b.abntFormatted ?? b.title).join("\n")}`,
      );
    }
  }

  // Calendário/logística.
  const lessonList = lessons
    .map(
      (l) =>
        `Aula ${l.number} (${l.date?.toISOString().slice(0, 10) ?? "sem data"}): ${l.theme}${l.isAssessment ? " [AVALIAÇÃO]" : ""}`,
    )
    .join("\n");
  if (lessonList) blocks.push(`[Fonte: Calendário de aulas]\n${lessonList}`);

  if (activities.length > 0) {
    blocks.push(
      `[Fonte: Atividades e prazos]
${activities
  .map(
    (a) =>
      `${a.title} — início ${a.startsAt?.toLocaleString("pt-BR") ?? "—"}, entrega ${a.dueAt?.toLocaleString("pt-BR") ?? "—"}, ${a.maxAttempts} tentativa(s)`,
  )
  .join("\n")}`,
    );
  }

  // Conteúdo publicado por aula (limitado por bloco para caber no contexto).
  for (const l of lessons) {
    if (l.content?.status === "PUBLISHED" && l.content.markdown) {
      blocks.push(
        `[Fonte: Aula ${l.number} — texto]\n${l.content.markdown.slice(0, 4000)}`,
      );
    }
    if (l.slideDeck?.status === "PUBLISHED" && l.slideDeck.data) {
      const slides = (l.slideDeck.data as { slides?: { title: string; bullets: string[] }[] })
        .slides;
      if (slides?.length) {
        blocks.push(
          `[Fonte: Aula ${l.number} — slides]\n${slides
            .map((s) => `${s.title}: ${s.bullets.join(" | ")}`)
            .join("\n")
            .slice(0, 2000)}`,
        );
      }
    }
    for (const m of l.materials) {
      if (m.extractedText) {
        blocks.push(`[Fonte: Aula ${l.number} — material "${m.name}"]\n${m.extractedText.slice(0, 3000)}`);
      }
    }
  }

  // Correções liberadas do próprio aluno.
  for (const s of submissions) {
    const detail = s.exam.questions
      .map((eq, i) => {
        const ans = s.answers.find((a) => a.questionId === eq.questionId);
        return `Q${i + 1} (${eq.points} pts): obteve ${ans?.finalPoints ?? 0}. ${ans?.finalFeedback ?? ""}`;
      })
      .join("\n");
    const criteria = s.criterionScores
      .map(
        (cs) =>
          `${cs.criterion.criterion}: ${cs.finalScore ?? 0}/${cs.criterion.points} — ${cs.finalJustification ?? cs.aiJustification ?? ""}`,
      )
      .join("\n");
    blocks.push(
      `[Fonte: Sua correção — ${s.exam.title}]
Nota final: ${s.finalTotal ?? "—"}/${s.exam.totalPoints}
${detail}
Critérios:
${criteria}
Feedback do professor: ${s.feedback?.finalText ?? ""}`,
    );
  }

  return {
    disciplineName: discipline?.name ?? "",
    socraticMode: discipline?.socraticMode ?? false,
    context: blocks.join("\n\n"),
  };
}
