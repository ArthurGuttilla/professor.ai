import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { createDisciplineAction } from "./actions";
import { Button, Card, EmptyState, Input, Label, PageTitle } from "@/components/ui";

export default async function AdminHome() {
  const admin = await requireAdmin();
  const disciplines = await prisma.discipline.findMany({
    where: { institutionId: admin.institutionId },
    include: {
      memberships: { include: { user: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PageTitle sub="Disciplinas da instituição e seus vínculos.">Disciplinas</PageTitle>
        {disciplines.length === 0 ? (
          <EmptyState>Nenhuma disciplina criada ainda. Crie a primeira ao lado.</EmptyState>
        ) : (
          <div className="space-y-3">
            {disciplines.map((d) => (
              <Link key={d.id} href={`/admin/disciplinas/${d.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-gray-900">{d.name}</h2>
                      <p className="text-sm text-gray-500">
                        {d.course} · {d.term} · {d.workloadHours}h · {d._count.enrollments} aluno(s)
                      </p>
                    </div>
                    <p className="text-right text-xs text-gray-400">
                      {d.memberships.filter((m) => m.role === "PROFESSOR").length}/2 professores
                      <br />
                      {d.memberships.filter((m) => m.role === "ASSISTANT").length}/2 assistentes
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <PageTitle>Nova disciplina</PageTitle>
        <Card>
          <form action={createDisciplineAction} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input name="name" required placeholder="Introdução à Programação" />
            </div>
            <div>
              <Label>Curso</Label>
              <Input name="course" required placeholder="Ciência da Computação" />
            </div>
            <div>
              <Label>Período</Label>
              <Input name="term" required placeholder="2026.2" />
            </div>
            <div>
              <Label>Carga horária (h)</Label>
              <Input name="workloadHours" type="number" min={1} required placeholder="60" />
            </div>
            <Button type="submit" className="w-full">
              Criar disciplina
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
