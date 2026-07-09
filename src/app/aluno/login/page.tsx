"use client";

import { useActionState } from "react";
import Link from "next/link";
import { studentLoginAction } from "./actions";
import { Button, Card, ErrorBanner, Input, Label } from "@/components/ui";

export default function StudentLoginPage() {
  const [state, action, pending] = useActionState(studentLoginAction, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-center text-3xl font-bold text-brand">professor.ai</h1>
      <p className="mb-8 text-center text-sm text-gray-500">Área do aluno</p>
      <Card>
        <form action={action} className="space-y-4">
          {state?.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
          <div>
            <Label>E-mail institucional</Label>
            <Input name="email" type="email" required placeholder="voce@aluno.instituicao.edu" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-gray-500">
        É professor?{" "}
        <Link href="/login" className="text-brand underline">
          Acesse por aqui
        </Link>
      </p>
    </main>
  );
}
