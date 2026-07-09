"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { extractSubmission, gradeSubmission, suggestStudentLink } from "@/modules/m7-grading/ai";

type ActionState = { error?: string; ok?: string } | null;

function isAiUnavailable(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key");
}

/**
 * Upload em lote de provas respondidas (scan/foto/arquivo) — PRD M7.
 * Cada arquivo vira uma Submission; OCR + vínculo sugerido rodam em seguida
 * (quando a IA está disponível). Assistentes podem fazer triagem.
 */
export async function uploadSubmissionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const { user } = await requireDisciplineAccess(disciplineId, "triage");
  const examId = String(formData.get("examId"));

  const exam = await prisma.exam.findFirst({
    where: { id: examId, disciplineId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam) return { error: "Prova não encontrada." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Selecione ao menos um arquivo." };

  const students = await prisma.student.findMany({
    where: { enrollments: { some: { disciplineId } } },
  });

  let ocrFailures = 0;
  for (const file of files) {
    if (file.size > 30 * 1024 * 1024) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await saveFile({
      institutionId: user.institutionId,
      kind: "submissions",
      originalName: file.name,
      data: buffer,
    });

    const submission = await prisma.submission.create({
      data: { examId, fileUrl: key, mimeType: file.type || "application/pdf" },
    });

    // OCR + sugestão de vínculo (best-effort; falha mantém PENDING_LINK p/ manual).
    try {
      const extraction = await extractSubmission({
        file: { data: buffer, mimeType: file.type || "application/pdf" },
        questionCount: exam.questions.length,
      });
      const suggestedId = suggestStudentLink(extraction.header, students);
      const ocrText = extraction.answers
        .map((a) => `Q${a.questionNumber}: ${a.answer}`)
        .join("\n");

      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          ocrHeader: extraction.header,
          ocrText,
          suggestedStudentId: suggestedId,
          linkState: suggestedId ? "SUGGESTED" : "UNLINKED",
          answers: {
            create: exam.questions.map((eq, idx) => ({
              questionId: eq.questionId,
              answer: extraction.answers.find((a) => a.questionNumber === idx + 1)?.answer ?? "",
            })),
          },
        },
      });
    } catch (e) {
      console.error("OCR falhou:", e);
      ocrFailures++;
      // Sem OCR: cria respostas vazias para preenchimento/correção manual.
      await prisma.submissionAnswer.createMany({
        data: exam.questions.map((eq) => ({
          submissionId: submission.id,
          questionId: eq.questionId,
          answer: "",
        })),
      });
    }
  }

  revalidatePath(`/professor/disciplinas/${disciplineId}/correcao`);
  return {
    ok: `${files.length} prova(s) recebida(s).${
      ocrFailures > 0
        ? ` OCR indisponível em ${ocrFailures} — faça o vínculo e a transcrição manualmente.`
        : ""
    }`,
  };
}

