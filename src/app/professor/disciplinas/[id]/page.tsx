import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";

/** Visão geral: o fluxo mestre da disciplina com o status de cada etapa. */
export default async function DisciplineOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDisciplineAccess(id, "view");

  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId: id },
    include: {
      _count: { select: { programUnits: true, bibliography: true } },
      lessonPlan: { include: { _count: { select: { lessons: true } } } },
    },
  });
  const [activityCount, examCount, pendingSubmissions] = await Promise.all([
    prisma.activity.count({ where: { disciplineId: id } }),
    prisma.exam.count({ where: { disciplineId: id } }),
    prisma.submission.count({
      where: { exam: { disciplineId: id }, status: { in: ["PENDING_LINK", "LINKED", "AI_GRADED"] } },
    }),
  ]);

  const steps = [
    {
      href: "plano",
      title: "1 · Plano de Ensino",
      status: plan ? `v${plan.version} · ${plan._count.programUnits} unidade(s)` : "Não criado",
      done: !!plan,
    },
    {
      href: "bibliografia",
      title: "2 · Bibliografia",
      status: plan ? `${plan._count.bibliography} referência(s)` : "Depende do plano",
      done: (plan?._count.bibliography ?? 0) > 0,
    },
    {
      href: "aulas",
      title: "3 · Plano aula a aula",
      status: plan?.lessonPlan ? `${plan.lessonPlan._count.lessons} aula(s)` : "Não gerado",
      done: !!plan?.lessonPlan,
    },
    {
      href: "aulas",
      title: "4 · Conteúdo, slides e materiais",
      status: plan?.lessonPlan ? "Por aula, na aba Aula a aula" : "Depende do aula a aula",
      done: !!plan?.lessonPlan,
    },
    {
      href: "atividades",
      title: "5 · Atividades e quiz",
      status: `${activityCount} atividade(s)`,
      done: activityCount > 0,
    },
    {
      href: "provas",
      title: "6 · Provas e rubricas",
      status: `${examCount} prova(s)`,
      done: examCount > 0,
    },
    {
      href: "correcao",
      title: "7 · Correção",
      status: pendingSubmissions > 0 ? `${pendingSubmissions} na fila` : "Fila vazia",
      done: false,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {steps.map((s, i) => (
        <Link key={i} href={`/professor/disciplinas/${id}/${s.href}`}>
          <Card className="flex h-full items-center justify-between transition-shadow hover:shadow-md">
            <div>
              <h2 className="font-medium text-gray-900">{s.title}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{s.status}</p>
            </div>
            <span className={`text-lg ${s.done ? "text-green-600" : "text-gray-300"}`}>●</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
