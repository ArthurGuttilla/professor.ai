"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { createInvite } from "@/modules/m10-admin/service";
import type { DisciplineRole } from "@/lib/auth/permissions";

export async function createDisciplineAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const course = String(formData.get("course") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim();
  const workloadHours = Number(formData.get("workloadHours") ?? 0);
  if (!name || !course || !term || !workloadHours) throw new Error("Preencha todos os campos.");

  const discipline = await prisma.discipline.create({
    data: { institutionId: admin.institutionId, name, course, term, workloadHours },
  });
  redirect(`/admin/disciplinas/${discipline.id}`);
}

export async function inviteMemberAction(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
) {
  const admin = await requireAdmin();
  const disciplineId = String(formData.get("disciplineId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) as DisciplineRole;
  if (!email || !["PROFESSOR", "ASSISTANT"].includes(role)) return { error: "Dados inválidos." };

  const discipline = await prisma.discipline.findFirst({
    where: { id: disciplineId, institutionId: admin.institutionId },
  });
  if (!discipline) return { error: "Disciplina não encontrada." };

  try {
    await createInvite({
      institutionId: admin.institutionId,
      disciplineId,
      email,
      role,
      invitedById: admin.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao convidar." };
  }
  revalidatePath(`/admin/disciplinas/${disciplineId}`);
  return { ok: `Convite criado para ${email}.` };
}

export async function revokeInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const inviteId = String(formData.get("inviteId"));
  await prisma.invite.updateMany({
    where: { id: inviteId, institutionId: admin.institutionId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  revalidatePath("/admin/disciplinas");
}

export async function removeMembershipAction(formData: FormData) {
  const admin = await requireAdmin();
  const membershipId = String(formData.get("membershipId"));
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { discipline: true },
  });
  if (!membership || membership.discipline.institutionId !== admin.institutionId) return;
  await prisma.membership.delete({ where: { id: membershipId } });
  revalidatePath(`/admin/disciplinas/${membership.disciplineId}`);
}

export async function saveSlideTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "Template institucional").trim();
  const config = {
    primaryColor: String(formData.get("primaryColor") ?? "#1e3a8a"),
    secondaryColor: String(formData.get("secondaryColor") ?? "#f59e0b"),
    fontFamily: String(formData.get("fontFamily") ?? "system-ui, sans-serif"),
    coverText: String(formData.get("coverText") ?? ""),
    closingText: String(formData.get("closingText") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? "") || undefined,
  };

  const existing = await prisma.institutionTemplate.findFirst({
    where: { institutionId: admin.institutionId, kind: "SLIDES" },
  });
  if (existing) {
    await prisma.institutionTemplate.update({
      where: { id: existing.id },
      data: { name, config },
    });
  } else {
    await prisma.institutionTemplate.create({
      data: { institutionId: admin.institutionId, kind: "SLIDES", name, config },
    });
  }
  revalidatePath("/admin/templates");
}
