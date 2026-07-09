import { describe, expect, it } from "vitest";
import { can, membershipLimitOk } from "./permissions";

describe("can — RBAC do PRD M10", () => {
  it("professor faz tudo na disciplina", () => {
    for (const action of ["view", "draft", "publish", "validate", "editPlan", "triage"] as const) {
      expect(can("PROFESSOR", action)).toBe(true);
    }
  });

  it("assistente cria rascunhos e faz triagem, mas não publica/valida/edita plano", () => {
    expect(can("ASSISTANT", "view")).toBe(true);
    expect(can("ASSISTANT", "draft")).toBe(true);
    expect(can("ASSISTANT", "triage")).toBe(true);
    expect(can("ASSISTANT", "publish")).toBe(false);
    expect(can("ASSISTANT", "validate")).toBe(false);
    expect(can("ASSISTANT", "editPlan")).toBe(false);
  });

  it("sem vínculo = sem permissão", () => {
    expect(can(null, "view")).toBe(false);
    expect(can(null, "validate")).toBe(false);
  });
});

describe("membershipLimitOk — limite hard ≤2 por papel", () => {
  it("permite até 2", () => {
    expect(membershipLimitOk("PROFESSOR", 0)).toBe(true);
    expect(membershipLimitOk("PROFESSOR", 1)).toBe(true);
    expect(membershipLimitOk("PROFESSOR", 2)).toBe(false);
    expect(membershipLimitOk("ASSISTANT", 2)).toBe(false);
  });
});
