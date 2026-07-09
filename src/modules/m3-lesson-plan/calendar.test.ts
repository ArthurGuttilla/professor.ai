import { describe, expect, it } from "vitest";
import { assessmentSlots, checkAlignment, generateLessonDates } from "./calendar";

describe("generateLessonDates", () => {
  it("gera datas nos dias corretos, pulando feriados", () => {
    // Ago/2026: 03 é segunda. Semanas seg/qua, feriado em 05/08.
    const dates = generateLessonDates({
      startDate: new Date(Date.UTC(2026, 7, 3)),
      endDate: new Date(Date.UTC(2026, 7, 16)),
      weekdays: [1, 3],
      holidays: [new Date(Date.UTC(2026, 7, 5))],
    });
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-12",
    ]);
  });

  it("retorna vazio quando não há dias válidos", () => {
    expect(
      generateLessonDates({
        startDate: new Date(Date.UTC(2026, 7, 3)),
        endDate: new Date(Date.UTC(2026, 7, 4)),
        weekdays: [6],
        holidays: [],
      }),
    ).toEqual([]);
  });
});

describe("assessmentSlots", () => {
  it("distribui avaliações com a última perto do fim", () => {
    expect(assessmentSlots(16, 2)).toEqual([7, 15]);
  });
  it("zero avaliações", () => {
    expect(assessmentSlots(16, 0)).toEqual([]);
  });
  it("não excede o total de aulas", () => {
    expect(assessmentSlots(2, 5).length).toBeLessThanOrEqual(2);
  });
});

describe("checkAlignment", () => {
  it("ok quando cabem 2 aulas por unidade", () => {
    expect(checkAlignment(4, 8)).toEqual({ ok: true });
  });
  it("alerta com sugestão quando não cabe", () => {
    const result = checkAlignment(6, 8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("mesclar unidades");
  });
});
