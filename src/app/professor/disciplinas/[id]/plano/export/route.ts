import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { getFullPlan } from "@/modules/m1-teaching-plan/service";
import { PdfBuilder } from "@/lib/pdf";

/** Export do plano de ensino em PDF e DOCX (PRD M1, P0). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { discipline, user } = await requireDisciplineAccess(id, "view");
  const plan = await getFullPlan(id);
  if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") ?? "pdf";
  const filenameBase = `plano-de-ensino-${discipline.name.toLowerCase().replace(/\s+/g, "-")}`;

  const sections = {
    identificacao: `Disciplina: ${discipline.name}\nCurso: ${discipline.course}\nPeríodo: ${discipline.term} · Carga horária: ${discipline.workloadHours}h\nInstituição: ${user.institution.name}`,
    geral: plan.learningObjectives.filter((o) => !o.isSpecific),
    especificos: plan.learningObjectives.filter((o) => o.isSpecific),
    basicas: plan.bibliography.filter((b) => b.kind === "BASIC"),
    complementares: plan.bibliography.filter((b) => b.kind === "COMPLEMENTARY"),
  };

  if (format === "docx") {
    const P = (text: string) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
    const H = (text: string) =>
      new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "PLANO DE ENSINO",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            H("1. Identificação"),
            ...sections.identificacao.split("\n").map(P),
            H("2. Ementa"),
            P(plan.ementa),
            H("3. Objetivos gerais"),
            P(plan.objetivosGerais),
            ...sections.geral.map((o) => P(`• ${o.description}`)),
            H("4. Objetivos específicos"),
            ...sections.especificos.map((o) => P(`• [${o.bloomLevel}] ${o.description}`)),
            H("5. Conteúdo programático"),
            ...plan.programUnits.flatMap((u) => [
              new Paragraph({
                children: [new TextRun({ text: u.title, bold: true })],
                spacing: { before: 120, after: 60 },
              }),
              P(u.content),
            ]),
            H("6. Metodologia"),
            P(plan.metodologia),
            H("7. Critérios de avaliação"),
            P(plan.criteriosAvaliacao),
            H("8. Bibliografia básica"),
            ...sections.basicas.map((b) => P(b.abntFormatted ?? `${b.authors}. ${b.title}.`)),
            H("9. Bibliografia complementar"),
            ...sections.complementares.map((b) => P(b.abntFormatted ?? `${b.authors}. ${b.title}.`)),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filenameBase}.docx"`,
      },
    });
  }

  // PDF
  const pdf = await PdfBuilder.create();
  pdf.title("PLANO DE ENSINO");
  pdf.meta(`Versão ${plan.version} · Gerado por professor.ai`);
  pdf.divider();
  pdf.heading("1. Identificação");
  pdf.paragraph(sections.identificacao);
  pdf.heading("2. Ementa");
  pdf.paragraph(plan.ementa);
  pdf.heading("3. Objetivos gerais");
  pdf.paragraph(plan.objetivosGerais);
  pdf.heading("4. Objetivos específicos (taxonomia de Bloom)");
  for (const o of sections.especificos) pdf.paragraph(`- [${o.bloomLevel}] ${o.description}`);
  pdf.heading("5. Conteúdo programático");
  for (const u of plan.programUnits) {
    pdf.subheading(u.title);
    pdf.paragraph(u.content);
  }
  pdf.heading("6. Metodologia");
  pdf.paragraph(plan.metodologia);
  pdf.heading("7. Critérios de avaliação");
  pdf.paragraph(plan.criteriosAvaliacao);
  pdf.heading("8. Bibliografia básica");
  for (const b of sections.basicas) pdf.paragraph(b.abntFormatted ?? `${b.authors}. ${b.title}.`);
  pdf.heading("9. Bibliografia complementar");
  for (const b of sections.complementares)
    pdf.paragraph(b.abntFormatted ?? `${b.authors}. ${b.title}.`);

  const bytes = await pdf.toBytes();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filenameBase}.pdf"`,
    },
  });
}
