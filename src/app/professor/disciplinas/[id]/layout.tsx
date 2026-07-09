import Link from "next/link";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { Badge } from "@/components/ui";

const TABS = [
  { seg: "", label: "Visão geral" },
  { seg: "plano", label: "Plano de ensino" },
  { seg: "bibliografia", label: "Bibliografia" },
  { seg: "aulas", label: "Aula a aula" },
  { seg: "questoes", label: "Banco de questões" },
  { seg: "atividades", label: "Atividades" },
  { seg: "provas", label: "Provas" },
  { seg: "correcao", label: "Correção" },
  { seg: "alunos", label: "Alunos" },
];

export default async function DisciplineLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { discipline, role, user } = await requireDisciplineAccess(id, "view");

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">{discipline.name}</h1>
        <Badge color="gray">
          {discipline.course} · {discipline.term} · {discipline.workloadHours}h
        </Badge>
        {role ? (
          <Badge color={role === "PROFESSOR" ? "blue" : "purple"}>
            {role === "PROFESSOR" ? "Professor" : "Assistente"}
          </Badge>
        ) : user.isAdmin ? (
          <Badge color="gray">Admin (somente visão)</Badge>
        ) : null}
      </div>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {TABS.map((t) => (
          <Link
            key={t.seg}
            href={`/professor/disciplinas/${id}${t.seg ? `/${t.seg}` : ""}`}
            className="whitespace-nowrap rounded-t-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
