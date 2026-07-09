import Anthropic from "@anthropic-ai/sdk";

// Cliente Anthropic único para toda a plataforma.
// Toda geração passa por aqui — ver docs/adr/0003-ai-human-in-the-loop.md.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Seleção de modelo por perfil de tarefa (ver .env.example).
export const MODELS = {
  // Raciocínio pesado: geração de plano/prova, correção por rubrica.
  heavy: process.env.AI_MODEL_HEAVY ?? "claude-opus-4-8",
  // Custo/latência menores: formatação, rerank, tutor rápido.
  light: process.env.AI_MODEL_LIGHT ?? "claude-haiku-4-5-20251001",
} as const;
