"use server";

import { revalidatePath } from "next/cache";
import { requireEnrollment } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { buildTutorContext } from "@/modules/m9-tutor/context";
import { answerTutorQuestion } from "@/modules/m9-tutor/ai";

type ActionState = { error?: string } | null;

export async function sendTutorMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const disciplineId = String(formData.get("disciplineId"));
  const { student } = await requireEnrollment(disciplineId);
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return null;
  if (question.length > 2000) return { error: "Pergunta muito longa (máx. 2000 caracteres)." };

  let conversation = await prisma.tutorConversation.findFirst({
    where: { disciplineId, studentId: student.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    conversation = await prisma.tutorConversation.create({
      data: { disciplineId, studentId: student.id },
      include: { messages: true },
    });
  }

  await prisma.tutorMessage.create({
    data: { conversationId: conversation.id, role: "student", content: question },
  });

  try {
    const { disciplineName, socraticMode, context } = await buildTutorContext(
      disciplineId,
      student.id,
    );
    const response = await answerTutorQuestion({
      disciplineName,
      socraticMode,
      context,
      history: conversation.messages.map((m) => ({
        role: m.role as "student" | "tutor",
        content: m.content,
      })),
      question,
    });

    await prisma.tutorMessage.create({
      data: {
        conversationId: conversation.id,
        role: "tutor",
        content: response.answer,
        citations: response.citations,
      },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    const friendly =
      msg.includes("ANTHROPIC_API_KEY") || msg.toLowerCase().includes("api key")
        ? "O tutor está indisponível no momento (IA não configurada). Tente mais tarde."
        : "Não consegui responder agora. Tente novamente em instantes.";
    await prisma.tutorMessage.create({
      data: { conversationId: conversation.id, role: "tutor", content: friendly },
    });
  }

  revalidatePath(`/aluno/tutor/${disciplineId}`);
  return null;
}
