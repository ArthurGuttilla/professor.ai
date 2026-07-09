import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { submitAttemptAction } from "./actions";
import { Badge, Button, Card, PageTitle } from "@/components/ui";

/** Tentativa de quiz assíncrono/atividade pelo aluno (mobile-first). */
export default async function StudentActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const student = await requireStudent();

  const activity = await prisma.activity.findFirst({
    where: {
      id: activityId,
      status: "PUBLISHED",
      discipline: { enrollments: { some: { studentId: student.id } } },
    },
    include: {
      discipline: { select: { id: true, name: true } },
      questions: { orderBy: { order: "asc" }, include: { question: true } },
      attempts: {
        where: { studentId: student.id },
        orderBy: { attemptNumber: "desc" },
        include: { answers: true },
      },
    },
  });
  if (!activity) notFound();

  const now = new Date();
  const notStarted = activity.startsAt && now < activity.startsAt;
  const closed = activity.dueAt && now > activity.dueAt;
  const attemptsLeft = activity.maxAttempts - activity.attempts.length;
  const canTake = !notStarted && !closed && attemptsLeft > 0 && activity.kind !== "QUIZ_LIVE";
  const lastAttempt = activity.attempts[0];

  const maxScore = activity.questions.reduce((acc, q) => acc + q.points, 0);
  const hasPendingEssay = lastAttempt?.answers.some((a) => a.isCorrect === null);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href={`/aluno/disciplinas/${activity.discipline.id}`} className="text-sm text-brand underline">
        ← {activity.discipline.name}
      </Link>
      <PageTitle
        sub={
          <>
            {activity.startsAt ? `Início ${activity.startsAt.toLocaleString("pt-BR")}` : null}
            {activity.dueAt ? ` · Entrega ${activity.dueAt.toLocaleString("pt-BR")}` : null}
            {` · ${attemptsLeft} tentativa(s) restante(s)`}
          </>
        }
      >
        {activity.title}
      </PageTitle>

      {lastAttempt ? (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Sua última tentativa (#{lastAttempt.attemptNumber})
            </h2>
            <Badge color="blue">
              {lastAttempt.score}/{maxScore} pts
            </Badge>
          </div>
          {hasPendingEssay ? (
            <p className="mt-1 text-xs text-yellow-700">
              Questões dissertativas aguardam correção do professor — a pontuação pode mudar.
            </p>
          ) : null}
        </Card>
      ) : null}

      {notStarted ? (
        <Card>
          <p className="text-sm text-gray-600">
            Esta atividade abre em {activity.startsAt?.toLocaleString("pt-BR")}.
          </p>
        </Card>
      ) : closed ? (
        <Card>
          <p className="text-sm text-gray-600">Prazo encerrado.</p>
        </Card>
      ) : !canTake ? (
        <Card>
          <p className="text-sm text-gray-600">Você usou todas as tentativas.</p>
        </Card>
      ) : (
        <form action={submitAttemptAction} className="space-y-4">
          <input type="hidden" name="activityId" value={activityId} />
          {activity.questions.map((aq, i) => {
            const q = aq.question;
            const options = (q.options as { key: string; text: string }[] | null) ?? [];
            return (
              <Card key={aq.id}>
                <p className="mb-1 text-xs font-semibold text-gray-400">
                  Questão {i + 1} · {aq.points} pt(s)
                </p>
                {q.baseText ? (
                  <p className="mb-2 text-sm italic text-gray-500">{q.baseText}</p>
                ) : null}
                <p className="mb-3 text-sm font-medium text-gray-900">{q.statement}</p>
                {q.type === "ESSAY" ? (
                  <textarea
                    name={`q_${q.id}`}
                    rows={5}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    placeholder="Sua resposta…"
                  />
                ) : (
                  <div className="space-y-1.5">
                    {options.map((o) => (
                      <label
                        key={o.key}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-brand"
                      >
                        <input type="radio" name={`q_${q.id}`} value={o.key} required className="mt-0.5" />
                        <span>
                          <strong>{o.key})</strong> {o.text}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          <Button type="submit" className="w-full">
            Enviar respostas
          </Button>
        </form>
      )}
    </main>
  );
}
