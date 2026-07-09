// Lógica de calendário do plano aula a aula (M3) — funções puras, testáveis.

export type CalendarInput = {
  startDate: Date;
  endDate: Date;
  /** Dias da semana com aula: 0=domingo … 6=sábado */
  weekdays: number[];
  /** Feriados e datas bloqueadas */
  holidays: Date[];
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Gera as datas de aula do semestre (exclui feriados). */
export function generateLessonDates(input: CalendarInput): Date[] {
  const dates: Date[] = [];
  const weekdaySet = new Set(input.weekdays);
  const cursor = new Date(
    Date.UTC(
      input.startDate.getUTCFullYear(),
      input.startDate.getUTCMonth(),
      input.startDate.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(input.endDate.getUTCFullYear(), input.endDate.getUTCMonth(), input.endDate.getUTCDate()),
  );

  while (cursor <= end) {
    if (weekdaySet.has(cursor.getUTCDay()) && !input.holidays.some((h) => sameDay(h, cursor))) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Posições (0-based) das aulas reservadas para avaliação, distribuídas
 * uniformemente pelo semestre com a última avaliação perto do fim.
 * Ex.: 16 aulas, 2 avaliações → posições ~7 e ~15.
 */
export function assessmentSlots(totalLessons: number, assessmentCount: number): number[] {
  if (assessmentCount <= 0 || totalLessons <= 0) return [];
  const count = Math.min(assessmentCount, totalLessons);
  const slots: number[] = [];
  for (let i = 1; i <= count; i++) {
    const pos = Math.round((totalLessons * i) / count) - 1;
    slots.push(Math.min(Math.max(pos, 0), totalLessons - 1));
  }
  // Remove duplicatas mantendo ordem.
  return [...new Set(slots)];
}

export type AlignmentCheck =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Alerta de desalinhamento (PRD M3): se o conteúdo programático não couber
 * no volume de aulas, sugerir cortes ou compressão. Heurística v1: ao menos
 * 2 aulas letivas (não-avaliação) por unidade.
 */
export function checkAlignment(unitCount: number, teachableSlots: number): AlignmentCheck {
  const needed = unitCount * 2;
  if (teachableSlots >= needed) return { ok: true };
  const deficit = needed - teachableSlots;
  return {
    ok: false,
    message:
      `O programa tem ${unitCount} unidade(s), que pedem ao menos ${needed} aulas letivas, ` +
      `mas o calendário oferece ${teachableSlots}. Faltam ~${deficit} aula(s): considere ` +
      `mesclar unidades, cortar tópicos ou adicionar dias de aula na semana.`,
  };
}
