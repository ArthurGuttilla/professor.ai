"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { generateLessonMaterials } from "@/modules/m4-materials/ai";
import { parseSlidesText } from "@/modules/m4-materials/slides";

const slug = () => crypto.randomBytes(6).toString("hex");
type ActionState = { error?: string } | null;

async function getLessonChecked(disciplineId: string, lessonId: string) {
  return prisma.lesson.findFirst({
    where: { id: lessonId, lessonPlan: { teachingPlan: { disciplineId } } },
    include: {
      unitLinks: { include: { programUnit: { include: { bibliographyLinks: { include: { bibliographyItem: true } } } } } },
      materials: true,
      lessonPlan: { include: { teachingPlan: { include: { discipline: true } } } },
    },
  });
}

/** Gera conteúdo markdown + atividades propostas + slides para a aula (M4). */
export async function generateLessonContentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  await requireDisciplineAccess(disciplineId, "draft");

  const lesson = await getLessonChecked(disciplineId, lessonId);
  if (!lesson) return { error: "Aula não encontrada." };

  const bibliography = lesson.unitLinks.flatMap((ul) =>
    ul.programUnit.bibliographyLinks.map(
      (bl) => bl.bibliographyItem.abntFormatted ?? bl.bibliographyItem.title,
    ),
  );

  try {
    const generated = await generateLessonMaterials({
      disciplineName: lesson.lessonPlan.teachingPlan.discipline.name,
      lessonNumber: lesson.number,
      theme: lesson.theme,
      objectives: lesson.objectives,
      unitContents: lesson.unitLinks.map((ul) => `${ul.programUnit.title}: ${ul.programUnit.content}`),
      bibliography,
      attachedTexts: lesson.materials.map((m) => m.extractedText ?? "").filter(Boolean),
    });

    // Bibliografia recomendada no slide final do deck (requisito P0).
    const slides = [...generated.slides];
    if (bibliography.length > 0) {
      slides.push({ title: "Bibliografia da aula", bullets: [...new Set(bibliography)] });
    }

    await prisma.lessonContent.upsert({
      where: { lessonId },
      update: { markdown: generated.markdown, proposedActivities: generated.proposedActivities },
      create: {
        lessonId,
        markdown: generated.markdown,
        proposedActivities: generated.proposedActivities,
        qrSlug: slug(),
      },
    });
    await prisma.slideDeck.upsert({
      where: { lessonId },
      update: { data: { slides } },
      create: { lessonId, data: { slides }, qrSlug: slug() },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")) {
      return { error: "IA indisponível: configure ANTHROPIC_API_KEY no ambiente." };
    }
    return { error: `Falha na geração: ${msg.slice(0, 300)}` };
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
  return null;
}

export async function saveContentAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  await requireDisciplineAccess(disciplineId, "draft");

  await prisma.lessonContent.upsert({
    where: { lessonId },
    update: {
      markdown: String(formData.get("markdown") ?? ""),
      proposedActivities: String(formData.get("proposedActivities") ?? ""),
    },
    create: {
      lessonId,
      markdown: String(formData.get("markdown") ?? ""),
      proposedActivities: String(formData.get("proposedActivities") ?? ""),
      qrSlug: slug(),
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
}

export async function saveSlidesAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  await requireDisciplineAccess(disciplineId, "draft");

  const slides = parseSlidesText(String(formData.get("slidesText") ?? ""));
  await prisma.slideDeck.upsert({
    where: { lessonId },
    update: { data: { slides } },
    create: { lessonId, data: { slides }, qrSlug: slug() },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
}

/** Publica/despublica conteúdo ou slides — apenas PROFESSOR (RBAC M10). */
export async function togglePublishAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  await requireDisciplineAccess(disciplineId, "publish");

  const target = String(formData.get("target")); // "content" | "slides"
  if (target === "content") {
    const c = await prisma.lessonContent.findUnique({ where: { lessonId } });
    if (c) {
      await prisma.lessonContent.update({
        where: { lessonId },
        data: { status: c.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
      });
    }
  } else if (target === "slides") {
    const s = await prisma.slideDeck.findUnique({ where: { lessonId } });
    if (s) {
      await prisma.slideDeck.update({
        where: { lessonId },
        data: { status: s.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
      });
    }
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
}

/** Upload de material próprio (PDF/PPTX/imagem) — alimenta IA/tutor. */
export async function uploadMaterialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  const { user } = await requireDisciplineAccess(disciplineId, "draft");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo." };
  if (file.size > 30 * 1024 * 1024) return { error: "Arquivo muito grande (máx. 30MB)." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = await saveFile({
    institutionId: user.institutionId,
    kind: "materials",
    originalName: file.name,
    data: buffer,
  });

  // Extrai texto de PDFs para alimentar geração de atividades/provas/tutor.
  let extractedText: string | null = null;
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer), { mergePages: true });
      extractedText = result.text.slice(0, 100_000);
    } catch {
      extractedText = null;
    }
  }

  await prisma.material.create({
    data: {
      lessonId,
      name: file.name,
      fileUrl: key,
      mimeType: file.type || null,
      sizeBytes: file.size,
      extractedText,
      qrSlug: slug(),
    },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
  return null;
}

export async function toggleMaterialPublishAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  await requireDisciplineAccess(disciplineId, "publish");

  const m = await prisma.material.findFirst({
    where: { id: String(formData.get("materialId")), lessonId },
  });
  if (!m) return;
  await prisma.material.update({
    where: { id: m.id },
    data: { status: m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
}

export async function deleteMaterialAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const lessonId = String(formData.get("lessonId"));
  await requireDisciplineAccess(disciplineId, "draft");
  await prisma.material.deleteMany({
    where: { id: String(formData.get("materialId")), lessonId },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}/aulas/${lessonId}`);
}
