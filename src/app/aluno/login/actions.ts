"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createStudentSession, destroyStudentSession } from "@/lib/auth/session";

/**
 * Auth leve do aluno (PRD M8): e-mail institucional cadastrado pela disciplina.
 * Sem senha — o vínculo é a matrícula prévia feita pelo professor/admin.
 * (Q3 do PRD: e-mail institucional vs. pessoal segue aberto; v1 exige o
 * e-mail exato cadastrado na matrícula.)
 */
export async function studentLoginAction(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Informe seu e-mail institucional." };

  const student = await prisma.student.findFirst({ where: { email } });
  if (!student) {
    return { error: "E-mail não encontrado. Confirme com seu professor se você foi matriculado." };
  }

  await createStudentSession(student.id);
  redirect("/aluno");
}

export async function studentLogoutAction() {
  await destroyStudentSession();
  redirect("/aluno/login");
}
