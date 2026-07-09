// Serialização de slides ⇄ texto editável — funções puras, testáveis.
//
// Formato de edição (um slide por bloco, separados por linha "---"):
//   # Título do slide
//   - bullet 1
//   - bullet 2

export type Slide = { title: string; bullets: string[] };

export function slidesToText(slides: Slide[]): string {
  return slides
    .map((s) => [`# ${s.title}`, ...s.bullets.map((b) => `- ${b}`)].join("\n"))
    .join("\n---\n");
}

export function parseSlidesText(text: string): Slide[] {
  return text
    .split(/^---$/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      const titleLine = lines.find((l) => l.startsWith("#"));
      const title = titleLine ? titleLine.replace(/^#+\s*/, "") : (lines[0] ?? "Slide");
      const bullets = lines
        .filter((l) => l.startsWith("-") || l.startsWith("*"))
        .map((l) => l.replace(/^[-*]\s*/, ""))
        .filter(Boolean);
      return { title, bullets };
    });
}
