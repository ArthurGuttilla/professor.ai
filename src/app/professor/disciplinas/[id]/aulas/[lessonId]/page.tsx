import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { publicUrl, qrDataUrl } from "@/lib/qr";
import { slidesToText, type Slide } from "@/modules/m4-materials/slides";
import { Markdown } from "@/components/markdown";
import {
  deleteMaterialAction,
  saveContentAction,
  saveSlidesAction,
  toggleMaterialPublishAction,
  togglePublishAction,
} from "./actions";
import { GenerateContentForm, UploadMaterialForm } from "./client-forms";
import {
  Badge,
  Button,
  Card,
  Label,
  PageTitle,
  StateBadge,
  Textarea,
} from "@/components/ui";

/* eslint-disable @next/next/no-img-element */

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const { role } = await requireDisciplineAccess(id, "view");
  const canDraft = can(role, "draft");
  const canPublish = can(role, "publish");

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, lessonPlan: { teachingPlan: { disciplineId: id } } },
    include: {
      content: true,
      slideDeck: true,
      materials: { orderBy: { createdAt: "desc" } },
      unitLinks: {
        include: {
          programUnit: {
            include: { bibliographyLinks: { include: { bibliographyItem: true } } },
          },
        },
      },
    },
  });
  if (!lesson) notFound();

  const bibliography = [
    ...new Set(
      lesson.unitLinks.flatMap((ul) =>
        ul.programUnit.bibliographyLinks.map(
          (bl) => bl.bibliographyItem.abntFormatted ?? bl.bibliographyItem.title,
        ),
      ),
    ),
  ];
  const slides = ((lesson.slideDeck?.data as { slides?: Slide[] } | null)?.slides ?? []) as Slide[];
  const lessonQr = lesson.qrSlug ? await qrDataUrl(publicUrl(lesson.qrSlug)) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          sub={`${lesson.date?.toLocaleDateString("pt-BR", { timeZone: "UTC" }) ?? "sem data"} · ${lesson.objectives}`}
        >
          Aula {lesson.number} — {lesson.theme}
        </PageTitle>
        <Link
          href={`/professor/disciplinas/${id}/aulas`}
          className="text-sm text-brand underline"
        >
          ← Voltar ao aula a aula
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Conteúdo markdown */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Conteúdo da aula (markdown)</h2>
              <div className="flex items-center gap-2">
                {lesson.content ? <StateBadge state={lesson.content.status} /> : null}
                {canPublish && lesson.content ? (
                  <form action={togglePublishAction}>
                    <input type="hidden" name="disciplineId" value={id} />
                    <input type="hidden" name="lessonId" value={lessonId} />
                    <input type="hidden" name="target" value="content" />
                    <Button variant="secondary" type="submit">
                      {lesson.content.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
            {canDraft ? (
              <form action={saveContentAction} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <input type="hidden" name="lessonId" value={lessonId} />
                <Textarea
                  name="markdown"
                  rows={14}
                  defaultValue={lesson.content?.markdown ?? ""}
                  placeholder="# Título\n\nConteúdo da aula em markdown…"
                  className="font-mono text-xs"
                />
                <div>
                  <Label>Atividades propostas</Label>
                  <Textarea
                    name="proposedActivities"
                    rows={4}
                    defaultValue={lesson.content?.proposedActivities ?? ""}
                    className="font-mono text-xs"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Salvar rascunho
                </Button>
              </form>
            ) : lesson.content ? (
              <Markdown>{lesson.content.markdown}</Markdown>
            ) : (
              <p className="text-sm text-gray-500">Sem conteúdo ainda.</p>
            )}
          </Card>

          {/* Preview do conteúdo */}
          {canDraft && lesson.content?.markdown ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Pré-visualização</h2>
              <Markdown>{lesson.content.markdown}</Markdown>
              {lesson.content.proposedActivities ? (
                <>
                  <h3 className="mb-2 mt-6 font-semibold text-gray-900">Atividades propostas</h3>
                  <Markdown>{lesson.content.proposedActivities}</Markdown>
                </>
              ) : null}
            </Card>
          ) : null}

          {/* Slides */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Slides {slides.length > 0 ? `(${slides.length})` : ""}
              </h2>
              <div className="flex items-center gap-2">
                {lesson.slideDeck ? <StateBadge state={lesson.slideDeck.status} /> : null}
                {lesson.slideDeck?.qrSlug ? (
                  <Link
                    href={publicUrl(lesson.slideDeck.qrSlug)}
                    className="text-sm text-brand underline"
                    target="_blank"
                  >
                    Apresentar
                  </Link>
                ) : null}
                {canPublish && lesson.slideDeck ? (
                  <form action={togglePublishAction}>
                    <input type="hidden" name="disciplineId" value={id} />
                    <input type="hidden" name="lessonId" value={lessonId} />
                    <input type="hidden" name="target" value="slides" />
                    <Button variant="secondary" type="submit">
                      {lesson.slideDeck.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
            {canDraft ? (
              <form action={saveSlidesAction} className="space-y-3">
                <input type="hidden" name="disciplineId" value={id} />
                <input type="hidden" name="lessonId" value={lessonId} />
                <Textarea
                  name="slidesText"
                  rows={12}
                  defaultValue={slidesToText(slides)}
                  placeholder={"# Título do slide\n- bullet\n---\n# Próximo slide\n- bullet"}
                  className="font-mono text-xs"
                />
                <Button type="submit" variant="secondary">
                  Salvar slides
                </Button>
                <p className="text-xs text-gray-400">
                  Um slide por bloco, separados por linha `---`. Título com `#`, bullets com `-`.
                </p>
              </form>
            ) : slides.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
                {slides.map((s, i) => (
                  <li key={i}>{s.title}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">Sem slides ainda.</p>
            )}
          </Card>

          {/* Materiais anexados */}
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Materiais anexados</h2>
            {lesson.materials.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum material anexado.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {lesson.materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StateBadge state={m.status} />
                        {m.extractedText ? <Badge color="blue">Texto extraído</Badge> : null}
                        {m.qrSlug ? (
                          <Link
                            href={publicUrl(m.qrSlug)}
                            target="_blank"
                            className="text-xs text-brand underline"
                          >
                            Ver online
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canPublish ? (
                        <form action={toggleMaterialPublishAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="lessonId" value={lessonId} />
                          <input type="hidden" name="materialId" value={m.id} />
                          <Button variant="ghost" type="submit">
                            {m.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
                          </Button>
                        </form>
                      ) : null}
                      {canDraft ? (
                        <form action={deleteMaterialAction}>
                          <input type="hidden" name="disciplineId" value={id} />
                          <input type="hidden" name="lessonId" value={lessonId} />
                          <input type="hidden" name="materialId" value={m.id} />
                          <Button variant="ghost" type="submit">
                            ✕
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {canDraft ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Gerar com IA</h2>
              <GenerateContentForm
                disciplineId={id}
                lessonId={lessonId}
                hasContent={!!lesson.content}
              />
            </Card>
          ) : null}

          {canDraft ? (
            <Card>
              <h2 className="mb-3 font-semibold text-gray-900">Anexar material próprio</h2>
              <UploadMaterialForm disciplineId={id} lessonId={lessonId} />
            </Card>
          ) : null}

          {/* QR da aula */}
          {lessonQr && lesson.qrSlug ? (
            <Card className="text-center">
              <h2 className="mb-3 font-semibold text-gray-900">QR code da aula</h2>
              <img src={lessonQr} alt="QR code da aula" className="mx-auto h-40 w-40" />
              <p className="mt-2 break-all text-xs text-gray-400">{publicUrl(lesson.qrSlug)}</p>
              <p className="mt-2 text-xs text-gray-500">
                Projete este QR: o aluno acessa os materiais publicados da aula no celular.
              </p>
            </Card>
          ) : null}

          {/* Bibliografia da aula */}
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Bibliografia recomendada</h2>
            {bibliography.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma referência vinculada às unidades desta aula.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-700">
                {bibliography.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
