import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { getFullPlan } from "@/modules/m1-teaching-plan/service";
import { can } from "@/lib/auth/permissions";
import {
  addObjectiveAction,
  addUnitAction,
  removeObjectiveAction,
  removeUnitAction,
  savePlanFieldsAction,
  updateUnitAction,
} from "./actions";
import { GeneratePlanForm, ImportPlanForm } from "./ai-forms";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  LinkButton,
  PageTitle,
  Select,
  Textarea,
} from "@/components/ui";

const BLOOM = ["Lembrar", "Compreender", "Aplicar", "Analisar", "Avaliar", "Criar"];

export default async function PlanoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "editPlan"); // só PROFESSOR edita plano (PRD M10)

  const plan = await getFullPlan(id);

  if (!plan) {
    return (
      <div>
        <PageTitle sub="Crie o plano com IA a partir dos dados da disciplina, ou importe um plano pronto.">
          Plano de Ensino (formato MEC)
        </PageTitle>
        {canEdit ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Criar com IA</h2>
              <GeneratePlanForm disciplineId={id} />
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Importar pronto</h2>
              <ImportPlanForm disciplineId={id} />
            </Card>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Ainda não há plano de ensino. Apenas professores podem criá-lo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle sub="Campos estruturados no formato MEC. Toda edição gera uma nova versão.">
          Plano de Ensino
        </PageTitle>
        <div className="flex items-center gap-2">
          <Badge color="blue">v{plan.version}</Badge>
          <Link
            href={`/professor/disciplinas/${id}/plano/versoes`}
            className="text-sm text-brand underline"
          >
            Histórico
          </Link>
          <LinkButton
            variant="secondary"
            href={`/professor/disciplinas/${id}/plano/export?format=pdf`}
          >
            Export PDF
          </LinkButton>
          <LinkButton
            variant="secondary"
            href={`/professor/disciplinas/${id}/plano/export?format=docx`}
          >
            Export DOCX
          </LinkButton>
        </div>
      </div>

      {/* Campos MEC textuais */}
      <Card>
        <form action={savePlanFieldsAction} className="space-y-4">
          <input type="hidden" name="disciplineId" value={id} />
          <div>
            <Label>Ementa</Label>
            <Textarea name="ementa" rows={3} defaultValue={plan.ementa} disabled={!canEdit} />
          </div>
          <div>
            <Label>Objetivos gerais</Label>
            <Textarea
              name="objetivosGerais"
              rows={2}
              defaultValue={plan.objetivosGerais}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Metodologia</Label>
            <Textarea
              name="metodologia"
              rows={3}
              defaultValue={plan.metodologia}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Critérios de avaliação</Label>
            <Textarea
              name="criteriosAvaliacao"
              rows={2}
              defaultValue={plan.criteriosAvaliacao}
              disabled={!canEdit}
            />
          </div>
          {canEdit ? <Button type="submit">Salvar (nova versão)</Button> : null}
        </form>
      </Card>

      {/* Objetivos específicos (Bloom) */}
      <Card>
        <h2 className="mb-3 font-semibold text-gray-900">
          Objetivos de aprendizagem específicos (taxonomia de Bloom)
        </h2>
        <ul className="mb-4 space-y-2">
          {plan.learningObjectives
            .filter((o) => o.isSpecific)
            .map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <Badge color="purple">{o.bloomLevel}</Badge>{" "}
                  <span className="text-gray-700">{o.description}</span>
                </div>
                {canEdit ? (
                  <form action={removeObjectiveAction}>
                    <input type="hidden" name="disciplineId" value={id} />
                    <input type="hidden" name="objectiveId" value={o.id} />
                    <Button variant="ghost" type="submit">
                      ✕
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
        </ul>
        {canEdit ? (
          <form action={addObjectiveAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="disciplineId" value={id} />
            <div>
              <Label>Nível Bloom</Label>
              <Select name="bloomLevel">
                {BLOOM.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-64 flex-1">
              <Label>Descrição</Label>
              <Input name="description" required placeholder="Aplicar estruturas de repetição…" />
            </div>
            <Button type="submit" variant="secondary">
              Adicionar
            </Button>
          </form>
        ) : null}
      </Card>

      {/* Conteúdo programático por unidade */}
      <Card>
        <h2 className="mb-3 font-semibold text-gray-900">Conteúdo programático por unidade</h2>
        <div className="space-y-4">
          {plan.programUnits.map((u) => (
            <form
              key={u.id}
              action={updateUnitAction}
              className="rounded-md border border-gray-200 p-3"
            >
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="unitId" value={u.id} />
              <div className="mb-2 flex items-center gap-2">
                <Input name="title" defaultValue={u.title} disabled={!canEdit} />
                {canEdit ? (
                  <>
                    <Button type="submit" variant="secondary">
                      Salvar
                    </Button>
                    <Button
                      variant="ghost"
                      formAction={removeUnitAction}
                      formNoValidate
                      type="submit"
                    >
                      ✕
                    </Button>
                  </>
                ) : null}
              </div>
              <Textarea name="content" rows={2} defaultValue={u.content} disabled={!canEdit} />
            </form>
          ))}
        </div>
        {canEdit ? (
          <form action={addUnitAction} className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="disciplineId" value={id} />
            <div className="min-w-64 flex-1">
              <Label>Nova unidade</Label>
              <Input name="title" required placeholder="Unidade 5 — …" />
            </div>
            <Button type="submit" variant="secondary">
              Adicionar unidade
            </Button>
          </form>
        ) : null}
      </Card>

      {/* Regenerar/reimportar */}
      {canEdit ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Regenerar com IA</h2>
            <p className="mb-3 text-xs text-yellow-700">
              Substitui ementa, objetivos e unidades (a versão atual fica no histórico).
            </p>
            <GeneratePlanForm disciplineId={id} />
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Reimportar de arquivo</h2>
            <p className="mb-3 text-xs text-yellow-700">
              Substitui o conteúdo atual (a versão atual fica no histórico).
            </p>
            <ImportPlanForm disciplineId={id} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
