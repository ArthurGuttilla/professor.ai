import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { verifyReference } from "./verify";

const suggestionSchema = z.object({
  basicas: z
    .array(
      z.object({
        authors: z.string(),
        title: z.string(),
        publisher: z.string().optional(),
        year: z.number().optional(),
        isbn: z.string().optional(),
        edition: z.string().optional(),
      }),
    )
    .min(3),
  complementares: z
    .array(
      z.object({
        authors: z.string(),
        title: z.string(),
        publisher: z.string().optional(),
        year: z.number().optional(),
        isbn: z.string().optional(),
        edition: z.string().optional(),
      }),
    )
    .min(5),
});

export type BibSuggestion = {
  kind: "BASIC" | "COMPLEMENTARY";
  authors: string;
  title: string;
  publisher?: string;
  year?: number;
  isbn?: string;
  edition?: string;
  verified: boolean;
  provenance?: string;
  verifyNote?: string;
};

/**
 * Sugestão de bibliografia por IA (básica ≥3, complementar ≥5) com verificação
 * de existência de CADA item (PRD M2 — nunca inventar referências).
 */
export async function suggestBibliography(input: {
  disciplineName: string;
  course: string;
  ementa: string;
  unidades: string[];
}): Promise<BibSuggestion[]> {
  const generated = await generateStructured({
    system: `Você é bibliotecário acadêmico especializado em ensino superior brasileiro.
Sugira SOMENTE obras reais e amplamente conhecidas — clássicos consolidados e livros-texto
adotados em universidades brasileiras. NUNCA invente título, autor, editora ou ISBN.
Se não tiver certeza do ISBN, omita o campo. Prefira edições em português quando existirem.
Responda EXCLUSIVAMENTE com JSON válido no formato:
{
  "basicas": [{ "authors": "SOBRENOME, Nome; ...", "title": "...", "publisher": "...", "year": 2020, "isbn": "...", "edition": "3. ed." }],
  "complementares": [ ...mesmo formato... ]
}
Mínimo: 3 básicas e 5 complementares.`,
    prompt: `Disciplina: ${input.disciplineName} (curso: ${input.course})
Ementa: ${input.ementa}
Unidades do conteúdo programático:
${input.unidades.map((u, i) => `${i + 1}. ${u}`).join("\n")}`,
    schema: suggestionSchema,
    model: "heavy",
  });

  const all: BibSuggestion[] = [
    ...generated.basicas.map((b) => ({ ...b, kind: "BASIC" as const, verified: false })),
    ...generated.complementares.map((b) => ({
      ...b,
      kind: "COMPLEMENTARY" as const,
      verified: false,
    })),
  ];

  // Verificação de existência item a item (paralela, tolerante a falha de rede).
  await Promise.all(
    all.map(async (item) => {
      const result = await verifyReference(item);
      if (result.verified) {
        item.verified = true;
        item.provenance = result.provenance;
      } else {
        item.verifyNote = result.reason;
      }
    }),
  );

  return all;
}
