"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendTutorMessageAction } from "./actions";
import { Button, ErrorBanner } from "@/components/ui";

export function ChatForm({ disciplineId }: { disciplineId: string }) {
  const [state, action, pending] = useActionState(sendTutorMessageAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending) formRef.current?.reset();
  }, [pending]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <div className="flex gap-2">
        <input
          name="question"
          required
          maxLength={2000}
          disabled={pending}
          placeholder="Pergunte sobre o conteúdo, sua correção ou prazos…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          autoComplete="off"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Enviar"}
        </Button>
      </div>
      {pending ? <p className="text-xs text-gray-400">O tutor está pensando…</p> : null}
    </form>
  );
}
