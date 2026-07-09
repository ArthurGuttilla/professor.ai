"use client";

import { useActionState } from "react";
import { generateQuestionsAction } from "./actions";
import { Button, ErrorBanner, Input, Label, Select } from "@/components/ui";

export function GenerateQuestionsForm({
  disciplineId,
  lessons,
}: {
  disciplineId: string;
  lessons: { id: string; number: number; theme: string }[];
}) {
  const [state, action, pending] = useActionState(generateQuestionsAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state?.ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>
      ) : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div>
        <Label>Fonte do material</Label>
        <Select name="lessonId" className="w-full">
          <option value="">Plano de ensino (disciplina inteira)</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              Aula {l.number} — {l.theme}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quantidade</Label>
          <Input name="count" type="number" min={1} max={15} defaultValue={5} />
        </div>
        <div>
          <Label>Tema (opcional)</Label>
          <Input name="theme" placeholder="Laços de repetição" />
        </div>
      </div>
      <div>
        <Label>Tipos</Label>
        <div className="space-y-1 text-sm text-gray-700">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="types" value="MULTIPLE_CHOICE" defaultChecked />
            Múltipla escolha
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="types" value="TRUE_FALSE" />
            Verdadeiro/Falso
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="types" value="ESSAY" />
            Dissertativa
          </label>
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Gerando questões…" : "Gerar questões com IA"}
      </Button>
      <p className="text-xs text-gray-400">
        Baseadas nos materiais da aula selecionada. Questões geradas exigem sua revisão antes de
        serem usadas em atividades ou provas.
      </p>
    </form>
  );
}