/** Confirma (ou define manualmente) o vínculo prova↔aluno. */
export async function confirmLinkAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "triage");
  const submissionId = String(formData.get("submissionId"));
  const studentId = String(formData.get("studentId"));
  if (!studentId) return;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, exam: { disciplineId } },
  });
  if (!submission || submission.status === "RELEASED") return;

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      studentId,
      linkState: "CONFIRMED",
      status: submission.status === "PENDING_LINK" ? "LINKED" : submission.status,
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/correcao`);
}

/** Correção automática por IA aplicando a rubrica (PRD M7). */
export async function runAiGradingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const { discipline } = await requireDisciplineAccess(disciplineId, "triage");
  const submissionId = String(formData.get("submissionId"));

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, exam: { disciplineId } },
    include: {
      answers: true,
      exam: {
        include: {
          questions: { orderBy: { order: "asc" }, include: { question: true } },
          rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });
  if (!submission) return { error: "Prova não encontrada." };
  if (submission.linkState !== "CONFIRMED") {
    return { error: "Confirme o vínculo com o aluno antes de corrigir." };
  }
  const rubric = submission.exam.rubric;
  if (!rubric || rubric.criteria.length === 0) {
    return { error: "A prova não tem rubrica — obrigatória para correção." };
  }

  // 1) Objetivas: correção instantânea contra o gabarito (determinística).
  const answerByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));
  const questionInputs = submission.exam.questions.map((eq, idx) => {
    const q = eq.question;
    const ans = answerByQuestion.get(eq.questionId);
    const raw = (ans?.answer ?? "").trim();
    let objectiveCorrect: boolean | null = null;
    if (q.type !== "ESSAY" && q.correctKey) {
      const letter = raw.replace(/[^A-Za-zVF]/g, "").toUpperCase().slice(0, 1);
      objectiveCorrect = letter === q.correctKey.toUpperCase();
    }
    return {
      number: idx + 1,
      type: q.type,
      statement: q.statement,
      answerKey: q.answerKey,
      correctKey: q.correctKey,
      points: eq.points,
      studentAnswer: raw,
      objectiveCorrect,
      questionId: eq.questionId,
      answerId: ans?.id,
    };
  });

  // 2) IA: discursivas + notas por critério + feedback.
  try {
    const grading = await gradeSubmission({
      disciplineName: discipline.name,
      examTitle: submission.exam.title,
      questions: questionInputs,
      criteria: rubric.criteria.map((c, i) => ({
        index: i,
        criterion: c.criterion,
        description: c.description,
        points: c.points,
        questionNumber: c.questionId
          ? submission.exam.questions.findIndex((eq) => eq.questionId === c.questionId) + 1
          : null,
      })),
    });

    // Persiste: nota por questão (objetivas determinísticas, discursivas da IA).
    for (const qi of questionInputs) {
      if (!qi.answerId) continue;
      let aiPoints = 0;
      let aiFeedback: string | null = null;
      if (qi.objectiveCorrect !== null) {
        aiPoints = qi.objectiveCorrect ? qi.points : 0;
      } else {
        const essay = grading.essayFeedback.find((e) => e.questionNumber === qi.number);
        aiPoints = Math.min(essay?.points ?? 0, qi.points);
        aiFeedback = essay?.feedback ?? null;
      }
      await prisma.submissionAnswer.update({
        where: { id: qi.answerId },
        data: { isCorrect: qi.objectiveCorrect, aiPoints, aiFeedback },
      });
    }

    // Notas por critério (limitadas ao máximo de cada critério).
    let aiTotal = 0;
    for (const cs of grading.criterionScores) {
      const criterion = rubric.criteria[cs.criterionIndex];
      if (!criterion) continue;
      const score = Math.max(0, Math.min(cs.score, criterion.points));
      aiTotal += score;
      await prisma.criterionScore.upsert({
        where: {
          submissionId_criterionId: { submissionId, criterionId: criterion.id },
        },
        update: { aiScore: score, aiJustification: cs.justification },
        create: {
          submissionId,
          criterionId: criterion.id,
          aiScore: score,
          aiJustification: cs.justification,
        },
      });
    }

    await prisma.feedback.upsert({
      where: { submissionId },
      update: { aiText: grading.overallFeedback, reviewState: "PENDING_REVIEW" },
      create: { submissionId, aiText: grading.overallFeedback, reviewState: "PENDING_REVIEW" },
    });
    await prisma.submission.update({
      where: { id: submissionId },
      data: { aiTotal, status: "AI_GRADED" },
    });
  } catch (e) {
    console.error(e);
    if (isAiUnavailable(e)) {
      return { error: "IA indisponível: configure ANTHROPIC_API_KEY. Corrija manualmente abaixo." };
    }
    return { error: `Falha na correção: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}` };
  }

  revalidatePath(`/professor/disciplinas/${disciplineId}/correcao/${submissionId}`);
  return { ok: "Correção sugerida pela IA. Revise e valide para liberar ao aluno." };
}

/**
 * GATE DE VALIDAÇÃO (PRD M7, inegociável): o professor aprova/ajusta nota e
 * feedback. Nada chega ao aluno sem esta ação. Registra trilha de auditoria.
 */
export async function validateSubmissionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { user } = await requireDisciplineAccess(disciplineId, "validate"); // só PROFESSOR
  const submissionId = String(formData.get("submissionId"));
  const release = formData.get("release") === "on";

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, exam: { disciplineId } },
    include: {
      criterionScores: { include: { criterion: true } },
      answers: true,
      feedback: true,
      exam: { include: { rubric: { include: { criteria: true } } } },
    },
  });
  if (!submission || !submission.studentId) return;

  // Notas finais por critério (campo editável; default = sugestão da IA).
  let finalTotal = 0;
  for (const criterion of submission.exam.rubric?.criteria ?? []) {
    const existing = submission.criterionScores.find((cs) => cs.criterionId === criterion.id);
    const raw = formData.get(`crit_${criterion.id}`);
    const score = Math.max(
      0,
      Math.min(raw !== null && raw !== "" ? Number(raw) : (existing?.aiScore ?? 0), criterion.points),
    );
    finalTotal += score;
    await prisma.criterionScore.upsert({
      where: { submissionId_criterionId: { submissionId, criterionId: criterion.id } },
      update: {
        finalScore: score,
        finalJustification:
          String(formData.get(`critj_${criterion.id}`) ?? "") || existing?.aiJustification || null,
      },
      create: {
        submissionId,
        criterionId: criterion.id,
        finalScore: score,
        finalJustification: String(formData.get(`critj_${criterion.id}`) ?? "") || null,
      },
    });
  }

  // Notas finais por questão.
  for (const ans of submission.answers) {
    const raw = formData.get(`ansp_${ans.id}`);
    const finalPoints = raw !== null && raw !== "" ? Number(raw) : (ans.aiPoints ?? 0);
    const fb = String(formData.get(`ansf_${ans.id}`) ?? "");
    await prisma.submissionAnswer.update({
      where: { id: ans.id },
      data: { finalPoints, finalFeedback: fb || ans.aiFeedback },
    });
  }

  const finalText =
    String(formData.get("finalFeedback") ?? "") || submission.feedback?.aiText || "";
  await prisma.feedback.upsert({
    where: { submissionId },
    update: { finalText, reviewState: release ? "RELEASED" : "APPROVED" },
    create: { submissionId, finalText, reviewState: release ? "RELEASED" : "APPROVED" },
  });

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      finalTotal,
      status: release ? "RELEASED" : "VALIDATED",
      validatedById: user.id,
      validatedAt: new Date(),
      releasedAt: release ? new Date() : null,
    },
  });

  // Trilha de auditoria: o que a IA sugeriu vs. o que o professor aprovou.
  await prisma.auditEvent.create({
    data: {
      institutionId: user.institutionId,
      actorType: "USER",
      actorId: user.id,
      action: release ? "submission.validate_and_release" : "submission.validate",
      entity: "Submission",
      entityId: submissionId,
      data: { aiTotal: submission.aiTotal, finalTotal },
    },
  });

  revalidatePath(`/professor/disciplinas/${disciplineId}/correcao`);
}

/** Validação em lote: aprova as sugestões da IA como estão e libera. */
export async function batchValidateAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { user } = await requireDisciplineAccess(disciplineId, "validate");
  const examId = String(formData.get("examId"));

  const submissions = await prisma.submission.findMany({
    where: { examId, exam: { disciplineId }, status: "AI_GRADED", studentId: { not: null } },
    include: { criterionScores: true, answers: true, feedback: true },
  });

  for (const s of submissions) {
    let finalTotal = 0;
    for (const cs of s.criterionScores) {
      finalTotal += cs.aiScore ?? 0;
      await prisma.criterionScore.update({
        where: { id: cs.id },
        data: { finalScore: cs.aiScore, finalJustification: cs.aiJustification },
      });
    }
    for (const ans of s.answers) {
      await prisma.submissionAnswer.update({
        where: { id: ans.id },
        data: { finalPoints: ans.aiPoints ?? 0, finalFeedback: ans.aiFeedback },
      });
    }
    await prisma.feedback.upsert({
      where: { submissionId: s.id },
      update: { finalText: s.feedback?.aiText ?? "", reviewState: "RELEASED" },
      create: { submissionId: s.id, finalText: s.feedback?.aiText ?? "", reviewState: "RELEASED" },
    });
    await prisma.submission.update({
      where: { id: s.id },
      data: {
        finalTotal,
        status: "RELEASED",
        validatedById: user.id,
        validatedAt: new Date(),
        releasedAt: new Date(),
      },
    });
    await prisma.auditEvent.create({
      data: {
        institutionId: user.institutionId,
        actorType: "USER",
        actorId: user.id,
        action: "submission.batch_validate_and_release",
        entity: "Submission",
        entityId: s.id,
        data: { aiTotal: s.aiTotal, finalTotal },
      },
    });
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/correcao`);
}

/** Transcrição manual de resposta (fallback quando OCR indisponível/ilegível). */
export async function updateAnswerTextAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "triage");
  const answerId = String(formData.get("answerId"));
  const answer = await prisma.submissionAnswer.findFirst({
    where: { id: answerId, submission: { exam: { disciplineId }, status: { not: "RELEASED" } } },
  });
  if (!answer) return;
  await prisma.submissionAnswer.update({
    where: { id: answerId },
    data: { answer: String(formData.get("answer") ?? "") },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/correcao/${answer.submissionId}`);
}
