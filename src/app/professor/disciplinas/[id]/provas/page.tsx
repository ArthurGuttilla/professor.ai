import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { createEmptyExamAction } from "./actions";
import { GenerateExamForm } from "./generate-form";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageTitle,
  Select,
  StateBadge,
} from "@/components/ui";

const KIND_LABEL: Record<string, string> = {
  ENADE_EXAM: "ENADE",
  TRADITIONAL_EXAM: "Tradicional",
  GRADED_ACTIVITY: "Atividade avaliativa",
};

export default async function ProvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "draft");

  const [exams, units] = await Promise.all([
    prisma.exam.findMany({
      where: { disciplineId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true, submissions: true } },
        rubric: { include: { _count: { select: { criteria: true } } } },
      },
    }),
    prisma.programUnit.findMany({
      where: { teachingPlan: { disciplineId: id } },
      orderBy: { order: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle sub="Provas formato ENADE com rubrica obrigatória. Export em PDF (3 modos) na página da prova.">
        Provas e avaliações
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {exams.length === 0 ? (
            <EmptyState>Nenhuma prova criada.</EmptyState>
          ) : (
            exams.map((e) => (
              <Link key={e.id} href={`/professor/disciplinas/${id}/provas/${e.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge color="purple">{KIND_LABEL[e.kind]}</Badge>
                    <StateBadge state={e.status} />
                    {!e.rubric || e.rubric._count.criteria === 0 ? (
                      <Badge color="red">Sem rubrica</Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-1 font-medium text-gray-900">{e.title}</h2>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {e._count.questions} questão(ões) · {e.totalPoints} pts ·{" "}
                    {e._count.submissions} prova(s) recebida(s)
                  </p>
                </Card>
              </Link>
            ))
          )}
        </div>

        {canEdit ? (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Gerar com IA</h2>
              <GenerateExamForm disciplineId={id} units={units} />
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Criar vazia (montar do banco)</h2>
              <form action={createEmptyExamAction} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <div>
                  <Label>Título</Label>
                  <Input name="title" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Formato</Label>
                    <Select name="kind" className="w-full">
                      <option value="TRADITIONAL_EXAM">Tradicional</option>
                      <option value="ENADE_EXAM">ENADE</option>
                      <option value="GRADED_ACTIVITY">Atividade avaliativa</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Pontos</Label>
                    <Input name="totalPoints" type="number" min={1} defaultValue={10} />
                  </div>
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Criar
                </Button>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
