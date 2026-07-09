"use server";

import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/**
 * Submete tentativa de quiz assíncrono/atividade (M5).
 * Objetivas: correção automática. Dissertativas: aguardam o professor.
 */
export async function submitAttemptAction(formData: FormData) {
  const student = await requireStudent();
  const activityId = String(formData.get("activityId"));

  const activity = await prisma.activity.findFirst({
    where: {
      id: activityId,
      status: "PUBLISHED",
      discipline: { enrollments: { some: { studentId: student.id } } },
    },
    include: { questions: { orderBy: { order: "asc" }, include: { question: true } } },
  });
  if (!activity) redirect("/aluno");

  const now = new Date();
  if (activity.startsAt && now < activity.startsAt) redirect(`/aluno/atividades/${activityId}`);
  if (activity.dueAt && now > activity.dueAt) redirect(`/aluno/atividades/${activityId}`);

  const previous = await prisma.activityAttempt.count({
    where: { activityId, studentId: student.id },
  });
  if (previous >= activity.maxAttempts) redirect(`/aluno/atividades/${activityId}`);

  let score = 0;
  const answers: {
    questionId: string;
    answer: string;
    isCorrect: boolean | null;
    points: number;
  }[] = [];

  for (const aq of activity.questions) {
    const raw = String(formData.get(`q_${aq.questionId}`) ?? "").trim();
    if (aq.question.type === "ESSAY") {
      answers.push({ questionId: aq.questionId, answer: raw, isCorrect: null, points: 0 });
    } else {
      const correct = raw !== "" && raw === aq.question.correctKey;
      const points = correct ? aq.points : 0;
      score += points;
      answers.push({ questionId: aq.questionId, answer: raw, isCorrect: correct, points });
    }
  }

  await prisma.activityAttempt.create({
    data: {
      activityId,
      studentId: student.id,
      attemptNumber: previous + 1,
      submittedAt: now,
      score,
      answers: { create: answers },
    },
  });
  redirect(`/aluno/atividades/${activityId}`);
}
