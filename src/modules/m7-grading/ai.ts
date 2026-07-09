import "server-only";
import { z } from "zod";
import { generateStructured, generateStructuredFromFile } from "@/lib/ai/generate";

// ── Extração (OCR por vision): identificação do aluno + respostas ──

const extractionSchema = z.object({
  header: z.string(),
  answers: z.array(z.object({ questionNumber: z.number().int(), answer: z.string() })),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * OCR da prova digitalizada (PRD M7): lê cabeçalho (nome/matrícula) e
 * transcreve as respostas por questão. Vision sobre PDF/foto.
 */
export async function extractSubmission(input: {
  file: { data: Buffer; mimeType: string };
  questionCount: number;
}): Promise<Extraction> {
  return generateStructuredFromFile({
    system: `Você transcreve provas manuscritas/digitalizadas de alunos universitários.
Tarefas:
1. Extrair a identificação do aluno do cabeçalho (nome e/ou matrícula) — copie o que estiver legível.
2. Transcrever a resposta de cada questão (1 a N). Para múltipla escolha, a letra assinalada;
   para discursivas, o texto completo. Se ilegível ou em branco, use "".
NUNCA invente conteúdo que não está na prova.
Responda EXCLUSIVAMENTE com JSON válido:
{ "header": string, "answers": [{ "questionNumber": number, "answer": string }] }`,
    prompt: `Esta prova tem ${input.questionCount} questão(ões). Extraia cabeçalho e respostas.`,
    schema: extractionSchema,
    model: "heavy",
    maxTokens: 4096,
    file: input.file,
  });
}

// ── Sugestão de vínculo prova↔aluno ─────────────────────────────

/**
 * Casa o cabeçalho extraído com a lista de matriculados (determinístico:
 * matrícula exata > nome contido). Retorna studentId ou null.
 */
export function suggestStudentLink(
  header: string,
  students: { id: string; name: string | null; email: string; registration: string | null }[],
): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const h = norm(header);
  if (!h) return null;

  for (const s of students) {
    if (s.registration && h.includes(s.registration)) return s.id;
  }
  for (const s of students) {
    if (s.name && h.includes(norm(s.name))) return s.id;
  }
  // Último recurso: sobrenome+nome parcial (2+ palavras do nome presentes).
  for (const s of students) {
    if (!s.name) continue;
    const parts = norm(s.name).split(" ").filter((p) => p.length > 2);
    const hits = parts.filter((p) => h.includes(p)).length;
    if (parts.length >= 2 && hits >= 2) return s.id;
  }
  return null;
}

// ── Correção por rubrica ────────────────────────────────────────

const gradingSchema = z.object({
  criterionScores: z.array(
    z.object({
      criterionIndex: z.number().int(),
      score: z.number(),
      justification: z.string(),
    }),
  ),
  essayFeedback: z.array(
    z.object({ questionNumber: z.number().int(), points: z.number(), feedback: z.string() }),
  ),
  overallFeedback: z.string(),
});

export type Grading = z.infer<typeof gradingSchema>;

/**
 * Correção automática por rubrica (PRD M7): nota por critério com
 * justificativa + feedback textual. As objetivas já chegam corrigidas
 * (determinístico); a IA pontua discursivas e os critérios da rubrica.
 * A saída NUNCA vai direto ao aluno — passa pelo gate de validação.
 */
export async function gradeSubmission(input: {
  disciplineName: string;
  examTitle: string;
  questions: {
    number: number;
    type: string;
    statement: string;
    answerKey: string | null;
    correctKey: string | null;
    points: number;
    studentAnswer: string;
    objectiveCorrect: boolean | null;
  }[];
  criteria: { index: number; criterion: string; description: string; points: number; questionNumber: number | null }[];
}): Promise<Grading> {
  return generateStructured({
    system: `Você é um corretor de provas universitárias rigoroso e justo. Aplique a RUBRICA
critério a critério; cada nota deve respeitar o máximo do critério e vir com justificativa
objetiva baseada na resposta do aluno. O feedback é dirigido AO ALUNO (segunda pessoa),
construtivo e específico. As questões objetivas já foram corrigidas — os critérios que as
cobrem devem refletir os acertos informados, proporcionalmente.
Responda EXCLUSIVAMENTE com JSON válido:
{
  "criterionScores": [{ "criterionIndex": number, "score": number, "justification": string }],
  "essayFeedback": [{ "questionNumber": number, "points": number, "feedback": string }],
  "overallFeedback": string
}`,
    prompt: `Disciplina: ${input.disciplineName} · Avaliação: ${input.examTitle}

QUESTÕES E RESPOSTAS DO ALUNO:
${input.questions
  .map(
    (q) => `Questão ${q.number} [${q.type}] (${q.points} pts)
Enunciado: ${q.statement}
${q.correctKey ? `Gabarito: ${q.correctKey} · Resposta do aluno: "${q.studentAnswer}" · ${q.objectiveCorrect ? "ACERTOU" : "ERROU"}` : ""}
${q.answerKey ? `Padrão de resposta: ${q.answerKey}\nResposta do aluno: "${q.studentAnswer}"` : ""}`,
  )
  .join("\n\n")}

RUBRICA:
${input.criteria
  .map(
    (c) =>
      `[${c.index}] ${c.criterion} (máx. ${c.points} pts)${c.questionNumber ? ` — questão ${c.questionNumber}` : " — geral"}: ${c.description}`,
  )
  .join("\n")}`,
    schema: gradingSchema,
    model: "heavy",
    maxTokens: 4096,
  });
}
