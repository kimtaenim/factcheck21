import { NextResponse } from "next/server";
import { addToRecent } from "@/lib/cache";

export const runtime = "nodejs";

// 사용자가 결과를 확인하고 '저장'을 눌렀을 때만 최근 목록에 추가한다.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ok = await addToRecent(id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
