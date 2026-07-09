import type { Role } from "@prisma/client";

/**
 * Contexto de tenant + usuário resolvido no início de cada request.
 * Toda query de negócio deve ser escopada por `institutionId` (ADR 0002).
 */
export type TenantContext = {
  institutionId: string;
  userId: string;
  isAdmin: boolean;
};

/**
 * Papel efetivo do usuário numa disciplina. Resolvido a partir de Membership
 * (ver docs/data-model.md). Retorna null se o usuário não tem vínculo.
 *
 * Placeholder — a implementar junto com o M10 (auth + memberships).
 */
export type DisciplineRole = Extract<Role, "PROFESSOR" | "ASSISTANT"> | null;

// Limites hard do M10 — validados na criação de Membership (convite).
export const MEMBERSHIP_LIMITS = {
  PROFESSOR: 2,
  ASSISTANT: 2,
} as const;
