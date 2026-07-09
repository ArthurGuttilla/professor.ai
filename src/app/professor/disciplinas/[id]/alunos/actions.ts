"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/** Matricula alunos por lista de e-mails (um por linha: "email[;nome[;matrícula]]"). */
export async function enrollStudentsAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { user } = await requireDisciplineAccess(disciplineId, "draft");

  const lines = String(formData.get("list") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [email, name, registration] = line.split(";").map((s) => s?.trim());
    if (!email || !email.includes("@")) continue;
    const student = await prisma.student.upsert({
      where: { institutionId_email: { institutionId: user.institutionId, email: email.toLowerCase() } },
      update: { name: name || undefined, registration: registration || undefined },
      create: {
        institutionId: user.institutionId,
        email: email.toLowerCase(),
        name: name || null,
        registration: registration || null,
      },
    });
    await prisma.enrollment.upsert({
      where: { disciplineId_studentId: { disciplineId, studentId: student.id } },
      update: {},
      create: { disciplineId, studentId: student.id },
    });
  }
  revalidatePath(`/professor/disciplinas/${disciplineId}/alunos`);
}

export async function unenrollStudentAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  await requireDisciplineAccess(disciplineId, "draft");
  const enrollmentId = String(formData.get("enrollmentId"));
  await prisma.enrollment.deleteMany({ where: { id: enrollmentId, disciplineId } });
  revalidatePath(`/professor/disciplinas/${disciplineId}/alunos`);
}
