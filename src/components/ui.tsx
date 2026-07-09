import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
    </div>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50";
const btnVariants = {
  primary: `${btnBase} bg-brand text-brand-fg hover:opacity-90`,
  secondary: `${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`,
  danger: `${btnBase} bg-red-600 text-white hover:bg-red-700`,
  ghost: `${btnBase} text-gray-600 hover:bg-gray-100`,
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof btnVariants }) {
  return <button {...props} className={`${btnVariants[variant]} ${className}`} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof btnVariants }) {
  return <Link {...props} className={`${btnVariants[variant]} ${className}`} />;
}

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-gray-700">{children}</label>;
}

const badgeColors: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
  purple: "bg-purple-100 text-purple-800",
};

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[color] ?? badgeColors.gray}`}
    >
      {children}
    </span>
  );
}

// Badges de estado do domínio (draft/published, fila de correção etc.)
export function StateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Rascunho", color: "yellow" },
    PUBLISHED: { label: "Publicado", color: "green" },
    PENDING_REVIEW: { label: "Aguardando validação", color: "yellow" },
    APPROVED: { label: "Aprovado", color: "blue" },
    RELEASED: { label: "Liberado", color: "green" },
    PENDING_LINK: { label: "Pendente vínculo", color: "red" },
    LINKED: { label: "Vinculada", color: "blue" },
    AI_GRADED: { label: "Corrigida (IA)", color: "purple" },
    VALIDATED: { label: "Validada", color: "blue" },
    UNLINKED: { label: "Sem vínculo", color: "red" },
    SUGGESTED: { label: "Vínculo sugerido", color: "yellow" },
    CONFIRMED: { label: "Vínculo confirmado", color: "green" },
  };
  const s = map[state] ?? { label: state, color: "gray" };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </div>
  );
}
