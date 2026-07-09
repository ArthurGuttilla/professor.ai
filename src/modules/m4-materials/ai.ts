import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import type { Slide } from "./slides";

const lessonContentSchema = z.object({
  markdown: z.string().min(50),
  proposedActivities: z.string().min(10),
  slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()) })).min(4),
});

export type GeneratedLessonContent = {
  markdown: string;
  proposedActivities: string;
  slides: Slide[];
};

/**
 * Geração por aula (PRD M4, P0): texto-base em markdown + atividades
 * propostas + deck de slides, derivados do plano aula a aula e dos
 * materiais anexados pelo professor.
 */
export async function generateLessonMaterials(input: {
  disciplineName: string;
  lessonNumber: number;
  theme: string;
  objectives: string;
  unitContents: string[];
  bibliography: string[];
  attachedTexts: string[];
}): Promise<GeneratedLessonContent> {
  const result = await generateStructured({
    system: `Você é professor universitário experiente preparando material de aula.
Produza conteúdo substantivo, específico ao tema — nunca genérico. Em português brasileiro.
Responda EXCLUSIVAMENTE com JSON válido:
{
  "markdown": string,             // texto-base da aula em markdown: títulos, exemplos, código quando couber (1000-2500 palavras)
  "proposedActivities": string,   // 3-5 atividades propostas em lista markdown numerada
  "slides": [{ "title": string, "bullets": [string] }]  // 8-14 slides: capa, desenvolvimento, síntese (SEM slide de bibliografia — adicionado automaticamente)
}`,
    prompt: `Disciplina: ${input.disciplineName}
Aula ${input.lessonNumber}: ${input.theme}
Objetivos da aula: ${input.objectives}
Conteúdo programático coberto:
${input.unitContents.map((c) => `- ${c}`).join("\n")}
Bibliografia da aula: ${input.bibliography.join(" | ") || "(nenhuma vinculada)"}
${
  input.attachedTexts.length
    ? `Materiais do professor (use como fonte primária):\n${input.attachedTexts
        .map((t) => t.slice(0, 6000))
        .join("\n---\n")}`
    : ""
}`,
    schema: lessonContentSchema,
    model: "heavy",
    maxTokens: 8192,
  });

  return result;
}
