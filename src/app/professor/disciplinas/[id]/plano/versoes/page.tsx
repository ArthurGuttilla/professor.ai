import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";

export default async function PlanVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireDisciplineAccess(id, "view");

  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId: id },
    include: { versions: { orderBy: { version: "desc" } } },
  });

  return (
    <div>
      <PageTitle sub="Snapshot imutável de cada edição do plano de ensino.">
        Histórico de versões
      </PageTitle>
      {!plan || plan.versions.length === 0 ? (
        <EmptyState>Nenhuma versão registrada ainda.</EmptyState>
      ) : (
        <div className="space-y-3">
          {plan.versions.map((v) => {
            const snap = v.snapshot as {
              ementa?: string;
              unidades?: { title: string }[];
              objetivos?: unknown[];
            };
            return (
              <Card key={v.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge color={v.version === plan.version ? "green" : "gray"}>
                      v{v.version}
                      {v.version === plan.version ? " (atual)" : ""}
                    </Badge>
                    <span className="text-sm text-gray-600">{v.note}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {v.createdAt.toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">{snap.ementa}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {snap.unidades?.length ?? 0} unidade(s) · {snap.objetivos?.length ?? 0}{" "}
                  objetivo(s)
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
