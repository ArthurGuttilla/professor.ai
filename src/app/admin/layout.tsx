import { requireAdmin } from "@/lib/auth/guards";
import { logoutAction } from "@/app/login/actions";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <AppShell
      title="Administração institucional"
      nav={[
        { href: "/admin", label: "Disciplinas" },
        { href: "/admin/templates", label: "Templates" },
      ]}
      userLabel={`${admin.name ?? admin.email} · ${admin.institution.name}`}
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
