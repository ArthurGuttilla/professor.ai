import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import {
  createManualQuestionAction,
  deleteQuestionAction,
  reviewQuestionAction,
} from "./actions";
import { GenerateQuestionsForm } from "./generate-form";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageTitle,
  Select,
  Textarea,
} from "@/components/ui";

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Múltipla escolha",
  TRUE_FALSE: "V/F",
  ESSAY: "Dissertativa",
};
const DIFF_LABEL: Record<string, string> = { EASY: "Fácil", MEDIUM: "Média", HARD: "Difícil" };

export default async function QuestoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "draft");

  const [questions, lessons] = await Promise.all([
    prisma.question.findMany({
      where: { disciplineId: id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { activityLinks: true, examLinks: true } } },
    }),
    prisma.lesson.findMany({
      where: { lessonPlan: { teachingPlan: { disciplineId: id } }, isAssessment: false },
      orderBy: { number: "asc" },
      select: { id: true, number: true, theme: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle sub="Banco taggeado por tema/aula, nível e tipo. Questões de IA exigem revisão antes do uso.">
        Banco de questões ({questions.length})
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {questions.length === 0 ? (
            <EmptyState>Nenhuma questão ainda. Gere com IA ou crie manualmente.</EmptyState>
          ) : (
            questions.map((q) => {
              const options = (q.options as { key: string; text: string }[] | null) ?? [];
              const inUse = q._count.activityLinks + q._count.examLinks > 0;
              return (
                <Card key={q.id} className="!p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge color="blue">{TYPE_LABEL[q.type]}</Badge>
                    <Badge color="gray">{DIFF_LABEL[q.difficulty]}</Badge>
                    {q.theme ? <Badge color="purple">{q.theme}</Badge> : null}
                    <Badge color={q.source === "AI" ? "yellow" : "gray"}>
                      {q.source === "AI" ? "IA" : "Manual"}
                    </Badge>
                    {q.reviewedAt ? (
                      <Badge color="green">Revisada</Badge>
                    ) : (
                      <Badge color="red">Aguardando revisão</Badge>
                    )}
                    {inUse ? <Badge color="blue">Em uso</Badge> : null}
                  </div>
                  {q.baseText ? (
                    <p className="mt-2 text-xs italic text-gray-500">{q.baseText}</p>
                  ) : null}
                  <p className="mt-1.5 text-sm font-medium text-gray-900">{q.statement}</p>
                  {options.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5 text-sm">
                      {options.map((o) => (
                        <li
                          key={o.key}
                          className={
                            o.key === q.correctKey ? "font-medium text-green-700" : "text-gray-600"
                          }
                        >
                          {o.key}) {o.text} {o.key === q.correctKey ? "✓" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {q.answerKey ? (
                    <p className="mt-1.5 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                      <strong>Padrão de resposta:</strong> {q.answerKey}
                    </p>
                  ) : null}
                  {canEdit ? (
                    <div className="mt-2 flex gap-2">
                      {!q.reviewedAt ? (
                        <form action={reviewQuestionAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="questionId" value={q.id} />
                          <Button variant="secondary" type="submit">
                            Aprovar questão
                          </Button>
                        </form>
                      ) : null}
                      {!inUse ? (
                        <form action={deleteQuestionAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="questionId" value={q.id} />
                          <Button variant="ghost" type="submit">
                            Excluir
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>

        {canEdit ? (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Gerar com IA</h2>
              <GenerateQuestionsForm disciplineId={id} lessons={lessons} />
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Nova questão manual</h2>
              <form action={createManualQuestionAction} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select name="type" className="w-full">
                      <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
                      <option value="TRUE_FALSE">V/F</option>
                      <option value="ESSAY">Dissertativa</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Dificuldade</Label>
                    <Select name="difficulty" className="w-full" defaultValue="MEDIUM">
                      <option value="EASY">Fácil</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HARD">Difícil</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Tema</Label>
                  <Input name="theme" placeholder="Funções" />
                </div>
                <div>
                  <Label>Texto-base (opcional, estilo ENADE)</Label>
                  <Textarea name="baseText" rows={2} />
                </div>
                <div>
                  <Label>Enunciado</Label>
                  <Textarea name="statement" rows={2} required />
                </div>
                <div>
                  <Label>Alternativas (múltipla escolha)</Label>
                  <div className="space-y-1.5">
                    {["A", "B", "C", "D", "E"].map((k) => (
                      <Input key={k} name={`option${k}`} placeholder={`Alternativa ${k}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Gabarito (chave correta: A-E ou V/F)</Label>
                  <Input name="correctKey" placeholder="A" />
                </div>
                <div>
                  <Label>Padrão de resposta (dissertativa)</Label>
                  <Textarea name="answerKey" rows={2} />
                </div>
                <Button type="submit" className="w-full">
                  Adicionar ao banco
                </Button>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
