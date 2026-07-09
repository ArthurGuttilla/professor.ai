import { NextResponse } from "next/server";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

/** Serve o scan da prova para o professor/assistente da disciplina. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; submissionId: string }> },
) {
  const { id, submissionId } = await ctx.params;
  await requireDisciplineAccess(id, "view");

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, exam: { disciplineId: id } },
  });
  if (!submission?.fileUrl) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const data = await readFile(submission.fileUrl);
  if (!data) return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": submission.mimeType ?? "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
