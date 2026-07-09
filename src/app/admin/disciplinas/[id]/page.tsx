import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { removeMembershipAction, revokeInviteAction } from "@/app/admin/actions";
import { InviteForm } from "./invite-form";
import { Badge, Button, Card, PageTitle } from "@/components/ui";

export default async function AdminDisciplinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();

  const discipline = await prisma.discipline.findFirst({
    where: { id, institutionId: admin.institutionId },
    include: {
      memberships: { include: { user: true } },
      invites: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!discipline) notFound();

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <PageTitle
        sub={`${discipline.course} · ${discipline.term} · ${discipline.workloadHours}h · ${discipline._count.enrollments} aluno(s)`}
      >
        {discipline.name}
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Vínculos ativos</h2>
            {discipline.memberships.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum professor ou assistente vinculado.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {discipline.memberships.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {m.user.name ?? m.user.email}
                      </span>{" "}
                      <span className="text-xs text-gray-400">{m.user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={m.role === "PROFESSOR" ? "blue" : "purple"}>
                        {m.role === "PROFESSOR" ? "Professor" : "Assistente"}
                      </Badge>
                      <form action={removeMembershipAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <Button variant="ghost" type="submit">
                          Remover
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Convites pendentes</h2>
            {discipline.invites.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum convite pendente.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {discipline.invites.map((inv) => (
                  <li key={inv.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{inv.email}</span>{" "}
                        <Badge color={inv.role === "PROFESSOR" ? "blue" : "purple"}>
                          {inv.role === "PROFESSOR" ? "Professor" : "Assistente"}
                        </Badge>
                      </div>
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="inviteId" value={inv.id} />
                        <Button variant="ghost" type="submit">
                          Revogar
                        </Button>
                      </form>
                    </div>
                    <p className="mt-1 break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500">
                      {appUrl}/convite/{inv.token}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Envie este link para a pessoa convidada (envio de e-mail: P1).
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Convidar por e-mail</h2>
            <InviteForm disciplineId={discipline.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
