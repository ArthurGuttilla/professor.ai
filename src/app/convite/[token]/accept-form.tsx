"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "./actions";
import { Button, ErrorBanner, Input, Label } from "@/components/ui";

export function AcceptForm({ token, needsAccount }: { token: string; needsAccount: boolean }) {
  const [state, action, pending] = useActionState(acceptInviteAction, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <input type="hidden" name="token" value={token} />
      {needsAccount ? (
        <>
          <div>
            <Label>Seu nome</Label>
            <Input name="name" required placeholder="Prof. Maria Silva" />
          </div>
          <div>
            <Label>Crie uma senha</Label>
            <Input name="password" type="password" required minLength={6} />
          </div>
        </>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Processando…" : needsAccount ? "Criar conta e aceitar" : "Aceitar convite"}
      </Button>
    </form>
  );
}
