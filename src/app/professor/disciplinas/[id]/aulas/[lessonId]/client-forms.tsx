"use client";

import { useActionState } from "react";
import { generateLessonContentAction, uploadMaterialAction } from "./actions";
import { Button, ErrorBanner, Input, Label } from "@/components/ui";

export function GenerateContentForm({
  disciplineId,
  lessonId,
  hasContent,
}: {
  disciplineId: string;
  lessonId: string;
  hasContent: boolean;
}) {
  const [state, action, pending] = useActionState(generateLessonContentAction, null);

  return (
    <form action={action} className="space-y-2">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Gerando conteúdo, atividades e slides…"
          : hasContent
            ? "Regerar com IA (substitui rascunho)"
            : "Gerar conteúdo + atividades + slides com IA"}
      </Button>
      <p className="text-xs text-gray-400">
        Deriva do tema/objetivos da aula, unidades cobertas, bibliografia vinculada e materiais
        anexados. O slide final recebe a bibliografia automaticamente.
      </p>
    </form>
  );
}

export function UploadMaterialForm({
  disciplineId,
  lessonId,
}: {
  disciplineId: string;
  lessonId: string;
}) {
  const [state, action, pending] = useActionState(uploadMaterialAction, null);

  return (
    <form action={action} className="space-y-2">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <div>
        <Label>Arquivo (PDF, PPTX, imagem)</Label>
        <Input name="file" type="file" accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp" required />
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Anexar material"}
      </Button>
      <p className="text-xs text-gray-400">
        PDFs têm o texto extraído e alimentam a IA (atividades, provas e tutor).
      </p>
    </form>
  );
}
