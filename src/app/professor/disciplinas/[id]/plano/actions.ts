"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { generatePlan, structureImportedPlan } from "@/modules/m1-teaching-plan/ai";
import { applyGeneratedPlan, snapshotVersion } from "@/modules/m1-teaching-plan/service";

type ActionState = { error?: string } | null;

function aiError(e: unknown): { error: string } {
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")) {
    return { error: "IA indisponível: configure ANTHROPIC_API_KEY no ambiente." };
  }
  return { error: `Falha na geração por IA: ${msg.slice(0, 300)}` };
}

/** Criação assistida por IA (PRD M1) — o plano de ensino só pode ser editado por PROFESSOR. */
export async function generatePlanAction(_prev: ActionState, formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { user, discipline } = await requireDisciplineAccess(disciplineId, "editPlan");

  try {
    const generated = await generatePlan({
      disciplineName: discipline.name,
      course: discipline.course,
      workloadHours: discipline.workloadHours,
      term: discipline.term,
      extraContext: String(formData.get("extraContext") ?? "") || undefined,
    });
    await applyGeneratedPlan(disciplineId, generated, user.id, "Gerado por IA");
  } catch (e) {
    return aiError(e);
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
  return null;
}

/** Import de plano existente (PDF/DOCX) com parsing + estruturação por IA. */
export async function importPlanAction(_prev: ActionState, formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { user } = await requireDisciplineAccess(disciplineId, "editPlan");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo PDF ou DOCX." };
  if (file.size > 15 * 1024 * 1024) return { error: "Arquivo muito grande (máx. 15MB)." };

  let rawText = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer), { mergePages: true });
      rawText = result.text;
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else {
      return { error: "Formato não suportado. Envie PDF ou DOCX." };
    }
  } catch (e) {
    console.error(e);
    return { error: "Não foi possível extrair texto do arquivo." };
  }
  if (rawText.trim().length < 50) {
    return { error: "O arquivo parece vazio ou é um scan sem texto extraível." };
  }

  try {
    const structured = await structureImportedPlan(rawText);
    await applyGeneratedPlan(disciplineId, structured, user.id, `Importado de ${file.name}`);
  } catch (e) {
    return aiError(e);
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
  return null;
}

/** Salva os campos MEC textuais e cria nova versão (histórico). */
export async function savePlanFieldsAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { user } = await requireDisciplineAccess(disciplineId, "editPlan");

  const plan = await prisma.teachingPlan.findUnique({ where: { disciplineId } });
  if (!plan) return;

  await prisma.teachingPlan.update({
    where: { id: plan.id },
    data: {
      version: { increment: 1 },
      ementa: String(formData.get("ementa") ?? ""),
      objetivosGerais: String(formData.get("objetivosGerais") ?? ""),
      metodologia: String(formData.get("metodologia") ?? ""),
      criteriosAvaliacao: String(formData.get("criteriosAvaliacao") ?? ""),
    },
  });
  await snapshotVersion(plan.id, user.id, "Edição manual");
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
}

export async function addUnitAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: { programUnits: true },
  });
  if (!plan) return;
  await prisma.programUnit.create({
    data: {
      teachingPlanId: plan.id,
      order: plan.programUnits.length + 1,
      title: String(formData.get("title") ?? "Nova unidade"),
      content: String(formData.get("content") ?? ""),
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
}

export async function updateUnitAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  await prisma.programUnit.updateMany({
    where: { id: String(formData.get("unitId")), teachingPlan: { disciplineId } },
    data: {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
}

export async function removeUnitAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  await prisma.programUnit.deleteMany({
    where: { id: String(formData.get("unitId")), teachingPlan: { disciplineId } },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
}

export async function addObjectiveAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: { learningObjectives: true },
  });
  if (!plan) return;
  await prisma.learningObjective.create({
    data: {
      teachingPlanId: plan.id,
      bloomLevel: String(formData.get("bloomLevel") ?? "Compreender"),
      description: String(formData.get("description") ?? ""),
      isSpecific: formData.get("isSpecific") !== "false",
      order: plan.learningObjectives.length,
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
}

export async function removeObjectiveAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "editPlan");
  await prisma.learningObjective.deleteMany({
    where: { id: String(formData.get("objectiveId")), teachingPlan: { disciplineId } },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/plano`);
}
