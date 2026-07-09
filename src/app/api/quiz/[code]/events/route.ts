import { subscribe, getRoom } from "@/modules/m5-activities/live-store";

export const dynamic = "force-dynamic";

/** SSE: transmite o estado da sala do quiz ao vivo (M5). */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!getRoom(code)) {
    return new Response("Sala não encontrada", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      unsubscribe = subscribe(code, send);
      // Keepalive para proxies não fecharem a conexão.
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (keepalive) clearInterval(keepalive);
        }
      }, 15000);
    },
    cancel() {
      unsubscribe();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
