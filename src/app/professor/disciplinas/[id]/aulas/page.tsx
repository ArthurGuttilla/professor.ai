import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { checkAlignment } from "@/modules/m3-lesson-plan/calendar";
import {
  mergeLessonAction,
  moveLessonAction,
  splitLessonAction,
} from "./actions";
import { GenerateLessonPlanForm } from "./generate-form";
import { Badge, Button, Card, EmptyState, PageTitle } from "@/components/ui";

export default async function AulasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "editPlan");

  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId: id },
    include: {
      programUnits: { orderBy: { order: "asc" } },
      lessonPlan: {
        include: {
          lessons: {
            orderBy: { number: "asc" },
            include: {
              unitLinks: { include: { programUnit: true } },
              content: { select: { status: true } },
              slideDeck: { select: { status: true } },
              _count: { select: { materials: true, activities: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    return <EmptyState>Crie o plano de ensino primeiro (aba Plano de ensino).</EmptyState>;
  }

  const lessons = plan.lessonPlan?.lessons ?? [];
  const teachable = lessons.filter((l) => !l.isAssessment).length;
  const alignment = plan.lessonPlan
    ? checkAlignment(plan.programUnits.length, teachable)
    : { ok: true as const };

  return (
    <div className="space-y-6">
      <PageTitle sub="Distribuição do conteúdo programático pelo calendário do semestre. Datas fixas; o conteúdo pode ser movido, mesclado ou dividido.">
        Plano aula a aula
      </PageTitle>

      {!alignment.ok ? (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <strong>Desalinhamento:</strong> {alignment.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {lessons.length === 0 ? (
            <EmptyState>
              Nenhuma grade gerada ainda. Informe o calendário do semestre ao lado.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {lessons.map((l, idx) => (
                <Card key={l.id} className={`!p-4 ${l.isAssessment ? "bg-amber-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color={l.isAssessment ? "yellow" : "blue"}>Aula {l.number}</Badge>
                        <span className="text-xs text-gray-400">
                          {l.date?.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </span>
                        {l.content?.status === "PUBLISHED" || l.slideDeck?.status === "PUBLISHED" ? (
                          <Badge color="green">Material publicado</Badge>
                        ) : null}
                      </div>
                      <Link
                        href={`/professor/disciplinas/${id}/aulas/${l.id}`}
                        className="mt-1 block font-medium text-gray-900 hover:text-brand hover:underline"
                      >
                        {l.theme}
                      </Link>
                      {l.objectives ? (
                        <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{l.objectives}</p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {l.unitLinks.map((u) => (
                          <Badge key={u.id} color="gray">
                            {u.programUnit.title.split("—")[0].trim()}
                          </Badge>
                        ))}
                        {l._count.materials > 0 ? (
                          <span className="text-xs text-gray-400">
                            {l._count.materials} material(is)
                          </span>
                        ) : null}
                        {l._count.activities > 0 ? (
                          <span className="text-xs text-gray-400">
                            {l._count.activities} atividade(s)
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center">
                        <form action={moveLessonAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="lessonId" value={l.id} />
                          <input type="hidden" name="dir" value="up" />
                          <Button variant="ghost" type="submit" disabled={idx === 0} title="Mover conteúdo para cima">↑</Button>
                        </form>
                        <form action={moveLessonAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="lessonId" value={l.id} />
                          <input type="hidden" name="dir" value="down" />
                          <Button variant="ghost" type="submit" disabled={idx === lessons.length - 1} title="Mover conteúdo para baixo">↓</Button>
                        </form>
                        <form action={mergeLessonAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="lessonId" value={l.id} />
                          <Button variant="ghost" type="submit" disabled={idx === lessons.length - 1} title="Mesclar com a próxima">⇥</Button>
                        </form>
                        <form action={splitLessonAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="lessonId" value={l.id} />
                          <Button variant="ghost" type="submit" disabled={idx === lessons.length - 1} title="Dividir em duas aulas">⑃</Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          {canEdit ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Calendário do semestre</h2>
              <GenerateLessonPlanForm disciplineId={id} hasExisting={lessons.length > 0} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
