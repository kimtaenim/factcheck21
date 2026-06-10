import { NextResponse } from "next/server";
import { z } from "zod";
import { loadFactcheck, updateFactcheck } from "@/lib/cache";
import { runSynthesisStream } from "@/lib/factcheck";
import type { FactcheckRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  text: z.string().max(50000).optional(),
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const record = await loadFactcheck(id);
  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const result = await runSynthesisStream(
          parsed.data.text ?? "",
          record.markdown,
          parsed.data.messages,
          (text) => send({ type: "delta", text }),
        );
        const mergedCost = {
          input_tokens: record.cost.input_tokens + result.cost.input_tokens,
          output_tokens: record.cost.output_tokens + result.cost.output_tokens,
          cost_usd: +(record.cost.cost_usd + result.cost.cost_usd).toFixed(4),
          cost_krw: record.cost.cost_krw + result.cost.cost_krw,
        };
        const updated: FactcheckRecord = {
          ...record,
          markdown: result.markdown,
          synthesized: true,
          cost: mergedCost,
        };
        await updateFactcheck(updated);
        send({ type: "done", markdown: updated.markdown, cost: mergedCost });
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
