import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-sent events for live availability.
 *
 * The payload is only a hint — "something changed on this facility". Clients
 * respond by re-fetching the authoritative day view rather than by patching
 * local state from the message. That way a dropped, duplicated or out-of-order
 * event can never leave a screen disagreeing with the database; the worst it
 * can do is cost one extra fetch.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("ready", { at: Date.now() });

      const unsubscribe = subscribe((e) => send("change", e));

      // Proxies drop idle connections; a comment frame keeps it warm without
      // being delivered to the client as an event.
      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          closed = true;
        }
      }, 20_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Nginx and similar buffer by default, which would defeat streaming.
      "x-accel-buffering": "no",
    },
  });
}
