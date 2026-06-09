import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { saveFactcheck } from "@/lib/cache";
import { runFactcheck } from "@/lib/factcheck";
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

  try {
    const result = await runFactcheck(parsed.data.text, parsed.data.title ?? "");
    const { dateKst, timeKst } = kstParts();
    const record: FactcheckRecord = {
      id: uuid(),
      title: parsed.data.title?.trim() || "원고 팩트 검증 결과",
      markdown: result.markdown,
      createdAt: new Date().toISOString(),
      dateKst,
      timeKst,
      retried: result.retried,
      cost: result.cost,
    };
    await saveFactcheck(record);
    return NextResponse.json({ id: record.id, cost: record.cost });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
