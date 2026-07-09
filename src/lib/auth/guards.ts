import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentStudent, getCurrentUser } from "./session";
import { can, type Action, type DisciplineRole } from "./permissions";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/professor");
  return user;
}

export async function requireStudent() {
  const student = await getCurrentStudent();
  if (!student) redirect("/aluno/login");
  return student;
}

/**
 * Resolve o acesso do usuário logado a uma disciplina, garantindo tenancy
 * (a disciplina precisa ser da instituição do usuário) e, opcionalmente,
 * exigindo uma ação específica do RBAC (ver permissions.ts).
 */
export async function requireDisciplineAccess(disciplineId: string, action?: Action) {
  const user = await requireUser();
  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, institutionId: user.institutionId },
  });
  if (!discipline) redirect("/professor");

  const membership = await prisma.membership.findUnique({
    where: { disciplineId_userId: { disciplineId, userId: user.id } },
  });
  const role = (membership?.role as DisciplineRole | undefined) ?? null;

  // Admin pode VER (visão agregada), mas não edita conteúdo pedagógico.
  const isViewer = user.isAdmin || role !== null;
  if (!isViewer) redirect("/professor");

  if (action && action !== "view" && !can(role, action)) {
    throw new Error("Sem permissão para esta ação nesta disciplina.");
  }
  if (action === "view" && !user.isAdmin && !can(role, "view")) {
    redirect("/professor");
  }

  return { user, discipline, role };
}

/** Garante que o aluno logado está matriculado na disciplina (tenancy + escopo). */
export async function requireEnrollment(disciplineId: string) {
  const student = await requireStudent();
  const enrollment = await prisma.enrollment.findUnique({
    where: { disciplineId_studentId: { disciplineId, studentId: student.id } },
    include: { discipline: true },
  });
  if (!enrollment || enrollment.discipline.institutionId !== student.institutionId) {
    redirect("/aluno");
  }
  return { student, discipline: enrollment.discipline };
}
