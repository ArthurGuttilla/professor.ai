import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { anthropic, MODELS } from "./client";

type GenerateOptions<T> = {
  /** System prompt — papel e regras (ex.: conformidade MEC, anti-alucinação). */
  system: string;
  /** Instrução do usuário com o input concreto. */
  prompt: string;
  /** Schema Zod que a saída DEVE satisfazer. Saída malformada = erro. */
  schema: z.ZodType<T>;
  /** Perfil de modelo. Default: heavy (geração pedagógica). */
  model?: keyof typeof MODELS;
  maxTokens?: number;
};

/**
 * Geração com saída estruturada validada.
 *
 * Princípio (ADR 0003): a saída de IA é validada contra um schema — não é
 * best-effort. Isto sustenta o requisito anti-alucinação (campos verificáveis)
 * e permite que a camada de serviço rejeite saídas inválidas em vez de
 * repassá-las ao professor/aluno.
 *
 * NOTA: implementação de referência mínima. Ao ligar de fato, adicionar:
 *  - uso de tool/JSON mode do SDK para forçar JSON,
 *  - retry no parse/validação,
 *  - verificação de proveniência para bibliografia/citações do tutor.
 */
export async function generateStructured<T>(opts: GenerateOptions<T>): Promise<T> {
  const { system, prompt, schema, model = "heavy", maxTokens = 4096 } = opts;

  const message = await anthropic.messages.create({
    model: MODELS[model],
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return schema.parse(JSON.parse(extractJson(text)));
}

// Extrai o primeiro objeto/array JSON de um texto (tolerante a cercas de código).
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.search(/[[{]/);
  return start >= 0 ? text.slice(start).trim() : text.trim();
}

/**
 * Variante com arquivo (PDF/imagem) — usada no OCR de provas digitalizadas (M7).
 * O arquivo entra como bloco `document`/`image` na mensagem (vision).
 */
export async function generateStructuredFromFile<T>(
  opts: GenerateOptions<T> & { file: { data: Buffer; mimeType: string } },
): Promise<T> {
  const { system, prompt, schema, model = "heavy", maxTokens = 4096, file } = opts;

  const base64 = file.data.toString("base64");
  const fileBlock: Anthropic.ContentBlockParam =
    file.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: file.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        };

  const message = await anthropic.messages.create({
    model: MODELS[model],
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt }] }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return schema.parse(JSON.parse(extractJson(text)));
}
