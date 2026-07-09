import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  closeRoom,
  endRoom,
  getRoom,
  reveal,
  startQuestion,
} from "@/modules/m5-activities/live-store";

/** Comandos do host (professor/assistente da disciplina). */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { disciplineId_userId: { disciplineId: room.disciplineId, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { command?: string };

  switch (body.command) {
    case "start":
    case "next":
      startQuestion(code, room.currentIndex + 1);
      break;
    case "reveal":
      reveal(code);
      break;
    case "end": {
      endRoom(code);
      if (!room.persisted) {
        room.persisted = true;
        for (const player of room.players.values()) {
          const attemptCount = await prisma.activityAttempt.count({
            where: { activityId: room.activityId, studentId: player.studentId },
          });
          const attempt = await prisma.activityAttempt.create({
            data: {
              activityId: room.activityId,
              studentId: player.studentId,
              attemptNumber: attemptCount + 1,
              submittedAt: new Date(),
              score: player.score,
            },
          });
          for (const [qIdx, ans] of player.answers) {
            const q = room.questions[qIdx];
            if (!q) continue;
            await prisma.attemptAnswer.create({
              data: {
                attemptId: attempt.id,
                questionId: q.id,
                answer: ans.key,
                isCorrect: ans.correct,
                points: ans.points,
                responseMs: ans.elapsedMs,
              },
            });
          }
        }
      }
      break;
    }
    case "close":
      closeRoom(code);
      break;
    default:
      return NextResponse.json({ error: "Comando inválido." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
