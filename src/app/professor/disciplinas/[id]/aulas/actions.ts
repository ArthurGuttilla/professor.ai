"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  generateLessonPlan,
  mergeWithNext,
  moveLesson,
  splitLesson,
} from "@/modules/m3-lesson-plan/service";

type ActionState = { error?: string } | null;

export async function generateLessonPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");

  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  const weekdays = formData.getAll("weekdays").map(Number);
  const holidays = String(formData.get("holidays") ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new Date(s));
  const assessmentCount = Number(formData.get("assessmentCount") ?? 2);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
    return { error: "Datas de início/fim inválidas." };
  }
  if (weekdays.length === 0) return { error: "Selecione ao menos um dia da semana." };
  if (holidays.some((h) => isNaN(h.getTime()))) {
    return { error: "Feriado com formato inválido (use AAAA-MM-DD, um por linha)." };
  }

  try {
    await generateLessonPlan({
      disciplineId,
      startDate,
      endDate,
      weekdays,
      holidays,
      assessmentCount,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")) {
      return { error: "IA indisponível: configure ANTHROPIC_API_KEY no ambiente." };
    }
    return { error: msg.slice(0, 300) };
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas`);
  return null;
}

async function lessonPlanIdOf(disciplineId: string): Promise<string | null> {
  const lp = await prisma.lessonPlan.findFirst({
    where: { teachingPlan: { disciplineId } },
  });
  return lp?.id ?? null;
}

export async function moveLessonAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  const lpId = await lessonPlanIdOf(disciplineId);
  if (!lpId) return;
  await moveLesson(
    lpId,
    String(formData.get("lessonId")),
    String(formData.get("dir")) === "up" ? -1 : 1,
  );
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas`);
}

export async function mergeLessonAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  const lpId = await lessonPlanIdOf(disciplineId);
  if (!lpId) return;
  await mergeWithNext(lpId, String(formData.get("lessonId")));
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas`);
}

export async function splitLessonAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  const lpId = await lessonPlanIdOf(disciplineId);
  if (!lpId) return;
  await splitLesson(lpId, String(formData.get("lessonId")));
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas`);
}

export async function updateLessonAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  await prisma.lesson.updateMany({
    where: {
      id: String(formData.get("lessonId")),
      lessonPlan: { teachingPlan: { disciplineId } },
    },
    data: {
      theme: String(formData.get("theme") ?? ""),
      objectives: String(formData.get("objectives") ?? ""),
      isAssessment: formData.get("isAssessment") === "on",
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas`);
}
