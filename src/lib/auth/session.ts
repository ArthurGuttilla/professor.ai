import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";

const USER_COOKIE = "pa_session";
const STUDENT_COOKIE = "pa_student";
const SESSION_DAYS = 7;

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function expiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

// ── Professor / Admin / Assistente (User) ─────────────────────────

export async function createUserSession(userId: string) {
  const token = newToken();
  await prisma.session.create({ data: { userId, token, expiresAt: expiry() } });
  (await cookies()).set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiry(),
  });
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { institution: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function destroyUserSession() {
  const store = await cookies();
  const token = store.get(USER_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  store.delete(USER_COOKIE);
}

// ── Aluno (auth leve por e-mail institucional — ver PRD M8) ───────

export async function createStudentSession(studentId: string) {
  const token = newToken();
  await prisma.studentSession.create({ data: { studentId, token, expiresAt: expiry() } });
  (await cookies()).set(STUDENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiry(),
  });
}

export const getCurrentStudent = cache(async () => {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.studentSession.findUnique({
    where: { token },
    include: { student: { include: { institution: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.student;
});

export async function destroyStudentSession() {
  const store = await cookies();
  const token = store.get(STUDENT_COOKIE)?.value;
  if (token) await prisma.studentSession.deleteMany({ where: { token } });
  store.delete(STUDENT_COOKIE);
}
