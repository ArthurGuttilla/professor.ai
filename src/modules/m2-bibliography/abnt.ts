// Formatação ABNT (NBR 6023) determinística — função pura, testável.
// Cobertura v1: livros (autores, título, edição, editora, ano).

export type BibFields = {
  authors: string; // "SOBRENOME, Nome; SOBRENOME, Nome" (como cadastrado)
  title: string;
  edition?: string | null; // ex.: "3. ed."
  publisher?: string | null;
  year?: number | null;
};

/** Normaliza a lista de autores para o padrão ABNT (separador "; "). */
export function normalizeAuthors(authors: string): string {
  return authors
    .split(/;|\se\s/)
    .map((a) => a.trim())
    .filter(Boolean)
    .join("; ");
}

export function formatAbnt(fields: BibFields): string {
  const parts: string[] = [];
  parts.push(`${normalizeAuthors(fields.authors).replace(/\.$/, "")}.`);
  parts.push(`${fields.title.replace(/\.$/, "")}.`);
  if (fields.edition) parts.push(`${fields.edition.replace(/\.$/, "")}.`);
  const pubYear = [fields.publisher, fields.year ?? "s.d."].filter(Boolean).join(", ");
  if (pubYear) parts.push(`${pubYear.replace(/\.$/, "")}.`);
  return parts.join(" ");
}
