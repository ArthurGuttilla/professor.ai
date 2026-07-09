"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createUserSession, destroyUserSession } from "@/lib/auth/session";

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou senha inválidos." };
  }

  await createUserSession(user.id);
  redirect(user.isAdmin ? "/admin" : "/professor");
}

export async function logoutAction() {
  await destroyUserSession();
  redirect("/login");
}
