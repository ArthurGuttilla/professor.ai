import { notFound, redirect } from "next/navigation";
import { requireDisciplineAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getRoom } from "@/modules/m5-activities/live-store";
import { QuizHost } from "@/components/quiz-live";

export default async function HostPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  await requireDisciplineAccess(id, "draft");

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, disciplineId: id, kind: "QUIZ_LIVE" },
  });
  if (!activity?.joinCode) notFound();
  if (!getRoom(activity.joinCode)) {
    redirect(`/professor/disciplinas/${id}/atividades/${activityId}`);
  }

  return <QuizHost code={activity.joinCode} disciplineId={id} />;
}
