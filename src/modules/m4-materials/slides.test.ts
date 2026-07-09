import { describe, expect, it } from "vitest";
import { parseSlidesText, slidesToText } from "./slides";

describe("slides ⇄ texto", () => {
  it("faz roundtrip sem perdas", () => {
    const slides = [
      { title: "Capa", bullets: ["Aula 1", "Prof. Ana"] },
      { title: "Conceito", bullets: ["Definição", "Exemplo"] },
    ];
    expect(parseSlidesText(slidesToText(slides))).toEqual(slides);
  });

  it("parseia bullets com - e *", () => {
    const parsed = parseSlidesText("# T\n- a\n* b");
    expect(parsed).toEqual([{ title: "T", bullets: ["a", "b"] }]);
  });

  it("ignora blocos vazios e usa primeira linha como título sem #", () => {
    const parsed = parseSlidesText("Solto\n- x\n---\n\n---\n# Ok");
    expect(parsed).toEqual([
      { title: "Solto", bullets: ["x"] },
      { title: "Ok", bullets: [] },
    ]);
  });
});
