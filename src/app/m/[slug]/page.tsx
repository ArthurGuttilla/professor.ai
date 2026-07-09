import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/markdown";
import { SlideViewer, type SlideTemplate } from "@/components/slide-viewer";
import { Badge, Card } from "@/components/ui";
import type { Slide } from "@/modules/m4-materials/slides";

/**
 * Viewer público via QR code (PRD M4): resolve o slug para aula, conteúdo,
 * slides ou material. SOMENTE conteúdo publicado é exibido — rascunhos
 * retornam 404 (o aluno nunca vê DRAFT).
 */

async function slideTemplateFor(institutionId: string): Promise<SlideTemplate> {
  const t = await prisma.institutionTemplate.findFirst({
    where: { institutionId, kind: "SLIDES" },
  });
  return (t?.config as SlideTemplate | null) ?? {};
}

export default async function PublicMaterialPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1) Slides publicados → apresentação.
  const deck = await prisma.slideDeck.findUnique({
    where: { qrSlug: slug },
    include: {
      lesson: {
        include: { lessonPlan: { include: { teachingPlan: { include: { discipline: true } } } } },
      },
    },
  });
  if (deck) {
    if (deck.status !== "PUBLISHED") notFound();
    const discipline = deck.lesson.lessonPlan.teachingPlan.discipline;
    const template = await slideTemplateFor(discipline.institutionId);
    const slides = ((deck.data as { slides?: Slide[] } | null)?.slides ?? []) as Slide[];
    return (
      <SlideViewer
        slides={slides}
        template={template}
        deckTitle={`Aula ${deck.lesson.number} — ${deck.lesson.theme}`}
      />
    );
  }

  // 2) Conteúdo markdown publicado.
  const content = await prisma.lessonContent.findUnique({
    where: { qrSlug: slug },
    include: { lesson: true },
  });
  if (content) {
    if (content.status !== "PUBLISHED") notFound();
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Badge color="blue">Aula {content.lesson.number}</Badge>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{content.lesson.theme}</h1>
        <div className="mt-6">
          <Markdown>{content.markdown}</Markdown>
        </div>
        {content.proposedActivities ? (
          <Card className="mt-8">
            <h2 className="mb-2 font-semibold text-gray-900">Atividades propostas</h2>
            <Markdown>{content.proposedActivities}</Markdown>
          </Card>
        ) : null}
      </main>
    );
  }

  // 3) Material anexado publicado → viewer embutido.
  const material = await prisma.material.findUnique({
    where: { qrSlug: slug },
    include: { lesson: true },
  });
  if (material) {
    if (material.status !== "PUBLISHED") notFound();
    const isPdf = material.mimeType === "application/pdf" || material.name.endsWith(".pdf");
    const isImage = material.mimeType?.startsWith("image/");
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Badge color="blue">Aula {material.lesson.number}</Badge>
        <h1 className="mt-2 text-xl font-bold text-gray-900">{material.name}</h1>
        <div className="mt-6">
          {isPdf ? (
            <iframe
              src={`/m/${slug}/file`}
              className="h-[80vh] w-full rounded-lg border border-gray-200"
              title={material.name}
            />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/m/${slug}/file`} alt={material.name} className="max-w-full rounded-lg" />
          ) : (
            <Card>
              <p className="text-sm text-gray-600">
                Este formato não tem viewer embutido.{" "}
                <a href={`/m/${slug}/file`} className="text-brand underline">
                  Baixar arquivo
                </a>
              </p>
            </Card>
          )}
        </div>
      </main>
    );
  }

  // 4) Página pública da aula: agrega tudo que está publicado.
  const lesson = await prisma.lesson.findUnique({
    where: { qrSlug: slug },
    include: {
      content: true,
      slideDeck: true,
      materials: { where: { status: "PUBLISHED" } },
      unitLinks: {
        include: {
          programUnit: { include: { bibliographyLinks: { include: { bibliographyItem: true } } } },
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Badge color="blue">Aula {lesson.number}</Badge>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{lesson.theme}</h1>
      {lesson.objectives ? <p className="mt-1 text-sm text-gray-500">{lesson.objectives}</p> : null}

      <div className="mt-6 space-y-3">
        {lesson.content?.status === "PUBLISHED" && lesson.content.qrSlug ? (
          <Link href={`/m/${lesson.content.qrSlug}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <span className="font-medium text-gray-900">📄 Texto da aula</span>
            </Card>
          </Link>
        ) : null}
        {lesson.slideDeck?.status === "PUBLISHED" && lesson.slideDeck.qrSlug ? (
          <Link href={`/m/${lesson.slideDeck.qrSlug}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <span className="font-medium text-gray-900">🖥 Slides</span>
            </Card>
          </Link>
        ) : null}
        {lesson.materials.map((m) =>
          m.qrSlug ? (
            <Link key={m.id} href={`/m/${m.qrSlug}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <span className="font-medium text-gray-900">📎 {m.name}</span>
              </Card>
            </Link>
          ) : null,
        )}
        {!lesson.content?.qrSlug && !lesson.slideDeck?.qrSlug && lesson.materials.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">Nenhum material publicado para esta aula ainda.</p>
          </Card>
        ) : null}
      </div>

      {bibliography.length > 0 ? (
        <Card className="mt-8">
          <h2 className="mb-2 font-semibold text-gray-900">Bibliografia recomendada</h2>
          <ul className="space-y-1.5 text-sm text-gray-700">
            {bibliography.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </main>
  );
}
