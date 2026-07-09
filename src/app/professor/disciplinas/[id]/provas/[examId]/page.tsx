import { notFound } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import {
  addCriterionAction,
  addQuestionToExamAction,
  deleteExamAction,
  removeCriterionAction,
  removeQuestionFromExamAction,
  reviewAllExamQuestionsAction,
} from "../actions";
import { PublishExamButton } from "./publish-button";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  LinkButton,
  PageTitle,
  Select,
  StateBadge,
} from "@/components/ui";

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string; examId: string }>;
}) {
  const { id, examId } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "draft");
  const canPublish = can(role, "publish");

  const exam = await prisma.exam.findFirst({
    where: { id: examId, disciplineId: id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { question: true } },
      rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
      _count: { select: { submissions: true } },
    },
  });
  if (!exam) notFound();

  const availableQuestions = canEdit
    ? await prisma.question.findMany({
        where: {
          disciplineId: id,
          reviewedAt: { not: null },
          id: { notIn: exam.questions.map((q) => q.questionId) },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const questionPoints = exam.questions.reduce((acc, q) => acc + q.points, 0);
  const rubricPoints = (exam.rubric?.criteria ?? []).reduce((acc, c) => acc + c.points, 0);
  const unreviewed = exam.questions.filter((q) => !q.question.reviewedAt).length;
  const essayQuestions = exam.questions.filter((q) => q.question.type === "ESSAY");
  const base = `/professor/disciplinas/${id}/provas/${examId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle
          sub={`${exam.totalPoints} pontos · questões somam ${questionPoints} · rubrica soma ${rubricPoints}`}
        >
          {exam.title}
        </PageTitle>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={exam.status} />
          {canPublish ? (
            <PublishExamButton
              disciplineId={id}
              examId={examId}
              published={exam.status === "PUBLISHED"}
            />
          ) : null}
          {canEdit && exam.status === "DRAFT" && exam._count.submissions === 0 ? (
            <form action={deleteExamAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="examId" value={examId} />
              <Button variant="danger" type="submit">
                Excluir
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Export em 3 modos (PRD M6 P0) */}
      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">Export em PDF</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton variant="secondary" href={`${base}/export?mode=prova`} target="_blank">
            PDF único (só a prova)
          </LinkButton>
          <LinkButton variant="secondary" href={`${base}/export?mode=completo`} target="_blank">
            PDF único com gabarito
          </LinkButton>
          <span className="inline-flex items-center gap-1">
            <LinkButton variant="secondary" href={`${base}/export?mode=prova`} target="_blank">
              2 PDFs: prova
            </LinkButton>
            <LinkButton variant="secondary" href={`${base}/export?mode=gabarito`} target="_blank">
              + gabarito
            </LinkButton>
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          O gabarito inclui o padrão de resposta das discursivas e a rubrica completa.
        </p>
      </Card>

      {unreviewed > 0 && canEdit ? (
        <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800">
            {unreviewed} questão(ões) gerada(s) por IA aguardando sua revisão.
          </p>
          <form action={reviewAllExamQuestionsAction}>
            <input type="hidden" name="disciplineId" value={id} />
            <input type="hidden" name="examId" value={examId} />
            <Button variant="secondary" type="submit">
              Revisei — aprovar todas
            </Button>
          </form>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Questões */}
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Questões</h2>
            <ol className="space-y-3">
              {exam.questions.map((eq, i) => {
                const q = eq.question;
                const options = (q.options as { key: string; text: string }[] | null) ?? [];
                return (
                  <li key={eq.id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-400">Q{i + 1}</span>
                          <Badge color="gray">{q.type === "ESSAY" ? "Discursiva" : "Múltipla escolha"}</Badge>
                          <Badge color="blue">{eq.points} pt(s)</Badge>
                          {!q.reviewedAt ? <Badge color="red">Não revisada</Badge> : null}
                        </div>
                        {q.baseText ? (
                          <p className="mt-1.5 text-xs italic text-gray-500">{q.baseText}</p>
                        ) : null}
                        <p className="mt-1 text-sm font-medium text-gray-900">{q.statement}</p>
                        {options.length > 0 ? (
                          <ul className="mt-1 space-y-0.5 text-sm">
                            {options.map((o) => (
                              <li
                                key={o.key}
                                className={o.key === q.correctKey ? "font-medium text-green-700" : "text-gray-600"}
                              >
                                {o.key}) {o.text} {o.key === q.correctKey ? "✓" : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {q.answerKey ? (
                          <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                            <strong>Padrão de resposta:</strong> {q.answerKey}
                          </p>
                        ) : null}
                      </div>
                      {canEdit && exam.status === "DRAFT" ? (
                        <form action={removeQuestionFromExamAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="examId" value={examId} />
                          <input type="hidden" name="questionId" value={q.id} />
                          <Button variant="ghost" type="submit">✕</Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Rubrica */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Rubrica (obrigatória)</h2>
              <Badge color={Math.abs(rubricPoints - exam.totalPoints) < 0.01 ? "green" : "yellow"}>
                {rubricPoints}/{exam.totalPoints} pts
              </Badge>
            </div>
            {(exam.rubric?.criteria ?? []).length === 0 ? (
              <p className="text-sm text-red-600">
                Sem critérios — a prova não pode ser publicada sem rubrica.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                    <th className="py-1.5">Critério</th>
                    <th>Descrição</th>
                    <th className="text-right">Pontos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {exam.rubric!.criteria.map((c) => {
                    const qIndex = exam.questions.findIndex((eq) => eq.questionId === c.questionId);
                    return (
                      <tr key={c.id} className="border-b border-gray-100 align-top">
                        <td className="py-2 font-medium text-gray-900">
                          {c.criterion}
                          {qIndex >= 0 ? (
                            <span className="ml-1 text-xs text-gray-400">(Q{qIndex + 1})</span>
                          ) : (
                            <span className="ml-1 text-xs text-gray-400">(geral)</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-600">{c.description}</td>
                        <td className="py-2 text-right tabular-nums">{c.points}</td>
                        <td className="py-2 text-right">
                          {canEdit && exam.status === "DRAFT" ? (
                            <form action={removeCriterionAction}>
                              <input type="hidden" name="disciplineId" value={id} />
                              <input type="hidden" name="examId" value={examId} />
                              <input type="hidden" name="criterionId" value={c.id} />
                              <Button variant="ghost" type="submit">✕</Button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {canEdit && exam.status === "DRAFT" ? (
              <form action={addCriterionAction} className="mt-4 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="disciplineId" value={id} />
                <input type="hidden" name="examId" value={examId} />
                <div>
                  <Label>Critério</Label>
                  <Input name="criterion" required placeholder="Argumentação" />
                </div>
                <div>
                  <Label>Pontos</Label>
                  <Input name="points" type="number" step="0.5" min={0} required />
                </div>
                <div className="sm:col-span-2">
                  <Label>Descrição</Label>
                  <Input name="description" placeholder="O que caracteriza atendimento pleno do critério" />
                </div>
                <div>
                  <Label>Questão discursiva (ou geral)</Label>
                  <Select name="questionId" className="w-full">
                    <option value="">Critério geral</option>
                    {essayQuestions.map((eq, i) => (
                      <option key={eq.questionId} value={eq.questionId}>
                        Q{exam.questions.indexOf(eq) + 1} — discursiva
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="secondary">Adicionar critério</Button>
                </div>
              </form>
            ) : null}
          </Card>
        </div>

        {/* Banco */}
        {canEdit && exam.status === "DRAFT" ? (
          <Card className="h-fit">
            <h2 className="mb-3 font-semibold text-gray-900">Adicionar do banco</h2>
            {availableQuestions.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma questão revisada disponível.</p>
            ) : (
              <ul className="space-y-2">
                {availableQuestions.map((q) => (
                  <li key={q.id} className="rounded-md border border-gray-100 p-2">
                    <p className="text-sm text-gray-700">{q.statement}</p>
                    <form action={addQuestionToExamAction} className="mt-1.5 flex items-center gap-2">
                      <input type="hidden" name="disciplineId" value={id} />
                      <input type="hidden" name="examId" value={examId} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <Input name="points" type="number" step="0.5" min={0.5} defaultValue={1} className="!w-20" />
                      <Button variant="secondary" type="submit">+</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
