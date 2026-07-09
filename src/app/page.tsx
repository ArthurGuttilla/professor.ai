import { redirect } from "next/navigation";
import { getCurrentStudent, getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.isAdmin ? "/admin" : "/professor");
  const student = await getCurrentStudent();
  if (student) redirect("/aluno");
  redirect("/login");
}
