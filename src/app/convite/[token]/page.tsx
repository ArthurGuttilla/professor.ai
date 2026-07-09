import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { AcceptForm } from "./accept-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { discipline: true, institution: true },
  });

  if (!invite || invite.status !== "PENDING") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Card>
          <p className="text-center text-sm text-gray-600">
            Convite inválido, revogado ou já utilizado.
          </p>
        </Card>
      </main>
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      institutionId_email: { institutionId: invite.institutionId, email: invite.email },
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-center text-3xl font-bold text-brand">professor.ai</h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        Você foi convidado(a) para atuar como{" "}
        <strong>{invite.role === "PROFESSOR" ? "Professor(a)" : "Assistente"}</strong> em{" "}
        <strong>{invite.discipline.name}</strong> ({invite.institution.name}).
      </p>
      <Card>
        <p className="mb-4 text-sm text-gray-600">
          Convite para <strong>{invite.email}</strong>.
          {existingUser
            ? " Sua conta já existe — basta aceitar."
            : " Crie sua conta para aceitar."}
        </p>
        <AcceptForm token={token} needsAccount={!existingUser} />
      </Card>
    </main>
  );
}
