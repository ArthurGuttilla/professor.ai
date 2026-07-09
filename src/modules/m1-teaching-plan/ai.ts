import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";

// Saída estruturada da geração/estruturação de plano de ensino (formato MEC).
export const planSchema = z.object({
  ementa: z.string().min(1),
  objetivosGerais: z.string().min(1),
  objetivosEspecificos: z
    .array(z.object({ bloomLevel: z.string(), description: z.string() }))
    .min(3),
  unidades: z.array(z.object({ title: z.string(), content: z.string() })).min(2),
  metodologia: z.string().min(1),
  criteriosAvaliacao: z.string().min(1),
});

export type GeneratedPlan = z.infer<typeof planSchema>;

const SYSTEM = `Você é um especialista em planejamento pedagógico universitário brasileiro,
profundo conhecedor do formato MEC de plano de ensino e da taxonomia de Bloom.
Gere conteúdo específico e substantivo para a disciplina informada — nunca genérico.
Objetivos específicos devem usar verbos da taxonomia de Bloom, indicando o nível
(Lembrar, Compreender, Aplicar, Analisar, Avaliar, Criar).
Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto fora do JSON, no formato:
{
  "ementa": string,                       // parágrafo único, frases nominais separadas por ponto
  "objetivosGerais": string,
  "objetivosEspecificos": [{ "bloomLevel": string, "description": string }],  // 4 a 6
  "unidades": [{ "title": string, "content": string }],  // 3 a 6 unidades, title "Unidade N — ..."
  "metodologia": string,
  "criteriosAvaliacao": string
}`;

/** Geração assistida por IA a partir do input mínimo (PRD M1, P0). */
export async function generatePlan(input: {
  disciplineName: string;
  course: string;
  workloadHours: number;
  term: string;
  extraContext?: string;
}): Promise<GeneratedPlan> {
  return generateStructured({
    system: SYSTEM,
    prompt: `Gere o plano de ensino para:
Disciplina: ${input.disciplineName}
Curso: ${input.course}
Carga horária: ${input.workloadHours}h
Período: ${input.term}
${input.extraContext ? `Contexto adicional do professor: ${input.extraContext}` : ""}`,
    schema: planSchema,
    model: "heavy",
  });
}

/** Estrutura um plano importado (texto extraído de PDF/DOCX) nos campos MEC. */
export async function structureImportedPlan(rawText: string): Promise<GeneratedPlan> {
  return generateStructured({
    system: SYSTEM,
    prompt: `O texto a seguir é um plano de ensino existente extraído de um arquivo.
Mapeie fielmente o conteúdo para os campos estruturados — preserve o texto original
sempre que possível; complete lacunas apenas quando indispensável, mantendo o estilo.

--- INÍCIO DO PLANO IMPORTADO ---
${rawText.slice(0, 24000)}
--- FIM ---`,
    schema: planSchema,
    model: "heavy",
  });
}
