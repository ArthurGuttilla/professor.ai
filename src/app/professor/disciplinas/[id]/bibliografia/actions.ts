"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatAbnt } from "@/modules/m2-bibliography/abnt";
import { suggestBibliography, type BibSuggestion } from "@/modules/m2-bibliography/ai";
import { verifyReference } from "@/modules/m2-bibliography/verify";

type SuggestState = { error?: string; suggestions?: BibSuggestion[] } | null;

/** Sugestão por IA com verificação de existência (PRD M2). */
export async function suggestBibliographyAction(
  _prev: SuggestState,
  formData: FormData,
): Promise<SuggestState> {
  const disciplineId = String(formData.get("disciplineId"));
  const { discipline } = await requireDisciplineAccess(disciplineId, "draft");

  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: { programUnits: { orderBy: { order: "asc" } } },
  });
  if (!plan) return { error: "Crie o plano de ensino antes de sugerir bibliografia." };

  try {
    const suggestions = await suggestBibliography({
      disciplineName: discipline.name,
      course: discipline.course,
      ementa: plan.ementa,
      unidades: plan.programUnits.map((u) => u.title),
    });
    return { suggestions };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")) {
      return { error: "IA indisponível: configure ANTHROPIC_API_KEY no ambiente." };
    }
    return { error: `Falha na sugestão: ${msg.slice(0, 300)}` };
  }
}

/** Adiciona uma sugestão aceita pelo professor à bibliografia do plano. */
export async function addSuggestionAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: { bibliography: true },
  });
  if (!plan) return;

  const fields = {
    authors: String(formData.get("authors")),
    title: String(formData.get("title")),
    publisher: String(formData.get("publisher") || "") || null,
    year: Number(formData.get("year")) || null,
    edition: String(formData.get("edition") || "") || null,
  };
  const verified = formData.get("verified") === "true";
  // Anti-alucinação: item não verificado por catálogo exige confirmação
  // explícita do professor (checkbox), registrada como proveniência.
  const confirmed = formData.get("confirmExists") === "on";
  if (!verified && !confirmed) return;

  await prisma.bibliographyItem.create({
    data: {
      teachingPlanId: plan.id,
      kind: String(formData.get("kind")) === "BASIC" ? "BASIC" : "COMPLEMENTARY",
      ...fields,
      isbn: String(formData.get("isbn") || "") || null,
      verified: true,
      provenance: verified
        ? String(formData.get("provenance") || "Catálogo aberto")
        : "Confirmação manual do professor",
      abntFormatted: formatAbnt(fields),
      order: plan.bibliography.length,
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/bibliografia`);
}

/** Adição totalmente manual. */
export async function addManualReferenceAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: { bibliography: true },
  });
  if (!plan) return;

  const fields = {
    authors: String(formData.get("authors")),
    title: String(formData.get("title")),
    publisher: String(formData.get("publisher") || "") || null,
    year: Number(formData.get("year")) || null,
    edition: String(formData.get("edition") || "") || null,
  };
  if (!fields.authors || !fields.title) return;

  // Tenta verificação em catálogo; se falhar, a inclusão manual do professor
  // vale como proveniência (ele é a autoridade curadora — PRD M2).
  const isbn = String(formData.get("isbn") || "") || null;
  const result = await verifyReference({ ...fields, isbn });

  await prisma.bibliographyItem.create({
    data: {
      teachingPlanId: plan.id,
      kind: String(formData.get("kind")) === "BASIC" ? "BASIC" : "COMPLEMENTARY",
      ...fields,
      isbn,
      verified: true,
      provenance: result.verified ? result.provenance : "Cadastro manual do professor",
      abntFormatted: formatAbnt(fields),
      order: plan.bibliography.length,
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/bibliografia`);
}

export async function removeReferenceAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  await prisma.bibliographyItem.deleteMany({
    where: { id: String(formData.get("itemId")), teachingPlan: { disciplineId } },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/bibliografia`);
}

export async function moveReferenceAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const itemId = String(formData.get("itemId"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;

  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId },
    include: { bibliography: { orderBy: { order: "asc" } } },
  });
  if (!plan) return;
  const idx = plan.bibliography.findIndex((b) => b.id === itemId);
  const other = idx + dir;
  if (idx < 0 || other < 0 || other >= plan.bibliography.length) return;

  await prisma.$transaction([
    prisma.bibliographyItem.update({ where: { id: plan.bibliography[idx].id }, data: { order: other } }),
    prisma.bibliographyItem.update({ where: { id: plan.bibliography[other].id }, data: { order: idx } }),
  ]);
  revalidatePath(`/professor/disciplinas/${disciplineId}/bibliografia`);
}

export async function toggleLibraryAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const item = await prisma.bibliographyItem.findFirst({
    where: { id: String(formData.get("itemId")), teachingPlan: { disciplineId } },
  });
  if (!item) return;
  await prisma.bibliographyItem.update({
    where: { id: item.id },
    data: { availableInLibrary: !item.availableInLibrary },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/bibliografia`);
}

/** Vincula/desvincula referência a uma unidade do programa (N:N). */
export async function toggleUnitLinkAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const bibliographyItemId = String(formData.get("itemId"));
  const programUnitId = String(formData.get("unitId"));

  const existing = await prisma.bibliographyUnitLink.findUnique({
    where: { bibliographyItemId_programUnitId: { bibliographyItemId, programUnitId } },
  });
  if (existing) {
    await prisma.bibliographyUnitLink.delete({ where: { id: existing.id } });
  } else {
    await prisma.bibliographyUnitLink.create({ data: { bibliographyItemId, programUnitId } });
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/bibliografia`);
}
