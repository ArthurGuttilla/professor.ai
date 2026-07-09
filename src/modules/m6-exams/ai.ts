import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";

const examSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(["MULTIPLE_CHOICE", "ESSAY"]),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
        baseText: z.string(),
        statement: z.string(),
        options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
        correctKey: z.string().optional(),
        answerKey: z.string().optional(),
        theme: z.string(),
        points: z.number(),
      }),
    )
    .min(1),
  rubric: z.object({
    criteria: z
      .array(
        z.object({
          criterion: z.string(),
          description: z.string(),
          points: z.number(),
          /** Índice (0-based) da questão discursiva a que o critério se refere; ausente = critério geral. */
          questionIndex: z.number().int().optional(),
        }),
      )
      .min(1),
  }),
});

export type GeneratedExam = z.infer<typeof examSchema>;

/**
 * Geração de prova no formato ENADE (PRD M6): múltipla escolha com
 * texto-base/situação-problema e discursivas com padrão de resposta,
 * mais a rubrica (critério, descrição, pontos) — geral e por discursiva.
 */
export async function generateExam(input: {
  disciplineName: string;
  kind: "ENADE_EXAM" | "TRADITIONAL_EXAM" | "GRADED_ACTIVITY";
  mcCount: number;
  essayCount: number;
  totalPoints: number;
  sourceMaterial: string;
}): Promise<GeneratedExam> {
  const enade = input.kind === "ENADE_EXAM";
  return generateStructured({
    system: `Você é um elaborador de provas universitárias${
      enade
        ? " especialista no formato ENADE: toda questão parte de um texto-base/situação-problema contextualizada do mundo real; múltipla escolha com 5 alternativas (A-E) plausíveis; discursivas com padrão de resposta detalhado"
        : ""
    }.
Regras:
- Baseie-se EXCLUSIVAMENTE no material fornecido.
- Distribua os pontos entre as questões somando EXATAMENTE o total pedido.
- Rubrica: critérios por questão DISCURSIVA (use "questionIndex" 0-based) + um critério geral
  "Objetivas — acerto" cobrindo os pontos das múltipla escolha. A soma dos pontos da rubrica
  deve ser EXATAMENTE o total da prova.
Responda EXCLUSIVAMENTE com JSON válido:
{
  "questions": [{ "type": "MULTIPLE_CHOICE"|"ESSAY", "difficulty", "baseText", "statement",
                  "options"?, "correctKey"?, "answerKey"?, "theme", "points": number }],
  "rubric": { "criteria": [{ "criterion", "description", "points", "questionIndex"? }] }
}`,
    prompt: `Disciplina: ${input.disciplineName}
Formato: ${enade ? "ENADE" : input.kind === "TRADITIONAL_EXAM" ? "prova tradicional" : "atividade avaliativa"}
Questões: ${input.mcCount} de múltipla escolha + ${input.essayCount} discursiva(s)
Pontos totais: ${input.totalPoints}
Material-fonte (escopo da prova):
${input.sourceMaterial.slice(0, 22000)}`,
    schema: examSchema,
    model: "heavy",
    maxTokens: 8192,
  });
}
