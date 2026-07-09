// Regras de permissão do PRD (M10) como funções puras e testáveis.
//
// - Admin: CRUD de disciplinas, vínculos, templates, visão agregada.
//   NÃO edita conteúdo pedagógico.
// - Professor: tudo dentro da disciplina (publica, valida notas, edita plano).
// - Assistente: cria/edita RASCUNHOS e faz triagem de correção;
//   não publica, não valida notas, não edita plano de ensino.

export type DisciplineRole = "PROFESSOR" | "ASSISTANT";

export type Action =
  | "view" // ver conteúdo da disciplina
  | "draft" // criar/editar rascunhos de materiais e atividades
  | "publish" // publicar materiais/atividades/provas
  | "validate" // validar correções e liberar notas/feedback
  | "editPlan" // editar plano de ensino
  | "triage"; // triagem/vínculo de correção

const PERMISSIONS: Record<DisciplineRole, ReadonlySet<Action>> = {
  PROFESSOR: new Set(["view", "draft", "publish", "validate", "editPlan", "triage"]),
  ASSISTANT: new Set(["view", "draft", "triage"]),
};

export function can(role: DisciplineRole | null, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[role].has(action);
}

// Limites hard do M10, validados no convite E no aceite.
export const MEMBERSHIP_LIMITS: Record<DisciplineRole, number> = {
  PROFESSOR: 2,
  ASSISTANT: 2,
};

/**
 * Valida se um novo vínculo com `role` cabe nos limites, dado o total de
 * vínculos existentes (aceitos + convites pendentes) para esse papel.
 */
export function membershipLimitOk(role: DisciplineRole, existingCount: number): boolean {
  return existingCount < MEMBERSHIP_LIMITS[role];
}
