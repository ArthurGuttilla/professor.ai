import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { batchValidateAction } from "./actions";
import { UploadSubmissionsForm } from "./upload-form";
import { Badge, Button, Card, EmptyState, PageTitle, StateBadge } from "@/components/ui";

/** Fila de correção (PRD M7): pendente vínculo → corrigida (IA) → validada → liberada. */
export default async function CorrecaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canTriage = can(role, "triage");
  const canValidate = can(role, "validate");

  const exams = await prisma.exam.findMany({
    where: { disciplineId: id },
    orderBy: { createdAt: "desc" },
    include: {
      submissions: {
        orderBy: { createdAt: "asc" },
        include: { student: true, suggestedStudent: true },
      },
    },
  });
  const withSubmissions = exams.filter((e) => e.submissions.length > 0);

  return (
    <div className="space-y-6">
      <PageTitle sub="Fila: pendente vínculo → corrigida (IA) → validada (professor) → liberada. Nenhuma nota chega ao aluno sem sua validação.">
        Correção
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {withSubmissions.length === 0 ? (
            <EmptyState>Nenhuma prova recebida ainda. Suba os arquivos ao lado.</EmptyState>
          ) : (
            withSubmissions.map((exam) => {
              const aiGraded = exam.submissions.filter((s) => s.status === "AI_GRADED").length;
              return (
                <Card key={exam.id}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{exam.title}</h2>
                    {canValidate && aiGraded > 0 ? (
                      <form action={batchValidateAction}>
                        <input type="hidden" name="disciplineId" value={id} />
                        <input type="hidden" name="examId" value={exam.id} />
                        <Button variant="secondary" type="submit">
                          Validar e liberar {aiGraded} em lote
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {exam.submissions.map((s) => (
                      <li key={s.id} className="py-2">
                        <Link
                          href={`/professor/disciplinas/${id}/correcao/${s.id}`}
                          className="flex items-center justify-between gap-3 hover:opacity-80"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {s.student?.name ??
                                s.suggestedStudent?.name ??
                                s.ocrHeader ??
                                "Sem identificação"}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <StateBadge state={s.status} />
                              <StateBadge state={s.linkState} />
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            {s.aiTotal !== null ? (
                              <p className="text-gray-400">IA: {s.aiTotal.toFixed(1)}</p>
                            ) : null}
                            {s.finalTotal !== null ? (
                              <p className="font-semibold text-gray-900">
                                Final: {s.finalTotal.toFixed(1)}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>

        {canTriage ? (
          <div>
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Upload em lote</h2>
              {exams.length === 0 ? (
                <p className="text-sm text-gray-500">Crie uma prova primeiro (aba Provas).</p>
              ) : (
                <UploadSubmissionsForm
                  disciplineId={id}
                  exams={exams.map((e) => ({ id: e.id, title: e.title }))}
                />
              )}
            </Card>
            <Card className="mt-6">
              <h2 className="mb-2 font-semibold text-gray-900">Como funciona o gate</h2>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-500">
                <li>Upload: cada arquivo vira uma prova na fila.</li>
                <li>OCR sugere o aluno; você (ou o assistente) confirma.</li>
                <li>IA corrige por rubrica: nota por critério + feedback.</li>
                <li>
                  <strong className="text-gray-700">
                    Só o professor valida e libera — em lote ou individualmente, com edição livre.
                  </strong>
                </li>
                <li>A trilha de auditoria guarda IA vs. aprovado.</li>
              </ol>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
