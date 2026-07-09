import Link from "next/link";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { studentLogoutAction } from "./login/actions";
import { Badge, Button, Card, EmptyState } from "@/components/ui";

/**
 * Painel do aluno (PRD M8): notas por avaliação, acumulado por disciplina,
 * visão do semestre e próximas entregas. Só dados LIBERADOS aparecem.
 */
export default async function AlunoHome() {
  const student = await requireStudent();

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    include: {
      discipline: {
        include: {
          exams: {
            where: { status: "PUBLISHED" },
            include: {
              submissions: {
                where: { studentId: student.id, status: "RELEASED" },
              },
            },
          },
          activities: {
            where: { status: "PUBLISHED", dueAt: { gte: new Date() } },
            orderBy: { dueAt: "asc" },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Olá, {student.name ?? student.email}</h1>
          <p className="text-sm text-gray-500">{student.institution.name} · seu semestre</p>
        </div>
        <form action={studentLogoutAction}>
          <Button variant="ghost" type="submit">
            Sair
          </Button>
        </form>
      </div>

      {/* Próximas entregas */}
      <h2 className="mb-2 font-semibold text-gray-900">Próximas entregas</h2>
      {enrollments.flatMap((e) => e.discipline.activities).length === 0 ? (
        <EmptyState>Nenhuma entrega próxima. 🎉</EmptyState>
      ) : (
        <div className="space-y-2">
          {enrollments
            .flatMap((e) =>
              e.discipline.activities.map((a) => ({ activity: a, discipline: e.discipline })),
            )
            .sort((a, b) => (a.activity.dueAt?.getTime() ?? 0) - (b.activity.dueAt?.getTime() ?? 0))
            .slice(0, 6)
            .map(({ activity, discipline }) => (
              <Link key={activity.id} href={`/aluno/atividades/${activity.id}`} className="block">
                <Card className="!p-3 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-400">{discipline.name}</p>
                    </div>
                    <Badge color="yellow">
                      até {activity.dueAt?.toLocaleDateString("pt-BR")}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
      )}

      {/* Disciplinas + notas */}
      <h2 className="mb-2 mt-8 font-semibold text-gray-900">Minhas disciplinas</h2>
      {enrollments.length === 0 ? (
        <EmptyState>Você não está matriculado(a) em nenhuma disciplina.</EmptyState>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => {
            const released = e.discipline.exams.flatMap((x) =>
              x.submissions.map((s) => ({ exam: x, submission: s })),
            );
            const earned = released.reduce((acc, r) => acc + (r.submission.finalTotal ?? 0), 0);
            const possible = released.reduce((acc, r) => acc + r.exam.totalPoints, 0);
            return (
              <Link key={e.id} href={`/aluno/disciplinas/${e.disciplineId}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{e.discipline.name}</h3>
                      <p className="text-xs text-gray-400">
                        {e.discipline.course} · {e.discipline.term}
                      </p>
                    </div>
                    {possible > 0 ? (
                      <div className="text-right">
                        <p className="text-lg font-bold text-brand">
                          {((earned / possible) * 10).toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {earned.toFixed(1)}/{possible} pts liberados
                        </p>
                      </div>
                    ) : (
                      <Badge color="gray">Sem notas liberadas</Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
