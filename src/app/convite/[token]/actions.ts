"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { acceptInvite } from "@/modules/m10-admin/service";
import { createUserSession } from "@/lib/auth/session";

export async function acceptInviteAction(_prev: { error?: string } | null, formData: FormData) {
  const token = String(formData.get("token"));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const newAccount =
      name && password ? { name, passwordHash: await bcrypt.hash(password, 10) } : undefined;
    const user = await acceptInvite(token, newAccount);
    await createUserSession(user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao aceitar convite.";
    if (msg === "ACCOUNT_REQUIRED") {
      return { error: "Preencha nome e senha para criar sua conta." };
    }
    return { error: msg };
  }
  redirect("/professor");
}
