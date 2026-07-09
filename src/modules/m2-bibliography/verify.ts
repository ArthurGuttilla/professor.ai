import "server-only";

/**
 * Verificação de existência de referências (requisito anti-alucinação, PRD M2:
 * "nunca inventar referências; toda sugestão passa por verificação").
 *
 * v1: consulta a Open Library (por ISBN ou título+autor). Se a rede estiver
 * indisponível, a referência fica NÃO VERIFICADA — nunca marcada como
 * verificada sem proveniência (falha fechada, ver ADR 0003).
 */

export type VerifyResult =
  | { verified: true; provenance: string }
  | { verified: false; reason: string };

const TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "professor.ai bibliografia-verify" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function similar(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export async function verifyReference(ref: {
  title: string;
  authors: string;
  isbn?: string | null;
}): Promise<VerifyResult> {
  // 1) ISBN é a verificação mais forte.
  if (ref.isbn) {
    const isbn = ref.isbn.replace(/[^0-9Xx]/g, "");
    if (isbn.length >= 10) {
      const data = (await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`)) as {
        title?: string;
      } | null;
      if (data?.title) {
        return { verified: true, provenance: `Open Library ISBN ${isbn} ("${data.title}")` };
      }
    }
  }

  // 2) Busca por título (+ primeiro autor) com checagem de similaridade.
  const firstAuthor = ref.authors.split(/[;,]/)[0]?.trim() ?? "";
  const q = new URLSearchParams({ title: ref.title, limit: "5" });
  if (firstAuthor) q.set("author", firstAuthor);
  const data = (await fetchJson(`https://openlibrary.org/search.json?${q}`)) as {
    docs?: { title?: string }[];
  } | null;
  const match = data?.docs?.find((d) => d.title && similar(d.title, ref.title));
  if (match) {
    return { verified: true, provenance: `Open Library search ("${match.title}")` };
  }

  return {
    verified: false,
    reason: "Não encontrada em catálogo aberto — confirme manualmente antes de usar.",
  };
}
