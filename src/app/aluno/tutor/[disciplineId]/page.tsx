import Link from "next/link";
import { requireEnrollment } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui";
import { ChatForm } from "./chat-form";

/** Chat com o tutor de IA da disciplina (PRD M9). Mobile-first. */
export default async function TutorPage({
  params,
}: {
  params: Promise<{ disciplineId: string }>;
}) {
  const { disciplineId } = await params;
  const { student, discipline } = await requireEnrollment(disciplineId);

  const conversation = await prisma.tutorConversation.findFirst({
    where: { disciplineId, studentId: student.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  const messages = conversation?.messages ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <div className="mb-4">
        <Link href={`/aluno/disciplinas/${disciplineId}`} className="text-sm text-brand underline">
          ← {discipline.name}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Tutor da disciplina</h1>
          {discipline.socraticMode ? <Badge color="purple">Modo socrático</Badge> : null}
        </div>
        <p className="text-sm text-gray-500">
          Conhece todo o material publicado, os prazos e as suas correções liberadas. Cita as
          fontes e não faz atividades por você.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-900">Exemplos do que perguntar:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>&ldquo;Explique o conceito da aula 3 com um exemplo diferente&rdquo;</li>
              <li>&ldquo;Por que perdi pontos na questão 3 da Prova 1?&rdquo;</li>
              <li>&ldquo;Quais são as próximas entregas e os pesos das avaliações?&rdquo;</li>
            </ul>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                m.role === "student"
                  ? "ml-auto bg-brand text-brand-fg"
                  : "bg-white shadow-sm ring-1 ring-gray-200"
              }`}
            >
              {m.role === "tutor" ? (
                <>
                  <Markdown>{m.content}</Markdown>
                  {Array.isArray(m.citations) && (m.citations as string[]).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(m.citations as string[]).map((c, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                        >
                          {c.replace(/^\[Fonte:\s*/i, "").replace(/\]$/, "")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                m.content
              )}
            </div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 bg-gray-50 pb-2 pt-2">
        <ChatForm disciplineId={disciplineId} />
      </div>
    </main>
  );
}
