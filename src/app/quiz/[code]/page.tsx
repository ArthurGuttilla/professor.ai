import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth/session";
import { getRoom } from "@/modules/m5-activities/live-store";
import { QuizPlayer } from "@/components/quiz-live";
import { Card } from "@/components/ui";

/** Entrada do aluno no quiz ao vivo via código/QR (mobile-first). */
export default async function QuizJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const student = await getCurrentStudent();
  if (!student) {
    redirect(`/aluno/login?next=/quiz/${code}`);
  }

  if (!getRoom(code)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Card>
          <p className="text-center text-sm text-gray-600">
            A sala <strong className="tracking-widest">{code.toUpperCase()}</strong> não está
            aberta. Aguarde o professor abrir o quiz e recarregue.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3 text-center">
        <span className="font-bold text-brand">professor.ai</span>
        <span className="ml-2 text-sm text-gray-400">Quiz ao vivo · sala {code.toUpperCase()}</span>
      </header>
      <QuizPlayer code={code.toUpperCase()} />
    </main>
  );
}
