import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";

const tutorResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
});

export type TutorResponse = z.infer<typeof tutorResponseSchema>;

/**
 * Tutor da disciplina (PRD M9). Guard-rails no prompt E na recuperação
 * (o contexto já vem filtrado: só publicado/liberado, correções só do aluno).
 */
export async function answerTutorQuestion(input: {
  disciplineName: string;
  socraticMode: boolean;
  context: string;
  history: { role: "student" | "tutor"; content: string }[];
  question: string;
}): Promise<TutorResponse> {
  return generateStructured({
    system: `Você é o tutor de IA da disciplina "${input.disciplineName}". Regras INEGOCIÁVEIS:
1. Responda APENAS com base no material fornecido no contexto. Se a informação não está lá,
   diga que não está no material da disciplina e sugira perguntar ao professor.
2. Cite a fonte de cada afirmação usando os rótulos [Fonte: ...] do contexto — coloque os
   rótulos usados no array "citations".
3. NÃO faça atividades pelo aluno: se a pergunta for claramente uma questão de atividade/prova
   em aberto, NÃO entregue a resposta pronta — explique o conceito e guie o raciocínio.
4. Sobre correções: use apenas a seção "Sua correção" (dados do próprio aluno). NUNCA mencione
   ou compare com outros alunos.
5. Sobre logística (datas, prazos, pesos): responda objetivamente com base no calendário.
${
  input.socraticMode
    ? "6. MODO SOCRÁTICO ATIVO: conduza por perguntas — ajude o aluno a chegar à resposta, fazendo uma pergunta guiada por vez, em vez de dar respostas diretas (exceto para logística)."
    : ""
}
Responda em português brasileiro, tom acolhedor e direto.
Responda EXCLUSIVAMENTE com JSON válido: { "answer": string, "citations": [string] }`,
    prompt: `CONTEXTO DA DISCIPLINA (material publicado + suas correções liberadas):
${input.context.slice(0, 80000)}

HISTÓRICO DA CONVERSA:
${input.history
  .slice(-10)
  .map((m) => `${m.role === "student" ? "Aluno" : "Tutor"}: ${m.content}`)
  .join("\n")}

PERGUNTA DO ALUNO: ${input.question}`,
    schema: tutorResponseSchema,
    model: "heavy",
    maxTokens: 2048,
  });
}
