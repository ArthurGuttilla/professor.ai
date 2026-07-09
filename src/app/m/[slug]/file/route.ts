import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

/** Serve o binário de um material PUBLICADO (alvo do viewer/QR). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const material = await prisma.material.findUnique({ where: { qrSlug: slug } });
  if (!material || material.status !== "PUBLISHED" || !material.fileUrl) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const data = await readFile(material.fileUrl);
  if (!data) return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": material.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${material.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
