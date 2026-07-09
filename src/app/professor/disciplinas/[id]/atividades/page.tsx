import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { createActivityAction } from "./actions";
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
  QUIZ_LIVE: "Quiz ao vivo",
  QUIZ_ASYNC: "Quiz assíncrono",
  ACTIVITY: "Atividade",
};

export default async function AtividadesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "draft");

  const [activities, lessons] = await Promise.all([
    prisma.activity.findMany({
      where: { disciplineId: id },
      orderBy: { createdAt: "desc" },
      include: {
        lesson: { select: { number: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
    prisma.lesson.findMany({
      where: { lessonPlan: { teachingPlan: { disciplineId: id } }, isAssessment: false },
      orderBy: { number: "asc" },
      select: { id: true, number: true, theme: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle sub="Quiz gamificado (ao vivo ou assíncrono) e atividades tradicionais, com questões do banco ou geradas por IA.">
        Atividades
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {activities.length === 0 ? (
            <EmptyState>Nenhuma atividade criada.</EmptyState>
          ) : (
            activities.map((a) => (
              <Link
                key={a.id}
                href={`/professor/disciplinas/${id}/atividades/${a.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge color={a.kind === "QUIZ_LIVE" ? "purple" : "blue"}>
                          {KIND_LABEL[a.kind]}
                        </Badge>
                        <StateBadge state={a.status} />
                        {a.lesson ? <Badge color="gray">Aula {a.lesson.number}</Badge> : null}
                      </div>
                      <h2 className="mt-1 font-medium text-gray-900">{a.title}</h2>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {a._count.questions} questão(ões) · {a._count.attempts} tentativa(s)
                        {a.dueAt
                          ? ` · entrega ${a.dueAt.toLocaleDateString("pt-BR")}`
                          : ""}
                        {a.joinCode ? ` · sala ${a.joinCode}` : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>

        {canEdit ? (
          <div>
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Nova atividade</h2>
              <form action={createActivityAction} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <div>
                  <Label>Título</Label>
                  <Input name="title" required placeholder="Quiz — Aula 3" />
                </div>
                <div>
                  <Label>Formato</Label>
                  <Select name="kind" className="w-full">
                    <option value="QUIZ_LIVE">Quiz ao vivo (Kahoot-like)</option>
                    <option value="QUIZ_ASYNC">Quiz assíncrono</option>
                    <option value="ACTIVITY">Atividade (lista de questões)</option>
                  </Select>
                </div>
                <div>
                  <Label>Aula vinculada (opcional)</Label>
                  <Select name="lessonId" className="w-full">
                    <option value="">Nenhuma</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        Aula {l.number} — {l.theme}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input name="startsAt" type="datetime-local" />
                  </div>
                  <div>
                    <Label>Entrega</Label>
                    <Input name="dueAt" type="datetime-local" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tentativas</Label>
                    <Input name="maxAttempts" type="number" min={1} defaultValue={1} />
                  </div>
                  <div>
                    <Label>Tempo/questão (s)</Label>
                    <Input name="timePerQuestionSec" type="number" min={5} defaultValue={30} />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Criar
                </Button>
                <p className="text-xs text-gray-400">
                  Início e entrega são obrigatórios para publicar quiz assíncrono/atividade.
                </p>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
