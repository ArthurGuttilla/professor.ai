import { NextRequest, NextResponse } from "next/server";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { PdfBuilder } from "@/lib/pdf";

/**
 * Export da prova (PRD M6, P0) em 3 modos:
 *  - mode=prova     → PDF único (só a prova)
 *  - mode=completo  → PDF único com gabarito nas últimas páginas
 *  - mode=gabarito  → PDF do gabarito separado (par do modo "2 PDFs")
 * Gabarito inclui padrão de resposta das discursivas e a rubrica.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; examId: string }> }) {
  const { id, examId } = await ctx.params;
  const { discipline, user } = await requireDisciplineAccess(id, "view");

  const exam = await prisma.exam.findFirst({
    where: { id: examId, disciplineId: id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { question: true } },
      rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const mode = req.nextUrl.searchParams.get("mode") ?? "prova";
  const pdf = await PdfBuilder.create();

  const writeExamBody = () => {
    pdf.title(exam.title);
    pdf.meta(
      `${user.institution.name} · ${discipline.name} — ${discipline.course} · ${discipline.term} · ${exam.totalPoints} pontos`,
    );
    pdf.paragraph("Aluno(a): ______________________________________  Matrícula: ______________");
    pdf.divider();

    exam.questions.forEach((eq, i) => {
      const q = eq.question;
      pdf.subheading(`Questão ${i + 1} (${eq.points} pt${eq.points === 1 ? "" : "s"})`);
      if (q.baseText) pdf.paragraph(q.baseText);
      pdf.paragraph(q.statement);
      const options = (q.options as { key: string; text: string }[] | null) ?? [];
      if (q.type === "ESSAY") {
        for (let l = 0; l < 6; l++) {
          pdf.paragraph("_________________________________________________________________");
        }
      } else {
        for (const o of options) pdf.paragraph(`(${o.key}) ${o.text}`);
      }
      pdf.space(8);
    });
  };

  const writeAnswerKey = () => {
    pdf.title(`Gabarito — ${exam.title}`);
    pdf.meta(`${discipline.name} · ${discipline.term}`);
    pdf.divider();

    pdf.heading("Respostas");
    exam.questions.forEach((eq, i) => {
      const q = eq.question;
      if (q.type === "ESSAY") {
        pdf.subheading(`Questão ${i + 1} — discursiva (${eq.points} pts)`);
        pdf.paragraph(`Padrão de resposta: ${q.answerKey ?? "(não definido)"}`);
      } else {
        pdf.paragraph(`Questão ${i + 1}: ${q.correctKey ?? "?"} (${eq.points} pts)`);
      }
    });

    if (exam.rubric && exam.rubric.criteria.length > 0) {
      pdf.heading("Rubrica de correção");
      for (const c of exam.rubric.criteria) {
        const qIndex = exam.questions.findIndex((eq) => eq.questionId === c.questionId);
        pdf.subheading(
          `${c.criterion} — ${c.points} pt${c.points === 1 ? "" : "s"}${qIndex >= 0 ? ` (Questão ${qIndex + 1})` : " (geral)"}`,
        );
        if (c.description) pdf.paragraph(c.description);
      }
      const total = exam.rubric.criteria.reduce((acc, c) => acc + c.points, 0);
      pdf.space(6);
      pdf.paragraph(`Pontos totais da avaliação: ${total}`);
    }
  };

  if (mode === "gabarito") {
    writeAnswerKey();
  } else {
    writeExamBody();
    if (mode === "completo") {
      pdf.newPage();
      writeAnswerKey();
    }
  }

  const bytes = await pdf.toBytes();
  const suffix = mode === "gabarito" ? "-gabarito" : mode === "completo" ? "-com-gabarito" : "";
  // Headers HTTP são ByteString: filename precisa ser ASCII-safe.
  const safeName = exam.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName || "prova"}${suffix}.pdf"`,
    },
  });
}
