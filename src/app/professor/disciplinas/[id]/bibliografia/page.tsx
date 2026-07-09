import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import {
  addManualReferenceAction,
  moveReferenceAction,
  removeReferenceAction,
  toggleLibraryAction,
  toggleUnitLinkAction,
} from "./actions";
import { SuggestPanel } from "./suggest-panel";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageTitle,
  Select,
} from "@/components/ui";

export default async function BibliografiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canEdit = can(role, "draft");

  const plan = await prisma.teachingPlan.findUnique({
    where: { disciplineId: id },
    include: {
      programUnits: { orderBy: { order: "asc" } },
      bibliography: {
        orderBy: { order: "asc" },
        include: { unitLinks: true },
      },
    },
  });

  if (!plan) {
    return (
      <EmptyState>
        Crie o plano de ensino primeiro — a bibliografia é sugerida a partir da ementa.
      </EmptyState>
    );
  }

  const basicas = plan.bibliography.filter((b) => b.kind === "BASIC");
  const complementares = plan.bibliography.filter((b) => b.kind === "COMPLEMENTARY");

  const renderItem = (b: (typeof plan.bibliography)[number]) => (
    <li key={b.id} className="rounded-md border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-800">{b.abntFormatted ?? `${b.authors}. ${b.title}.`}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {b.verified ? <Badge color="green">Verificada</Badge> : <Badge color="yellow">Não verificada</Badge>}
            {b.availableInLibrary ? <Badge color="blue">Na biblioteca</Badge> : null}
            {b.provenance ? <span className="text-xs text-gray-400">({b.provenance})</span> : null}
          </div>
          {plan.programUnits.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.programUnits.map((u) => {
                const linked = b.unitLinks.some((l) => l.programUnitId === u.id);
                return canEdit ? (
                  <form key={u.id} action={toggleUnitLinkAction} className="inline">
                    <input type="hidden" name="disciplineId" value={id} />
                    <input type="hidden" name="itemId" value={b.id} />
                    <input type="hidden" name="unitId" value={u.id} />
                    <button
                      type="submit"
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        linked
                          ? "border-brand bg-brand text-brand-fg"
                          : "border-gray-300 text-gray-500 hover:border-brand"
                      }`}
                      title={linked ? "Desvincular da unidade" : "Vincular à unidade"}
                    >
                      {u.title.split("—")[0].trim()}
                    </button>
                  </form>
                ) : linked ? (
                  <Badge key={u.id} color="blue">
                    {u.title.split("—")[0].trim()}
                  </Badge>
                ) : null;
              })}
            </div>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <form action={moveReferenceAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="itemId" value={b.id} />
              <input type="hidden" name="dir" value="up" />
              <Button variant="ghost" type="submit" title="Mover para cima">↑</Button>
            </form>
            <form action={moveReferenceAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="itemId" value={b.id} />
              <input type="hidden" name="dir" value="down" />
              <Button variant="ghost" type="submit" title="Mover para baixo">↓</Button>
            </form>
            <form action={toggleLibraryAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="itemId" value={b.id} />
              <Button variant="ghost" type="submit" title="Disponível na biblioteca?">🏛</Button>
            </form>
            <form action={removeReferenceAction}>
              <input type="hidden" name="disciplineId" value={id} />
              <input type="hidden" name="itemId" value={b.id} />
              <Button variant="ghost" type="submit" title="Remover">✕</Button>
            </form>
          </div>
        ) : null}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageTitle sub="Formatação ABNT automática. Vincule cada referência às unidades do programa — o vínculo alimenta o aula a aula e os slides.">
        Bibliografia
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Básica ({basicas.length})</h2>
            {basicas.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma referência básica.</p>
            ) : (
              <ul className="space-y-2">{basicas.map(renderItem)}</ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">
              Complementar ({complementares.length})
            </h2>
            {complementares.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma referência complementar.</p>
            ) : (
              <ul className="space-y-2">{complementares.map(renderItem)}</ul>
            )}
          </Card>

          {canEdit ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Adicionar manualmente</h2>
              <form action={addManualReferenceAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="disciplineId" value={id} />
                <div className="sm:col-span-2">
                  <Label>Autores (SOBRENOME, Nome; …)</Label>
                  <Input name="authors" required />
                </div>
                <div className="sm:col-span-2">
                  <Label>Título</Label>
                  <Input name="title" required />
                </div>
                <div>
                  <Label>Editora</Label>
                  <Input name="publisher" />
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input name="year" type="number" />
                </div>
                <div>
                  <Label>Edição</Label>
                  <Input name="edition" placeholder="3. ed." />
                </div>
                <div>
                  <Label>ISBN</Label>
                  <Input name="isbn" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select name="kind" className="w-full">
                    <option value="BASIC">Básica</option>
                    <option value="COMPLEMENTARY">Complementar</option>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit">Adicionar</Button>
                </div>
              </form>
            </Card>
          ) : null}
        </div>

        <div>
          {canEdit ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Sugestão por IA</h2>
              <SuggestPanel disciplineId={id} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
