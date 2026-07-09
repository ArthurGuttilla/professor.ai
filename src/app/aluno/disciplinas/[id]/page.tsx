import Link from "next/link";
import { requireEnrollment } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState } from "@/components/ui";

/** Visão da disciplina pelo aluno: materiais publicados, atividades e notas liberadas. */
export default async function StudentDisciplinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, discipline } = await requireEnrollment(id);

  const [lessons, activities, submissions] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        lessonPlan: { teachingPlan: { disciplineId: id } },
        OR: [
          { content: { status: "PUBLISHED" } },
          { slideDeck: { status: "PUBLISHED" } },
          { materials: { some: { status: "PUBLISHED" } } },
        ],
      },
      orderBy: { number: "asc" },
      include: {
        content: { select: { status: true } },
        slideDeck: { select: { status: true } },
        materials: { where: { status: "PUBLISHED" }, select: { id: true } },
      },
    }),
    prisma.activity.findMany({
      where: { disciplineId: id, status: "PUBLISHED", kind: { not: "QUIZ_LIVE" } },
      orderBy: { dueAt: "asc" },
      include: {
        attempts: { where: { studentId: student.id }, orderBy: { score: "desc" }, take: 1 },
      },
    }),
    prisma.submission.findMany({
      where: { studentId: student.id, status: "RELEASED", exam: { disciplineId: id } },
      include: { exam: true },
      orderBy: { releasedAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/aluno" className="text-sm text-brand underline">
        ← Painel
      </Link>
      <h1 className="mt-1 text-xl font-bold text-gray-900">{discipline.name}</h1>
      <p className="text-sm text-gray-500">
        {discipline.course} · {discipline.term}
      </p>

      <div className="mt-4">
        <Link
          href={`/aluno/tutor/${id}`}
          className="block rounded-lg bg-brand px-4 py-3 text-center font-medium text-brand-fg transition-opacity hover:opacity-90"
        >
          💬 Tutor de IA da disciplina
        </Link>
      </div>

      {/* Notas liberadas */}
      <h2 className="mb-2 mt-8 font-semibold text-gray-900">Minhas notas</h2>
      {submissions.length === 0 ? (
        <EmptyState>Nenhuma correção liberada ainda.</EmptyState>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => (
            <Link key={s.id} href={`/aluno/correcoes/${s.accessToken}`} className="block">
              <Card className="!p-3 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.exam.title}</p>
                    <p className="text-xs text-gray-400">Correção detalhada disponível →</p>
                  </div>
                  <p className="text-lg font-bold text-brand">
                    {s.finalTotal?.toFixed(1)}
                    <span className="text-xs font-normal text-gray-400">
                      /{s.exam.totalPoints}
                    </span>
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Atividades */}
      <h2 className="mb-2 mt-8 font-semibold text-gray-900">Atividades</h2>
      {activities.length === 0 ? (
        <EmptyState>Nenhuma atividade publicada.</EmptyState>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const best = a.attempts[0];
            const closed = a.dueAt && a.dueAt < new Date();
            return (
              <Link key={a.id} href={`/aluno/atividades/${a.id}`} className="block">
                <Card className="!p-3 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-400">
                        {a.dueAt ? `Entrega ${a.dueAt.toLocaleString("pt-BR")}` : ""}
                      </p>
                    </div>
                    {best ? (
                      <Badge color="green">{best.score} pts</Badge>
                    ) : closed ? (
                      <Badge color="red">Encerrada</Badge>
                    ) : (
                      <Badge color="yellow">Pendente</Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Materiais por aula */}
      <h2 className="mb-2 mt-8 font-semibold text-gray-900">Materiais das aulas</h2>
      {lessons.length === 0 ? (
        <EmptyState>Nenhum material publicado ainda.</EmptyState>
      ) : (
        <div className="space-y-2">
          {lessons.map((l) =>
            l.qrSlug ? (
              <Link key={l.id} href={`/m/${l.qrSlug}`} className="block">
                <Card className="!p-3 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-gray-900">
                    Aula {l.number} — {l.theme}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[
                      l.content?.status === "PUBLISHED" ? "texto" : null,
                      l.slideDeck?.status === "PUBLISHED" ? "slides" : null,
                      l.materials.length > 0 ? `${l.materials.length} anexo(s)` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Card>
              </Link>
            ) : null,
          )}
        </div>
      )}
    </main>
  );
}
