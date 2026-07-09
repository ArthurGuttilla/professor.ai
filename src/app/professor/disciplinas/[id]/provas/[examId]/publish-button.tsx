"use client";

import { useActionState } from "react";
import { toggleExamPublishAction } from "../actions";
import { Button, ErrorBanner } from "@/components/ui";

export function PublishExamButton({
  disciplineId,
  examId,
  published,
}: {
  disciplineId: string;
  examId: string;
  published: boolean;
}) {
  const [state, action, pending] = useActionState(toggleExamPublishAction, null);

  return (
    <form action={action} className="space-y-2">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <input type="hidden" name="examId" value={examId} />
      <Button variant="secondary" type="submit" disabled={pending}>
        {pending ? "…" : published ? "Despublicar" : "Publicar prova"}
      </Button>
    </form>
  );
}
