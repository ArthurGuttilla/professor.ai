import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shell compartilhado das áreas autenticadas.
 * Professor/admin: desktop-first. Aluno: mobile-first (nav compacta).
 */
export function AppShell({
  title,
  nav,
  userLabel,
  logout,
  children,
}: {
  title: string;
  nav: { href: string; label: string }[];
  userLabel: string;
  logout: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold text-brand">
              professor.ai
            </Link>
            <span className="hidden text-sm text-gray-400 sm:inline">{title}</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm text-gray-500 md:inline">
              {userLabel}
            </span>
            {logout}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
