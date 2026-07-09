import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";

/**
 * Correção detalhada do aluno (PRD M8): acesso via link único/QR + login leve.
 * SOMENTE correções RELEASED (gate do M7). O token é individual; ainda assim
 * exigimos sessão do próprio aluno (LGPD — nota é dado sensível).
 */
export default async function CorrectionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const student = await getCurrentStudent();
  if (!student) redirect(`/aluno/login?next=/aluno/correcoes/${token}`);

  const submission = await prisma.submission.findUnique({
    where: { accessToken: token },
    include: {
      feedback: true,
      answers: true,
      criterionScores: { include: { criterion: true } },
      exam: {
        include: {
          discipline: { select: { name: true } },
          questions: { orderBy: { order: "asc" }, include: { question: true } },
        },
      },
    },
  });

  // Gate inegociável: só RELEASED, e só o próprio aluno.
  if (!submission || submission.status !== "RELEASED") notFound();
  if (submission.studentId !== student.id) notFound();

  const answerByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/aluno" className="text-sm text-brand underline">
        ← Painel
      </Link>
      <h1 className="mt-1 text-xl font-bold text-gray-900">{submission.exam.title}</h1>
      <p className="text-sm text-gray-500">{submission.exam.discipline.name}</p>

      <Card className="mt-4 bg-blue-50 text-center">
        <p className="text-sm text-gray-500">Sua nota</p>
        <p className="text-4xl font-bold text-brand">
          {submission.finalTotal?.toFixed(1)}
          <span className="text-base font-normal text-gray-400">
            /{submission.exam.totalPoints}
          </span>
        </p>
      </Card>

      {/* Feedback geral validado pelo professor */}
      {submission.feedback?.finalText ? (
        <Card className="mt-4">
          <h2 className="mb-2 font-semibold text-gray-900">Feedback do professor</h2>
          <Markdown>{submission.feedback.finalText}</Markdown>
        </Card>
      ) : null}

      {/* Questão a questão */}
      <h2 className="mb-2 mt-8 font-semibold text-gray-900">Questão a questão</h2>
      <div className="space-y-3">
        {submission.exam.questions.map((eq, i) => {
          const q = eq.question;
          const ans = answerByQuestion.get(eq.questionId);
          const options = (q.options as { key: string; text: string }[] | null) ?? [];
          return (
            <Card key={eq.id} className="!p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">Questão {i + 1}</span>
                <Badge
                  color={
                    (ans?.finalPoints ?? 0) >= eq.points
                      ? "green"
                      : (ans?.finalPoints ?? 0) > 0
                        ? "yellow"
                        : "red"
                  }
                >
                  {ans?.finalPoints ?? 0}/{eq.points} pts
                </Badge>
              </div>
              {q.baseText ? <p className="mt-2 text-xs italic text-gray-500">{q.baseText}</p> : null}
              <p className="mt-1 text-sm font-medium text-gray-900">{q.statement}</p>

              <div className="mt-2 rounded bg-gray-50 p-2">
                <p className="text-xs text-gray-400">Sua resposta</p>
                <p className="text-sm text-gray-800">{ans?.answer || "(em branco)"}</p>
              </div>

              {q.type === "ESSAY" ? (
                q.answerKey ? (
                  <div className="mt-2 rounded bg-green-50 p-2">
                    <p className="text-xs text-green-700">Resposta esperada</p>
                    <p className="text-sm text-gray-800">{q.answerKey}</p>
                  </div>
                ) : null
              ) : (
                <div className="mt-2 rounded bg-green-50 p-2">
                  <p className="text-xs text-green-700">Gabarito</p>
                  <p className="text-sm text-gray-800">
                    {q.correctKey}){" "}
                    {options.find((o) => o.key === q.correctKey)?.text ?? ""}
                  </p>
                </div>
              )}

              {ans?.finalFeedback ? (
                <p className="mt-2 text-sm text-gray-600">
                  <strong>Comentário:</strong> {ans.finalFeedback}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      {/* Pontos por critério (rubrica) */}
      {submission.criterionScores.length > 0 ? (
        <>
          <h2 className="mb-2 mt-8 font-semibold text-gray-900">Pontos por critério</h2>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                  <th className="py-1.5">Critério</th>
                  <th className="text-right">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {submission.criterionScores.map((cs) => (
                  <tr key={cs.id} className="border-b border-gray-100 align-top">
                    <td className="py-2">
                      <p className="font-medium text-gray-900">{cs.criterion.criterion}</p>
                      {cs.finalJustification ?? cs.aiJustification ? (
                        <p className="text-xs text-gray-500">
                          {cs.finalJustification ?? cs.aiJustification}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {cs.finalScore ?? 0}/{cs.criterion.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </main>
  );
}
