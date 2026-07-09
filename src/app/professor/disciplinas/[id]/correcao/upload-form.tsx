"use client";

import { useActionState } from "react";
import { runAiGradingAction, uploadSubmissionsAction } from "./actions";
import { Button, ErrorBanner, Input, Label, Select } from "@/components/ui";

export function UploadSubmissionsForm({
  disciplineId,
  exams,
}: {
  disciplineId: string;
  exams: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(uploadSubmissionsAction, null);

  return (
    <form action={action} className="space-y-3">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state?.ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>
      ) : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div>
        <Label>Prova</Label>
        <Select name="examId" className="w-full" required>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Arquivos (scan PDF, foto ou digital) — pode selecionar vários</Label>
        <Input name="files" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando e lendo provas…" : "Subir provas em lote"}
      </Button>
      <p className="text-xs text-gray-400">
        OCR lê o cabeçalho (nome/matrícula) e transcreve respostas; o vínculo ao aluno é sugerido
        e você confirma. Sem OCR, vínculo e transcrição podem ser manuais.
      </p>
    </form>
  );
}

export function RunAiGradingButton({
  disciplineId,
  submissionId,
}: {
  disciplineId: string;
  submissionId: string;
}) {
  const [state, action, pending] = useActionState(runAiGradingAction, null);

  return (
    <form action={action} className="space-y-2">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state?.ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>
      ) : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Corrigindo por rubrica…" : "Corrigir com IA (rubrica)"}
      </Button>
    </form>
  );
}
