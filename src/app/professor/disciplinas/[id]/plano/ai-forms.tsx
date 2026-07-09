"use client";

import { useActionState } from "react";
import { generatePlanAction, importPlanAction } from "./actions";
import { Button, ErrorBanner, Input, Label, Textarea } from "@/components/ui";

export function GeneratePlanForm({ disciplineId }: { disciplineId: string }) {
  const [state, action, pending] = useActionState(generatePlanAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div>
        <Label>Contexto adicional (opcional)</Label>
        <Textarea
          name="extraContext"
          rows={3}
          placeholder="Ênfases, perfil da turma, abordagem preferida…"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Gerando plano…" : "Gerar plano com IA"}
      </Button>
      <p className="text-xs text-gray-400">
        Usa nome, curso, carga horária e período da disciplina. Gera ementa, objetivos
        (taxonomia de Bloom), unidades, metodologia e critérios no formato MEC.
      </p>
    </form>
  );
}

export function ImportPlanForm({ disciplineId }: { disciplineId: string }) {
  const [state, action, pending] = useActionState(importPlanAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div>
        <Label>Arquivo do plano (PDF ou DOCX)</Label>
        <Input name="file" type="file" accept=".pdf,.docx" required />
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Importando e estruturando…" : "Importar plano existente"}
      </Button>
      <p className="text-xs text-gray-400">
        O texto é extraído e mapeado automaticamente para os campos MEC. Revise após importar.
      </p>
    </form>
  );
}
