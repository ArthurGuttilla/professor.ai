import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { membershipLimitOk, type DisciplineRole } from "@/lib/auth/permissions";

/**
 * Conta vínculos "ocupando vaga" de um papel numa disciplina:
 * memberships existentes + convites pendentes (o limite é validado no convite,
 * conforme PRD M10 — "limite hard, validado no convite").
 */
export async function countRoleSlots(disciplineId: string, role: DisciplineRole) {
  const [members, pendingInvites] = await Promise.all([
    prisma.membership.count({ where: { disciplineId, role } }),
    prisma.invite.count({ where: { disciplineId, role, status: "PENDING" } }),
  ]);
  return members + pendingInvites;
}

export class MembershipLimitError extends Error {
  constructor(role: DisciplineRole) {
    super(
      role === "PROFESSOR"
        ? "Limite atingido: máximo de 2 professores por disciplina."
        : "Limite atingido: máximo de 2 assistentes por disciplina.",
    );
  }
}

/** Cria convite validando o limite hard ≤2 por papel. */
export async function createInvite(opts: {
  institutionId: string;
  disciplineId: string;
  email: string;
  role: DisciplineRole;
  invitedById: string;
}) {
  const { institutionId, disciplineId, email, role, invitedById } = opts;

  const slots = await countRoleSlots(disciplineId, role);
  if (!membershipLimitOk(role, slots)) throw new MembershipLimitError(role);

  const existingUser = await prisma.user.findUnique({
    where: { institutionId_email: { institutionId, email } },
  });
  if (existingUser) {
    const existing = await prisma.membership.findUnique({
      where: { disciplineId_userId: { disciplineId, userId: existingUser.id } },
    });
    if (existing) throw new Error("Este usuário já tem vínculo com a disciplina.");
  }

  return prisma.invite.create({
    data: {
      institutionId,
      disciplineId,
      email,
      role,
      invitedById,
      token: crypto.randomBytes(24).toString("hex"),
    },
  });
}

/**
 * Aceita um convite. Se o usuário não existe, cria a conta no fluxo do aceite
 * (PRD M10: "professor sem conta cria no fluxo do convite").
 * Revalida o limite no aceite para proteger contra corridas.
 */
export async function acceptInvite(token: string, newAccount?: { name: string; passwordHash: string }) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") throw new Error("Convite inválido ou já utilizado.");

  const members = await prisma.membership.count({
    where: { disciplineId: invite.disciplineId, role: invite.role },
  });
  if (!membershipLimitOk(invite.role as DisciplineRole, members)) {
    throw new MembershipLimitError(invite.role as DisciplineRole);
  }

  let user = await prisma.user.findUnique({
    where: { institutionId_email: { institutionId: invite.institutionId, email: invite.email } },
  });
  if (!user) {
    if (!newAccount) throw new Error("ACCOUNT_REQUIRED");
    user = await prisma.user.create({
      data: {
        institutionId: invite.institutionId,
        email: invite.email,
        name: newAccount.name,
        passwordHash: newAccount.passwordHash,
      },
    });
  }

  await prisma.$transaction([
    prisma.membership.create({
      data: {
        disciplineId: invite.disciplineId,
        userId: user.id,
        role: invite.role,
        acceptedAt: new Date(),
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  return user;
}
