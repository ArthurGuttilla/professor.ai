import { requireUser } from "@/lib/auth/guards";
import { logoutAction } from "@/app/login/actions";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell
      title="Área do professor"
      nav={[{ href: "/professor", label: "Minhas disciplinas" }]}
      userLabel={`${user.name ?? user.email} · ${user.institution.name}`}
      logout={
        <form action={logoutAction}>
          <Button variant="ghost" type="submit">
            Sair
          </Button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
