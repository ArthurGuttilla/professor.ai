import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";

export default async function ProfessorHome() {
  const user = await requireUser();

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      discipline: {
        include: { _count: { select: { enrollments: true } }, teachingPlan: true },
      },
    },
  });

  return (
    <div>
      <PageTitle sub="Disciplinas em que você atua como professor(a) ou assistente.">
        Minhas disciplinas
      </PageTitle>

      {memberships.length === 0 ? (
        <EmptyState>
          Você ainda não está vinculado(a) a nenhuma disciplina. Peça ao administrador da sua
          instituição para enviar um convite.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map((m) => (
            <Link key={m.id} href={`/professor/disciplinas/${m.disciplineId}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <h2 className="font-semibold text-gray-900">{m.discipline.name}</h2>
                  <Badge color={m.role === "PROFESSOR" ? "blue" : "purple"}>
                    {m.role === "PROFESSOR" ? "Professor" : "Assistente"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {m.discipline.course} · {m.discipline.term} · {m.discipline.workloadHours}h
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  {m.discipline._count.enrollments} aluno(s) ·{" "}
                  {m.discipline.teachingPlan ? "Plano de ensino criado" : "Sem plano de ensino"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
