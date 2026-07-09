"use client";

import { useActionState } from "react";
import { generateExamAction } from "./actions";
import { Button, ErrorBanner, Input, Label, Select } from "@/components/ui";

export function GenerateExamForm({
  disciplineId,
  units,
}: {
  disciplineId: string;
  units: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(generateExamAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div>
        <Label>Título</Label>
        <Input name="title" required placeholder="Prova 1 — Unidades 1 e 2" />
      </div>
      <div>
        <Label>Formato da avaliação</Label>
        <Select name="kind" className="w-full">
          <option value="ENADE_EXAM">Prova ENADE</option>
          <option value="TRADITIONAL_EXAM">Prova tradicional</option>
          <option value="GRADED_ACTIVITY">Atividade avaliativa</option>
        </Select>
      </div>
      <div>
        <Label>Escopo (nenhuma selecionada = disciplina inteira)</Label>
        <div className="max-h-32 space-y-1 overflow-y-auto text-sm text-gray-700">
          {units.map((u) => (
            <label key={u.id} className="flex items-center gap-1.5">
              <input type="checkbox" name="unitIds" value={u.id} />
              {u.title}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Múlt. escolha</Label>
          <Input name="mcCount" type="number" min={0} max={12} defaultValue={4} />
        </div>
        <div>
          <Label>Discursivas</Label>
          <Input name="essayCount" type="number" min={0} max={5} defaultValue={1} />
        </div>
        <div>
          <Label>Pontos</Label>
          <Input name="totalPoints" type="number" min={1} defaultValue={10} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Gerando prova e rubrica…" : "Gerar prova com IA"}
      </Button>
      <p className="text-xs text-gray-400">
        Questões no estilo do formato escolhido + rubrica (critérios, descrição e pontos) geradas
        juntas. Revise as questões antes de publicar.
      </p>
    </form>
  );
}
