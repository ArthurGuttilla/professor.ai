"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { createRoom, getRoom } from "@/modules/m5-activities/live-store";

function joinCode() {
  // Código curto legível para entrar na sala.
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function createActivityAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");

  const kind = String(formData.get("kind")) as "QUIZ_LIVE" | "QUIZ_ASYNC" | "ACTIVITY";
  const activity = await prisma.activity.create({
    data: {
      disciplineId,
      lessonId: String(formData.get("lessonId") || "") || null,
      kind,
      title: String(formData.get("title") ?? "Nova atividade"),
      timePerQuestionSec: Number(formData.get("timePerQuestionSec") ?? 30),
      maxAttempts: Number(formData.get("maxAttempts") ?? 1),
      startsAt: formData.get("startsAt") ? new Date(String(formData.get("startsAt"))) : null,
      dueAt: formData.get("dueAt") ? new Date(String(formData.get("dueAt"))) : null,
      joinCode: kind === "QUIZ_LIVE" ? joinCode() : null,
    },
  });
  redirect(`/professor/disciplinas/${disciplineId}/atividades/${activity.id}`);
}

export async function updateActivityAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const activityId = String(formData.get("activityId"));

  await prisma.activity.updateMany({
    where: { id: activityId, disciplineId },
    data: {
      title: String(formData.get("title") ?? ""),
      timePerQuestionSec: Number(formData.get("timePerQuestionSec") ?? 30),
      maxAttempts: Number(formData.get("maxAttempts") ?? 1),
      startsAt: formData.get("startsAt") ? new Date(String(formData.get("startsAt"))) : null,
      dueAt: formData.get("dueAt") ? new Date(String(formData.get("dueAt"))) : null,
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/atividades/${activityId}`);
}

export async function addQuestionToActivityAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const activityId = String(formData.get("activityId"));
  const questionId = String(formData.get("questionId"));

  const [activity, question, count] = await Promise.all([
    prisma.activity.findFirst({ where: { id: activityId, disciplineId } }),
    prisma.question.findFirst({ where: { id: questionId, disciplineId } }),
    prisma.activityQuestion.count({ where: { activityId } }),
  ]);
  if (!activity || !question) return;
  // Questões de IA precisam de revisão antes de uso (PRD M5).
  if (!question.reviewedAt) return;

  await prisma.activityQuestion.upsert({
    where: { activityId_questionId: { activityId, questionId } },
    update: {},
    create: { activityId, questionId, order: count + 1, points: 1 },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/atividades/${activityId}`);
}

export async function removeQuestionFromActivityAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const activityId = String(formData.get("activityId"));
  await prisma.activityQuestion.deleteMany({
    where: { activityId, questionId: String(formData.get("questionId")), activity: { disciplineId } },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/atividades/${activityId}`);
}

/** Publicação exige papel PROFESSOR e valida requisitos P0 (datas do assíncrono). */
export async function toggleActivityPublishAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "publish");
  const activityId = String(formData.get("activityId"));

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, disciplineId },
    include: { _count: { select: { questions: true } } },
  });
  if (!activity) return;

  if (activity.status === "DRAFT") {
    if (activity._count.questions === 0) return;
    // PRD M5: atividade assíncrona tem início e entrega OBRIGATÓRIOS.
    if (activity.kind !== "QUIZ_LIVE" && (!activity.startsAt || !activity.dueAt)) return;
  }

  await prisma.activity.update({
    where: { id: activity.id },
    data: { status: activity.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/atividades/${activityId}`);
}

export async function deleteActivityAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  await prisma.activity.deleteMany({
    where: { id: String(formData.get("activityId")), disciplineId, status: "DRAFT" },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/atividades`);
}

/** Atribui pontos a resposta dissertativa de tentativa (correção manual do professor). */
export async function gradeEssayAnswerAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "validate");
  const answerId = String(formData.get("answerId"));
  const points = Number(formData.get("points") ?? 0);

  const answer = await prisma.attemptAnswer.findFirst({
    where: { id: answerId, attempt: { activity: { disciplineId } } },
    include: { attempt: true },
  });
  if (!answer) return;

  const delta = points - answer.points;
  await prisma.$transaction([
    prisma.attemptAnswer.update({
      where: { id: answerId },
      data: { points, isCorrect: points > 0 },
    }),
    prisma.activityAttempt.update({
      where: { id: answer.attemptId },
      data: { score: { increment: delta } },
    }),
  ]);
  revalidatePath(`/professor/disciplinas/${disciplineId}/atividades/${answer.attempt.activityId}`);
}

// ── Controle da sala ao vivo (host = professor/assistente) ────────

async function liveQuestionsOf(activityId: string) {
  const links = await prisma.activityQuestion.findMany({
    where: { activityId },
    orderBy: { order: "asc" },
    include: { question: true },
  });
  return links
    .filter((l) => l.question.type !== "ESSAY")
    .map((l) => ({
      id: l.questionId,
      statement: l.question.statement,
      baseText: l.question.baseText,
      options: ((l.question.options as { key: string; text: string }[] | null) ?? []).map((o) => ({
        key: o.key,
        text: o.text,
      })),
      correctKey: l.question.correctKey,
      weight: l.points,
    }));
}

export async function openLiveRoomAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const activityId = String(formData.get("activityId"));

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, disciplineId, kind: "QUIZ_LIVE" },
  });
  if (!activity?.joinCode) return;

  if (!getRoom(activity.joinCode)) {
    const questions = await liveQuestionsOf(activityId);
    if (questions.length === 0) return;
    createRoom(activity.joinCode, {
      activityId,
      disciplineId,
      timePerQuestionSec: activity.timePerQuestionSec,
      questions,
    });
  }
  redirect(`/professor/disciplinas/${disciplineId}/atividades/${activityId}/host`);
}
