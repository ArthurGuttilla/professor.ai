"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/app/admin/actions";
import { Button, ErrorBanner, Input, Label, Select } from "@/components/ui";

export function InviteForm({ disciplineId }: { disciplineId: string }) {
  const [state, action, pending] = useActionState(inviteMemberAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state?.ok ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {state.ok}
        </div>
      ) : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div>
        <Label>E-mail</Label>
        <Input name="email" type="email" required placeholder="professor@instituicao.edu" />
      </div>
      <div>
        <Label>Papel</Label>
        <Select name="role" className="w-full" defaultValue="PROFESSOR">
          <option value="PROFESSOR">Professor</option>
          <option value="ASSISTANT">Assistente/Monitor</option>
        </Select>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Convidar"}
      </Button>
      <p className="text-xs text-gray-400">
        Limite: máx. 2 professores e 2 assistentes por disciplina (convites pendentes ocupam
        vaga).
      </p>
    </form>
  );
}
