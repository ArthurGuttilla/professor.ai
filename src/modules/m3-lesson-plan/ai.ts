import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";

const distributionSchema = z.object({
  lessons: z.array(
    z.object({
      theme: z.string(),
      objectives: z.string(),
      unitIndexes: z.array(z.number().int().min(0)),
    }),
  ),
});

export type LessonDistribution = z.infer<typeof distributionSchema>["lessons"];

/**
 * Distribui o conteúdo programático pelas aulas letivas do semestre (M3).
 * Slots de avaliação são reservados fora daqui — a IA recebe apenas o
 * número de aulas letivas.
 */
export async function distributeProgram(input: {
  disciplineName: string;
  units: { title: string; content: string }[];
  teachableCount: number;
}): Promise<LessonDistribution> {
  const result = await generateStructured({
    system: `Você é um planejador pedagógico universitário. Distribua o conteúdo programático
pelo número EXATO de aulas informado, em progressão didática (do fundamento ao avançado),
equilibrando o tempo por unidade conforme a densidade do conteúdo.
Cada aula tem: tema específico (não genérico), objetivos da aula (1-2 frases) e os índices
das unidades cobertas (0-based, referentes à lista fornecida).
Responda EXCLUSIVAMENTE com JSON válido:
{ "lessons": [{ "theme": string, "objectives": string, "unitIndexes": [number] }] }
O array DEVE ter exatamente o número de aulas pedido.`,
    prompt: `Disciplina: ${input.disciplineName}
Número de aulas letivas: ${input.teachableCount}
Unidades do conteúdo programático:
${input.units.map((u, i) => `[${i}] ${u.title}: ${u.content}`).join("\n")}`,
    schema: distributionSchema,
    model: "heavy",
  });

  // Ajuste defensivo: força o tamanho exato (trunca ou preenche).
  const lessons = result.lessons.slice(0, input.teachableCount);
  while (lessons.length < input.teachableCount) {
    lessons.push({
      theme: "Revisão e exercícios",
      objectives: "Consolidar os conteúdos das aulas anteriores.",
      unitIndexes: [],
    });
  }
  return lessons;
}
