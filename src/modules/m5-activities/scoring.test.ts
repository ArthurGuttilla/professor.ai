import { describe, expect, it } from "vitest";
import { rank, scoreAnswer } from "./scoring";

describe("scoreAnswer", () => {
  it("erro vale zero", () => {
    expect(scoreAnswer({ correct: false, elapsedMs: 100, timeLimitMs: 30000 })).toBe(0);
  });

  it("acerto instantâneo ganha bônus máximo (+50%)", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, timeLimitMs: 30000 })).toBe(1500);
  });

  it("acerto no limite do tempo vale a base", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 30000, timeLimitMs: 30000 })).toBe(1000);
  });

  it("meio do tempo → bônus de 25%", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 15000, timeLimitMs: 30000 })).toBe(1250);
  });

  it("peso multiplica a pontuação", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 30000, timeLimitMs: 30000, weight: 2 })).toBe(
      2000,
    );
  });
});

describe("rank", () => {
  it("ordena por pontuação; desempate por quem pontuou antes", () => {
    const players = [
      { name: "b", score: 100, lastAnswerAt: 200 },
      { name: "a", score: 300, lastAnswerAt: 100 },
      { name: "c", score: 100, lastAnswerAt: 150 },
    ];
    expect(rank(players).map((p) => p.name)).toEqual(["a", "c", "b"]);
  });
});
