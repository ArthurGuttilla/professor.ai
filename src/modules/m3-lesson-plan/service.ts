import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { assessmentSlots, generateLessonDates } from "./calendar";
import { distributeProgram } from "./ai";

const slug = () => crypto.randomBytes(6).toString("hex");

/**
 * Gera a grade aula a aula: calendário determinístico + reserva de avaliações
 * + distribuição do programa por IA (PRD M3, P0). Substitui a grade anterior.
 */
export async function generateLessonPlan(opts: {
  disciplineId: string;
  startDate: Date;
  endDate: Date;
  weekdays: number[];
  holidays: Date[];
  assessmentCount: number;
}) {
  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId: opts.disciplineId },
    include: { programUnits: { orderBy: { order: "asc" } } },
  });
  if (!plan) throw new Error("Crie o plano de ensino antes do aula a aula.");
  if (plan.programUnits.length === 0) throw new Error("O plano não tem unidades de conteúdo.");

  const dates = generateLessonDates(opts);
  if (dates.length === 0) throw new Error("O calendário não gerou nenhuma data de aula.");

  const evalSlots = new Set(assessmentSlots(dates.length, opts.assessmentCount));
  const teachableCount = dates.length - evalSlots.size;

  const distribution = await distributeProgram({
    disciplineName: "",
    units: plan.programUnits.map((u) => ({ title: u.title, content: u.content })),
    teachableCount,
  });

  // Recria o lesson plan (grade anterior é substituída).
  await prisma.lessonPlan.deleteMany({ where: { teachingPlanId: plan.id } });
  const lessonPlan = await prisma.lessonPlan.create({
    data: {
      teachingPlanId: plan.id,
      startDate: opts.startDate,
      endDate: opts.endDate,
      weekdays: opts.weekdays,
      holidays: opts.holidays,
    },
  });

  let t = 0; // cursor nas aulas letivas
  let evalN = 0;
  for (let i = 0; i < dates.length; i++) {
    const isAssessment = evalSlots.has(i);
    const payload = isAssessment ? null : distribution[t++];
    evalN += isAssessment ? 1 : 0;
    await prisma.lesson.create({
      data: {
        lessonPlanId: lessonPlan.id,
        number: i + 1,
        date: dates[i],
        theme: isAssessment ? `Avaliação ${evalN}` : (payload?.theme ?? "A definir"),
        objectives: isAssessment ? "Aplicação de avaliação." : (payload?.objectives ?? ""),
        isAssessment,
        qrSlug: slug(),
        unitLinks: payload
          ? {
              create: payload.unitIndexes
                .filter((idx) => idx >= 0 && idx < plan.programUnits.length)
                .map((idx) => ({ programUnitId: plan.programUnits[idx].id })),
            }
          : undefined,
      },
    });
  }

  return lessonPlan;
}

type LessonPayload = {
  theme: string;
  objectives: string;
  isAssessment: boolean;
  unitIds: string[];
};

async function getOrderedLessons(lessonPlanId: string) {
  return prisma.lesson.findMany({
    where: { lessonPlanId },
    orderBy: { number: "asc" },
    include: { unitLinks: true },
  });
}

async function writePayload(lessonId: string, payload: LessonPayload) {
  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      theme: payload.theme,
      objectives: payload.objectives,
      isAssessment: payload.isAssessment,
      unitLinks: {
        deleteMany: {},
        create: payload.unitIds.map((programUnitId) => ({ programUnitId })),
      },
    },
  });
}

function toPayload(l: Awaited<ReturnType<typeof getOrderedLessons>>[number]): LessonPayload {
  return {
    theme: l.theme,
    objectives: l.objectives,
    isAssessment: l.isAssessment,
    unitIds: l.unitLinks.map((u) => u.programUnitId),
  };
}

/**
 * Move o CONTEÚDO da aula (tema/objetivos/unidades) entre slots adjacentes.
 * Números e datas são fixos ao calendário — o que se move é o payload.
 */
export async function moveLesson(lessonPlanId: string, lessonId: string, dir: -1 | 1) {
  const lessons = await getOrderedLessons(lessonPlanId);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  const other = idx + dir;
  if (idx < 0 || other < 0 || other >= lessons.length) return;
  const a = toPayload(lessons[idx]);
  const b = toPayload(lessons[other]);
  await writePayload(lessons[idx].id, b);
  await writePayload(lessons[other].id, a);
}

/**
 * Mescla a aula com a seguinte: o slot recebe os dois temas; os payloads
 * seguintes sobem um slot; o último slot vira "Aula livre".
 */
export async function mergeWithNext(lessonPlanId: string, lessonId: string) {
  const lessons = await getOrderedLessons(lessonPlanId);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0 || idx >= lessons.length - 1) return;

  const merged: LessonPayload = {
    theme: `${lessons[idx].theme} + ${lessons[idx + 1].theme}`,
    objectives: [lessons[idx].objectives, lessons[idx + 1].objectives]
      .filter(Boolean)
      .join(" "),
    isAssessment: lessons[idx].isAssessment || lessons[idx + 1].isAssessment,
    unitIds: [
      ...new Set([
        ...lessons[idx].unitLinks.map((u) => u.programUnitId),
        ...lessons[idx + 1].unitLinks.map((u) => u.programUnitId),
      ]),
    ],
  };
  await writePayload(lessons[idx].id, merged);
  for (let i = idx + 1; i < lessons.length - 1; i++) {
    await writePayload(lessons[i].id, toPayload(lessons[i + 1]));
  }
  await writePayload(lessons[lessons.length - 1].id, {
    theme: "Aula livre",
    objectives: "",
    isAssessment: false,
    unitIds: [],
  });
}

/**
 * Divide a aula em duas: o slot seguinte recebe "(continuação)"; os payloads
 * seguintes descem um slot; o payload do último slot é ANEXADO ao penúltimo
 * (nada se perde — o professor é alertado na UI).
 */
export async function splitLesson(lessonPlanId: string, lessonId: string) {
  const lessons = await getOrderedLessons(lessonPlanId);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0 || idx >= lessons.length - 1) return;

  const last = toPayload(lessons[lessons.length - 1]);
  const secondLast =
    lessons.length - 2 > idx ? toPayload(lessons[lessons.length - 2]) : null;

  for (let i = lessons.length - 1; i > idx + 1; i--) {
    await writePayload(lessons[i].id, toPayload(lessons[i - 1]));
  }
  const src = toPayload(lessons[idx]);
  await writePayload(lessons[idx + 1].id, {
    ...src,
    theme: `${src.theme} (continuação)`,
  });

  // Reanexa o payload que "caiu" do fim ao novo último slot.
  if (secondLast && last.theme !== "Aula livre" && last.theme.trim() !== "") {
    const newLast = await prisma.lesson.findFirst({
      where: { lessonPlanId },
      orderBy: { number: "desc" },
      include: { unitLinks: true },
    });
    if (newLast) {
      const current = toPayload(newLast);
      await writePayload(newLast.id, {
        theme: current.theme === last.theme ? current.theme : `${current.theme} + ${last.theme}`,
        objectives: [current.objectives, last.objectives].filter(Boolean).join(" "),
        isAssessment: current.isAssessment || last.isAssessment,
        unitIds: [...new Set([...current.unitIds, ...last.unitIds])],
      });
    }
  }
}
