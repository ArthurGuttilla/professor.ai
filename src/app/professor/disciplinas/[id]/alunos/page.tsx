import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { enrollStudentsAction, unenrollStudentAction } from "./actions";
import { Button, Card, EmptyState, Label, PageTitle, Textarea } from "@/components/ui";

export default async function StudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = role !== null;

  const enrollments = await prisma.enrollment.findMany({
    where: { disciplineId: id },
    include: { student: true },
    orderBy: { student: { name: "asc" } },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PageTitle sub="Alunos matriculados nesta disciplina.">Alunos</PageTitle>
        {enrollments.length === 0 ? (
          <EmptyState>Nenhum aluno matriculado. Adicione pela lista ao lado.</EmptyState>
        ) : (
          <Card>
            <ul className="divide-y divide-gray-100">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {e.student.name ?? e.student.email}
                    </span>{" "}
                    <span className="text-xs text-gray-400">
                      {e.student.email}
                      {e.student.registration ? ` · mat. ${e.student.registration}` : ""}
                    </span>
                  </div>
                  {canEdit ? (
                    <form action={unenrollStudentAction}>
                      <input type="hidden" name="disciplineId" value={id} />
                      <input type="hidden" name="enrollmentId" value={e.id} />
                      <Button variant="ghost" type="submit">
                        Remover
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {canEdit ? (
        <div>
          <PageTitle>Matricular alunos</PageTitle>
          <Card>
            <form action={enrollStudentsAction} className="space-y-3">
              <input type="hidden" name="disciplineId" value={id} />
              <div>
                <Label>Um aluno por linha</Label>
                <Textarea
                  name="list"
                  rows={8}
                  placeholder={"email@aluno.edu;Nome;Matrícula\nmaria@aluno.edu;Maria Silva;2026010"}
                />
              </div>
              <Button type="submit" className="w-full">
                Matricular
              </Button>
              <p className="text-xs text-gray-400">
                Formato: e-mail;nome;matrícula (nome e matrícula opcionais). O aluno acessa com o
                e-mail cadastrado.
              </p>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
