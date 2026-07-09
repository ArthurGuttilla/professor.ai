import "server-only";
import { prisma } from "@/lib/db";
import type { GeneratedPlan } from "./ai";

export function getFullPlan(disciplineId: string) {
  return prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: {
      programUnits: { orderBy: { order: "asc" } },
      learningObjectives: { orderBy: { order: "asc" } },
      bibliography: { orderBy: { order: "asc" } },
    },
  });
}

/** Materializa um plano gerado/importado (substitui unidades e objetivos). */
export async function applyGeneratedPlan(
  disciplineId: string,
  generated: GeneratedPlan,
  authorId: string,
  note: string,
) {
  const existing = await prisma.teachingPlan.findUnique({ where: { disciplineId } });

  const plan = existing
    ? await prisma.teachingPlan.update({
        where: { id: existing.id },
        data: {
          version: { increment: 1 },
          ementa: generated.ementa,
          objetivosGerais: generated.objetivosGerais,
          metodologia: generated.metodologia,
          criteriosAvaliacao: generated.criteriosAvaliacao,
          programUnits: { deleteMany: {} },
          learningObjectives: { deleteMany: {} },
        },
      })
    : await prisma.teachingPlan.create({
        data: {
          disciplineId,
          ementa: generated.ementa,
          objetivosGerais: generated.objetivosGerais,
          metodologia: generated.metodologia,
          criteriosAvaliacao: generated.criteriosAvaliacao,
        },
      });

  await prisma.programUnit.createMany({
    data: generated.unidades.map((u, i) => ({
      teachingPlanId: plan.id,
      order: i + 1,
      title: u.title,
      content: u.content,
    })),
  });
  await prisma.learningObjective.createMany({
    data: generated.objetivosEspecificos.map((o, i) => ({
      teachingPlanId: plan.id,
      bloomLevel: o.bloomLevel,
      description: o.description,
      isSpecific: true,
      order: i,
    })),
  });

  await snapshotVersion(plan.id, authorId, note);
  return plan;
}

/** Grava snapshot imutável do estado atual (histórico de edições — PRD M1). */
export async function snapshotVersion(teachingPlanId: string, authorId: string, note: string) {
  const plan = await prisma.teachingPlan.findUnique({
    where: { id: teachingPlanId },
    include: {
      programUnits: { orderBy: { order: "asc" } },
      learningObjectives: { orderBy: { order: "asc" } },
      bibliography: { orderBy: { order: "asc" } },
    },
  });
  if (!plan) return;

  await prisma.teachingPlanVersion.upsert({
    where: { teachingPlanId_version: { teachingPlanId, version: plan.version } },
    update: {},
    create: {
      teachingPlanId,
      version: plan.version,
      authorId,
      note,
      snapshot: {
        ementa: plan.ementa,
        objetivosGerais: plan.objetivosGerais,
        metodologia: plan.metodologia,
        criteriosAvaliacao: plan.criteriosAvaliacao,
        unidades: plan.programUnits.map((u) => ({ title: u.title, content: u.content })),
        objetivos: plan.learningObjectives.map((o) => ({
          bloomLevel: o.bloomLevel,
          description: o.description,
          isSpecific: o.isSpecific,
        })),
        bibliografia: plan.bibliography.map((b) => b.abntFormatted ?? b.title),
      },
    },
  });
}
