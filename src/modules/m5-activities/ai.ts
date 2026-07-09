import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "ESSAY"]),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
        baseText: z.string().optional(),
        statement: z.string(),
        options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
        correctKey: z.string().optional(),
        answerKey: z.string().optional(),
        theme: z.string(),
      }),
    )
    .min(1),
});

export type GeneratedQuestion = z.infer<typeof questionsSchema>["questions"][number];

/**
 * Geração de questões por IA a partir dos materiais da aula (PRD M5) —
 * SEMPRE entram como não revisadas: o professor revisa antes de publicar.
 */
export async function generateQuestions(input: {
  disciplineName: string;
  count: number;
  types: ("MULTIPLE_CHOICE" | "TRUE_FALSE" | "ESSAY")[];
  sourceMaterial: string;
  theme?: string;
  enadeStyle?: boolean;
}): Promise<GeneratedQuestion[]> {
  const result = await generateStructured({
    system: `Você é um elaborador de questões universitárias${
      input.enadeStyle
        ? " no estilo ENADE: múltipla escolha com texto-base/situação-problema contextualizada e 5 alternativas (A-E), e discursivas com padrão de resposta detalhado"
        : ""
    }.
Regras:
- Baseie-se EXCLUSIVAMENTE no material fornecido; não invente fatos externos.
- MULTIPLE_CHOICE: 4-5 alternativas plausíveis (chaves "A".."E"), UMA correta em "correctKey".
- TRUE_FALSE: options [{"key":"V","text":"Verdadeiro"},{"key":"F","text":"Falso"}] e correctKey "V" ou "F".
- ESSAY: sem options; "answerKey" com o padrão de resposta esperado.
- "theme": tópico curto da questão.
Responda EXCLUSIVAMENTE com JSON válido:
{ "questions": [{ "type", "difficulty", "baseText"?, "statement", "options"?, "correctKey"?, "answerKey"?, "theme" }] }`,
    prompt: `Disciplina: ${input.disciplineName}
Quantidade: ${input.count} questão(ões)
Tipos permitidos: ${input.types.join(", ")}
${input.theme ? `Tema/foco: ${input.theme}` : ""}
Material-fonte:
${input.sourceMaterial.slice(0, 20000)}`,
    schema: questionsSchema,
    model: "heavy",
    maxTokens: 8192,
  });

  return result.questions.slice(0, input.count);
}
