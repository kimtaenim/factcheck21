import { NextResponse } from "next/server";
import { pruneDeadRecent } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 최근 목록에서 만료돼 사라진(깨진) 항목을 제거한다.
export async function POST() {
  const removed = await pruneDeadRecent();
  return NextResponse.json({ ok: true, removed });
}
