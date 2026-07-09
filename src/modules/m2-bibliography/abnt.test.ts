import { describe, expect, it } from "vitest";
import { formatAbnt, normalizeAuthors } from "./abnt";

describe("normalizeAuthors", () => {
  it("normaliza separadores para '; '", () => {
    expect(normalizeAuthors("SILVA, João e SOUZA, Maria")).toBe("SILVA, João; SOUZA, Maria");
    expect(normalizeAuthors("SILVA, João;SOUZA, Maria")).toBe("SILVA, João; SOUZA, Maria");
  });
});

describe("formatAbnt", () => {
  it("formata livro completo", () => {
    expect(
      formatAbnt({
        authors: "FORBELLONE, André Luiz Villar",
        title: "Lógica de programação",
        edition: "3. ed.",
        publisher: "Pearson",
        year: 2022,
      }),
    ).toBe("FORBELLONE, André Luiz Villar. Lógica de programação. 3. ed. Pearson, 2022.");
  });

  it("usa s.d. sem ano e omite edição ausente", () => {
    expect(
      formatAbnt({ authors: "SILVA, A.", title: "Título", publisher: "Editora" }),
    ).toBe("SILVA, A. Título. Editora, s.d.");
  });

  it("não duplica pontos finais", () => {
    expect(formatAbnt({ authors: "SILVA, A.", title: "Título.", year: 2020 })).toBe(
      "SILVA, A. Título. 2020.",
    );
  });
});
