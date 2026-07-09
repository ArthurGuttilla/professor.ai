"use client";

import { useActionState } from "react";
import { generateLessonPlanAction } from "./actions";
import { Button, ErrorBanner, Input, Label, Textarea } from "@/components/ui";

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function GenerateLessonPlanForm({
  disciplineId,
  hasExisting,
}: {
  disciplineId: string;
  hasExisting: boolean;
}) {
  const [state, action, pending] = useActionState(generateLessonPlanAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {hasExisting ? (
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          Gerar novamente substitui a grade atual (incluindo edições manuais).
        </p>
      ) : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Início do semestre</Label>
          <Input name="startDate" type="date" required />
        </div>
        <div>
          <Label>Fim do semestre</Label>
          <Input name="endDate" type="date" required />
        </div>
      </div>
      <div>
        <Label>Dias de aula na semana</Label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" name="weekdays" value={d.value} />
              {d.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <Label>Feriados / datas bloqueadas (AAAA-MM-DD, um por linha)</Label>
        <Textarea name="holidays" rows={3} placeholder={"2026-09-07\n2026-10-12"} />
      </div>
      <div>
        <Label>Aulas reservadas para avaliações</Label>
        <Input name="assessmentCount" type="number" min={0} max={6} defaultValue={2} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Gerando grade…" : "Gerar grade aula a aula"}
      </Button>
      <p className="text-xs text-gray-400">
        O calendário é calculado (dias, feriados) e a IA distribui o conteúdo programático nas
        aulas letivas. Aulas de avaliação são reservadas automaticamente.
      </p>
    </form>
  );
}
