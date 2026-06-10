import { NextResponse } from "next/server";
import { z } from "zod";
import { runFactcheckChatStream } from "@/lib/factcheck";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  text: z.string().max(50000).optional(),
  markdown: z.string().min(1).max(100000),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(10000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const result = await runFactcheckChatStream(
          parsed.data.text ?? "",
          parsed.data.markdown,
          parsed.data.messages,
          (text) => send({ type: "delta", text }),
        );
        send({
          type: "done",
          markdown: result.markdown,
          cost: result.cost,
        });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
