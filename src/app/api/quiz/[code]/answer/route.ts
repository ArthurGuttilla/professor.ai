import { NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/auth/session";
import { getRoom, joinRoom, submitAnswer } from "@/modules/m5-activities/live-store";

/** Entrada e resposta do aluno no quiz ao vivo. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Faça login como aluno." }, { status: 401 });

  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; key?: string };

  if (body.action === "join") {
    const joined = joinRoom(code, student.id, student.name ?? student.email);
    if (!joined) return NextResponse.json({ error: "Sala encerrada." }, { status: 410 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "answer" && typeof body.key === "string") {
    const accepted = submitAnswer(code, student.id, body.key);
    return NextResponse.json({ ok: accepted });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
