"use client";

import { useActionState } from "react";
import { addSuggestionAction, suggestBibliographyAction } from "./actions";
import { Badge, Button, Card, ErrorBanner } from "@/components/ui";

export function SuggestPanel({ disciplineId }: { disciplineId: string }) {
  const [state, action, pending] = useActionState(suggestBibliographyAction, null);

  return (
    <div className="space-y-4">
      <form action={action}>
        <input type="hidden" name="disciplineId" value={disciplineId} />
        <Button type="submit" disabled={pending}>
          {pending ? "Sugerindo e verificando…" : "Sugerir bibliografia com IA"}
        </Button>
        <p className="mt-2 text-xs text-gray-400">
          Mín. 3 básicas + 5 complementares, coerentes com a ementa. Cada sugestão passa por
          verificação de existência em catálogo aberto — itens não verificados exigem sua
          confirmação explícita.
        </p>
      </form>

      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      {state?.suggestions ? (
        <div className="space-y-3">
          {state.suggestions.map((s, i) => (
            <Card key={i} className="!p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={s.kind === "BASIC" ? "blue" : "gray"}>
                  {s.kind === "BASIC" ? "Básica" : "Complementar"}
                </Badge>
                {s.verified ? (
                  <Badge color="green">Verificada</Badge>
                ) : (
                  <Badge color="yellow">Não verificada</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-800">
                <strong>{s.title}</strong>
              </p>
              <p className="text-sm text-gray-600">
                {s.authors}
                {s.publisher ? ` · ${s.publisher}` : ""}
                {s.year ? ` · ${s.year}` : ""}
                {s.isbn ? ` · ISBN ${s.isbn}` : ""}
              </p>
              {s.verified && s.provenance ? (
                <p className="mt-1 text-xs text-green-700">Fonte: {s.provenance}</p>
              ) : (
                <p className="mt-1 text-xs text-yellow-700">{s.verifyNote}</p>
              )}
              <form action={addSuggestionAction} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="disciplineId" value={disciplineId} />
                <input type="hidden" name="kind" value={s.kind} />
                <input type="hidden" name="authors" value={s.authors} />
                <input type="hidden" name="title" value={s.title} />
                <input type="hidden" name="publisher" value={s.publisher ?? ""} />
                <input type="hidden" name="year" value={s.year ?? ""} />
                <input type="hidden" name="isbn" value={s.isbn ?? ""} />
                <input type="hidden" name="edition" value={s.edition ?? ""} />
                <input type="hidden" name="verified" value={String(s.verified)} />
                <input type="hidden" name="provenance" value={s.provenance ?? ""} />
                {!s.verified ? (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" name="confirmExists" required />
                    Confirmo que esta obra existe
                  </label>
                ) : null}
                <Button type="submit" variant="secondary">
                  Adicionar à bibliografia
                </Button>
              </form>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
