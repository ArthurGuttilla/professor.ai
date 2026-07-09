import { notFound } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { publicUrl, qrDataUrl } from "@/lib/qr";
import {
  addQuestionToActivityAction,
  deleteActivityAction,
  gradeEssayAnswerAction,
  openLiveRoomAction,
  removeQuestionFromActivityAction,
  toggleActivityPublishAction,
  updateActivityAction,
} from "../actions";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PageTitle,
  StateBadge,
} from "@/components/ui";

/* eslint-disable @next/next/no-img-element */

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "draft");
  const canPublish = can(role, "publish");
  const canValidate = can(role, "validate");

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, disciplineId: id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { question: true } },
      attempts: {
        orderBy: { score: "desc" },
        include: { student: true, answers: { include: {} } },
      },
    },
  });
  if (!activity) notFound();

  const availableQuestions = await prisma.question.findMany({
    where: {
      disciplineId: id,
      reviewedAt: { not: null },
      id: { notIn: activity.questions.map((q) => q.questionId) },
      ...(activity.kind === "QUIZ_LIVE" ? { type: { not: "ESSAY" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const questionById = new Map(activity.questions.map((aq) => [aq.questionId, aq.question]));
  const joinUrl = activity.joinCode
    ? `${process.env.APP_URL ?? "http://localhost:3000"}/quiz/${activity.joinCode}`
    : null;
  const joinQr = joinUrl ? await qrDataUrl(joinUrl) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle
          sub={`${activity.kind === "QUIZ_LIVE" ? "Quiz ao vivo" : activity.kind === "QUIZ_ASYNC" ? "Quiz assíncrono" : "Atividade"} · ${activity.questions.length} questão(ões)`}
        >
          {activity.title}
        </PageTitle>
        <div className="flex items-center gap-2">
          <StateBadge state={activity.status} />
          {canPublish ? (
            <form action={toggleActivityPublishAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="activityId" value={activityId} />
              <Button variant="secondary" type="submit">
                {activity.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
              </Button>
            </form>
          ) : null}
          {canEdit && activity.status === "DRAFT" ? (
            <form action={deleteActivityAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="activityId" value={activityId} />
              <Button variant="danger" type="submit">
                Excluir
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Questões da atividade */}
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Questões</h2>
            {activity.questions.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma questão. Adicione do banco (apenas questões revisadas aparecem).
              </p>
            ) : (
              <ol className="space-y-2">
                {activity.questions.map((aq, i) => (
                  <li key={aq.id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-gray-400">Q{i + 1}</span>
                        <p className="text-sm text-gray-800">{aq.question.statement}</p>
                        <Badge color="gray">{aq.question.type === "ESSAY" ? "Dissertativa" : aq.question.type === "TRUE_FALSE" ? "V/F" : "Múltipla escolha"}</Badge>
                      </div>
                      {canEdit ? (
                        <form action={removeQuestionFromActivityAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="activityId" value={activityId} />
                          <input type="hidden" name="questionId" value={aq.questionId} />
                          <Button variant="ghost" type="submit">
                            ✕
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Banco disponível */}
          {canEdit ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Adicionar do banco</h2>
              {availableQuestions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhuma questão revisada disponível. Crie/aprove no Banco de questões.
                </p>
              ) : (
                <ul className="space-y-2">
                  {availableQuestions.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-gray-100 p-2"
                    >
                      <p className="text-sm text-gray-700">{q.statement}</p>
                      <form action={addQuestionToActivityAction}>
                        <input type="hidden" name="disciplineId" value={id} />
                        <input type="hidden" name="activityId" value={activityId} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <Button variant="secondary" type="submit">
                          +
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {/* Resultados/tentativas */}
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">
              Resultados ({activity.attempts.length} tentativa(s))
            </h2>
            {activity.attempts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma tentativa ainda.</p>
            ) : (
              <div className="space-y-3">
                {activity.attempts.map((att, rank) => (
                  <div key={att.id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        #{rank + 1} {att.student.name ?? att.student.email}
                      </p>
                      <Badge color="blue">{Math.round(att.score)} pts</Badge>
                    </div>
                    {/* Dissertativas para correção manual */}
                    {att.answers
                      .filter((ans) => questionById.get(ans.questionId)?.type === "ESSAY")
                      .map((ans) => (
                        <div key={ans.id} className="mt-2 rounded bg-gray-50 p-2">
                          <p className="text-xs text-gray-500">
                            {questionById.get(ans.questionId)?.statement}
                          </p>
                          <p className="mt-1 text-sm text-gray-800">{ans.answer}</p>
                          {canValidate ? (
                            <form
                              action={gradeEssayAnswerAction}
                              className="mt-2 flex items-center gap-2"
                            >
                              <input type="hidden" name="disciplineId" value={id} />
                              <input type="hidden" name="answerId" value={ans.id} />
                              <Input
                                name="points"
                                type="number"
                                step="0.5"
                                min={0}
                                defaultValue={ans.points}
                                className="!w-24"
                              />
                              <Button variant="secondary" type="submit">
                                Atribuir pontos
                              </Button>
                            </form>
                          ) : (
                            <p className="mt-1 text-xs text-gray-400">{ans.points} pts</p>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Configuração */}
          {canEdit ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Configuração</h2>
              <form action={updateActivityAction} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <input type="hidden" name="activityId" value={activityId} />
                <div>
                  <Label>Título</Label>
                  <Input name="title" defaultValue={activity.title} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input
                      name="startsAt"
                      type="datetime-local"
                      defaultValue={activity.startsAt?.toISOString().slice(0, 16)}
                    />
                  </div>
                  <div>
                    <Label>Entrega</Label>
                    <Input
                      name="dueAt"
                      type="datetime-local"
                      defaultValue={activity.dueAt?.toISOString().slice(0, 16)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tentativas</Label>
                    <Input
                      name="maxAttempts"
                      type="number"
                      min={1}
                      defaultValue={activity.maxAttempts}
                    />
                  </div>
                  <div>
                    <Label>Tempo/questão (s)</Label>
                    <Input
                      name="timePerQuestionSec"
                      type="number"
                      min={5}
                      defaultValue={activity.timePerQuestionSec}
                    />
                  </div>
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Salvar
                </Button>
              </form>
            </Card>
          ) : null}

          {/* Sala ao vivo */}
          {activity.kind === "QUIZ_LIVE" && activity.joinCode ? (
            <Card className="text-center">
              <h2 className="mb-2 font-semibold text-gray-900">Sala ao vivo</h2>
              <p className="text-3xl font-bold tracking-widest text-brand">{activity.joinCode}</p>
              {joinQr ? <img src={joinQr} alt="QR da sala" className="mx-auto mt-3 h-36 w-36" /> : null}
              {joinUrl ? <p className="mt-1 break-all text-xs text-gray-400">{joinUrl}</p> : null}
              {canEdit ? (
                <form action={openLiveRoomAction} className="mt-3">
                  <input type="hidden" name="disciplineId" value={id} />
                  <input type="hidden" name="activityId" value={activityId} />
                  <Button type="submit" className="w-full" disabled={activity.questions.length === 0}>
                    Abrir sala e apresentar
                  </Button>
                </form>
              ) : null}
              <p className="mt-2 text-xs text-gray-400">
                Alunos entram com o código/QR. Pontuação por acerto + velocidade, ranking ao vivo.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
