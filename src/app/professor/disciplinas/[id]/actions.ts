"use server";

import { revalidatePath } from "next/cache";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/** Modo socrático do tutor (PRD M9) — configurável pelo professor. */
export async function toggleSocraticModeAction(formData: FormData) {
  const disciplineId = String(formData.get("disciplineId"));
  const { discipline } = await requireDisciplineAccess(disciplineId, "publish");
  await prisma.discipline.update({
    where: { id: disciplineId },
    data: { socraticMode: !discipline.socraticMode },
  });
  revalidatePath(`/professor/disciplinas/${disciplineId}`);
}
