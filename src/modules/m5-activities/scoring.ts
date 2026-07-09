// Pontuação do quiz gamificado (M5) — função pura, testável.
// Kahoot-like: pontos por acerto + bônus por velocidade.

export type ScoreInput = {
  correct: boolean;
  elapsedMs: number;
  timeLimitMs: number;
  /** Peso da questão (Activity.questions[].points), default 1. */
  weight?: number;
};

const BASE = 1000;

/**
 * Acerto vale BASE * peso; bônus de velocidade escala linearmente até +50%
 * (responder instantâneo) e zero no estouro do tempo. Erro = 0.
 */
export function scoreAnswer(input: ScoreInput): number {
  if (!input.correct) return 0;
  const weight = input.weight ?? 1;
  const ratio = Math.min(Math.max(input.elapsedMs / input.timeLimitMs, 0), 1);
  const speedBonus = 0.5 * (1 - ratio);
  return Math.round(BASE * weight * (1 + speedBonus));
}

/** Ranking ordenado por pontuação (desempate: quem chegou antes à pontuação). */
export function rank<T extends { score: number; lastAnswerAt: number }>(players: T[]): T[] {
  return [...players].sort((a, b) => b.score - a.score || a.lastAnswerAt - b.lastAnswerAt);
}
