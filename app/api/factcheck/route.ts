import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { persistRecord } from "@/lib/cache";
import { runFactcheckStream } from "@/lib/factcheck";
import type { FactcheckRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  text: z.string().min(1).max(50000),
  title: z.string().max(200).optional(),
});

function kstParts(): { dateKst: string; timeKst: string } {
  const now = new Date();
  const dateKst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const timeKst = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return { dateKst, timeKst };
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "원고를 입력해주세요." }, { status: 400 });
  }

  // 결과 id를 미리 발급 — 클라이언트가 창을 벗어나 스트림이 끊겨도
  // 서버는 끝까지 돌려 이 id로 저장하고, 클라이언트는 이 id로 결과를 폴링해 복구한다.
  const id = uuid();
  const title = parsed.data.title?.trim() || "원고 팩트 검증 결과";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 클라이언트 연결이 끊겨도(enqueue 실패) 예외를 삼키고 작업은 끝까지 진행한다.
      let clientGone = false;
      const send = (obj: unknown) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          clientGone = true;
        }
      };
      try {
        // 시작 즉시 id 전달 — 클라이언트가 저장해 두고 나중에 폴링 가능
        send({ type: "started", id });
        const result = await runFactcheckStream(
          parsed.data.text,
          title,
          {
            onStatus: (text) => send({ type: "status", text }),
            onDelta: (text) => send({ type: "delta", text }),
          },
        );
        const { dateKst, timeKst } = kstParts();
        const record: FactcheckRecord = {
          id,
          title,
          markdown: result.markdown,
          createdAt: new Date().toISOString(),
          dateKst,
          timeKst,
          retried: result.retried,
          cost: result.cost,
        };
        // 클라이언트 연결 여부와 무관하게 저장(핵심: 창을 벗어나도 결과 보존)
        await persistRecord(record);
        send({
          type: "done",
          id: record.id,
          title: record.title,
          markdown: record.markdown,
          retried: record.retried,
          cost: record.cost,
          dateKst,
          timeKst,
        });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        try {
          controller.close();
        } catch {}
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
