import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { publicUrl, qrDataUrl } from "@/lib/qr";
import {
  confirmLinkAction,
  updateAnswerTextAction,
  validateSubmissionAction,
} from "../actions";
import { RunAiGradingButton } from "../upload-form";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PageTitle,
  Select,
  StateBadge,
  Textarea,
} from "@/components/ui";

/* eslint-disable @next/next/no-img-element */

/** Detalhe da submissão: vínculo, correção IA vs. validação do professor. */
export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id, submissionId } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canTriage = can(role, "triage");
  const canValidate = can(role, "validate");

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, exam: { disciplineId: id } },
    include: {
      student: true,
      suggestedStudent: true,
      feedback: true,
      answers: true,
      criterionScores: true,
      exam: {
        include: {
          questions: { orderBy: { order: "asc" }, include: { question: true } },
          rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });
  if (!submission) notFound();

  const students = await prisma.student.findMany({
    where: { enrollments: { some: { disciplineId: id } } },
    orderBy: { name: "asc" },
  });

  const answerByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));
  const scoreByCriterion = new Map(submission.criterionScores.map((cs) => [cs.criterionId, cs]));
  const released = submission.status === "RELEASED";
  const studentLink = released ? publicUrl(`c/${submission.accessToken}`) : null;
  const studentQr = released
    ? await qrDataUrl(
        `${process.env.APP_URL ?? "http://localhost:3000"}/aluno/correcoes/${submission.accessToken}`,
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle sub={submission.exam.title}>
          Correção — {submission.student?.name ?? submission.ocrHeader ?? "sem identificação"}
        </PageTitle>
        <div className="flex items-center gap-2">
          <StateBadge state={submission.status} />
          <Link href={`/professor/disciplinas/${id}/correcao`} className="text-sm text-brand underline">
            ← Fila
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Vínculo prova↔aluno */}
          <Card>
            <h2 className="mb-2 font-semibold text-gray-900">Vínculo com o aluno</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StateBadge state={submission.linkState} />
              {submission.ocrHeader ? (
                <span className="text-gray-500">
                  Cabeçalho lido: “{submission.ocrHeader}”
                </span>
              ) : null}
            </div>
            {submission.linkState !== "CONFIRMED" && canTriage ? (
              <form action={confirmLinkAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="disciplineId" value={id} />
                <input type="hidden" name="submissionId" value={submissionId} />
                <div>
                  <Label>Aluno</Label>
                  <Select
                    name="studentId"
                    defaultValue={submission.suggestedStudentId ?? ""}
                    required
                  >
                    <option value="">Selecione…</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? s.email} {s.registration ? `(${s.registration})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">
                  {submission.suggestedStudentId ? "Confirmar vínculo sugerido" : "Vincular"}
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-gray-700">
                {submission.student?.name ?? submission.student?.email ?? "—"}
              </p>
            )}
          </Card>

          {/* Correção IA */}
          {submission.linkState === "CONFIRMED" &&
          submission.status !== "RELEASED" &&
          canTriage ? (
            <Card>
              <h2 className="mb-2 font-semibold text-gray-900">Correção automática</h2>
              <RunAiGradingButton disciplineId={id} submissionId={submissionId} />
            </Card>
          ) : null}

          {/* Validação (gate) */}
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">
              {released ? "Correção liberada" : "Validação do professor (gate)"}
            </h2>
            <form action={validateSubmissionAction} className="space-y-4">
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="submissionId" value={submissionId} />

              {/* Questões */}
              {submission.exam.questions.map((eq, i) => {
                const q = eq.question;
                const ans = answerByQuestion.get(eq.questionId);
                return (
                  <div key={eq.id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-400">Q{i + 1}</span>
                      <Badge color="gray">
                        {q.type === "ESSAY" ? "Discursiva" : "Objetiva"} · {eq.points} pts
                      </Badge>
                      {ans?.isCorrect === true ? <Badge color="green">Acertou</Badge> : null}
                      {ans?.isCorrect === false ? <Badge color="red">Errou</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{q.statement}</p>
                    {canTriage && !released && ans ? (
                      <div className="mt-2">
                        <Label>Resposta do aluno (transcrição editável)</Label>
                        <div className="flex items-start gap-2">
                          <Textarea
                            name="answer"
                            rows={q.type === "ESSAY" ? 3 : 1}
                            defaultValue={ans.answer}
                            form={`transcricao-form-${ans.id}`}
                          />
                          <Button
                            variant="secondary"
                            type="submit"
                            form={`transcricao-form-${ans.id}`}
                            title="Salvar transcrição"
                          >
                            💾
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-sm text-gray-800">
                        {ans?.answer || "(em branco)"}
                      </p>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label>
                          Pontos (IA sugeriu: {ans?.aiPoints ?? "—"} / máx {eq.points})
                        </Label>
                        <Input
                          name={`ansp_${ans?.id}`}
                          type="number"
                          step="0.1"
                          min={0}
                          max={eq.points}
                          defaultValue={ans?.finalPoints ?? ans?.aiPoints ?? ""}
                          disabled={released || !canValidate}
                        />
                      </div>
                      <div>
                        <Label>Feedback da questão</Label>
                        <Input
                          name={`ansf_${ans?.id}`}
                          defaultValue={ans?.finalFeedback ?? ans?.aiFeedback ?? ""}
                          disabled={released || !canValidate}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Rubrica */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Notas por critério</h3>
                <div className="space-y-2">
                  {(submission.exam.rubric?.criteria ?? []).map((c) => {
                    const cs = scoreByCriterion.get(c.id);
                    return (
                      <div key={c.id} className="rounded-md border border-gray-200 p-3">
                        <p className="text-sm font-medium text-gray-900">
                          {c.criterion} <span className="text-xs text-gray-400">(máx {c.points})</span>
                        </p>
                        {cs?.aiJustification ? (
                          <p className="mt-0.5 text-xs text-gray-500">
                            IA ({cs.aiScore}): {cs.aiJustification}
                          </p>
                        ) : null}
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Input
                            name={`crit_${c.id}`}
                            type="number"
                            step="0.1"
                            min={0}
                            max={c.points}
                            defaultValue={cs?.finalScore ?? cs?.aiScore ?? ""}
                            disabled={released || !canValidate}
                          />
                          <Input
                            name={`critj_${c.id}`}
                            placeholder="Justificativa (opcional)"
                            defaultValue={cs?.finalJustification ?? ""}
                            disabled={released || !canValidate}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback geral */}
              <div>
                <Label>
                  Feedback ao aluno{" "}
                  {submission.feedback?.aiText ? "(pré-preenchido pela IA — edite livremente)" : ""}
                </Label>
                <Textarea
                  name="finalFeedback"
                  rows={4}
                  defaultValue={submission.feedback?.finalText ?? submission.feedback?.aiText ?? ""}
                  disabled={released || !canValidate}
                />
              </div>

              {canValidate && !released ? (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox" name="release" defaultChecked />
                    Liberar ao aluno imediatamente
                  </label>
                  <Button type="submit">Validar correção</Button>
                  <p className="text-xs text-gray-400">
                    Auditoria registra a nota da IA ({submission.aiTotal?.toFixed(1) ?? "—"}) vs. a
                    sua.
                  </p>
                </div>
              ) : null}
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Arquivo original */}
          {submission.fileUrl ? (
            <Card>
              <h2 className="mb-2 font-semibold text-gray-900">Prova digitalizada</h2>
              <iframe
                src={`/professor/disciplinas/${id}/correcao/${submissionId}/file`}
                className="h-96 w-full rounded border border-gray-200"
                title="Prova digitalizada"
              />
            </Card>
          ) : null}

          {/* Transcrição OCR crua */}
          {submission.ocrText ? (
            <Card>
              <h2 className="mb-2 font-semibold text-gray-900">Transcrição (OCR)</h2>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-600">
                {submission.ocrText}
              </pre>
            </Card>
          ) : null}

          {/* Link do aluno */}
          {released && studentQr ? (
            <Card className="text-center">
              <h2 className="mb-2 font-semibold text-gray-900">Link do aluno</h2>
              <img src={studentQr} alt="QR da correção" className="mx-auto h-36 w-36" />
              <p className="mt-2 break-all text-xs text-gray-400">
                /aluno/correcoes/{submission.accessToken}
              </p>
            </Card>
          ) : null}

          {/* Formulários de transcrição (fora do form principal) */}
          {canTriage && !released
            ? submission.answers.map((ans) => (
                <form key={ans.id} id={`transcricao-form-${ans.id}`} action={updateAnswerTextAction} className="hidden">
                  <input type="hidden" name="disciplineId" value={id} />
                  <input type="hidden" name="answerId" value={ans.id} />
                </form>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
