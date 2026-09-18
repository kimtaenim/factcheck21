import { NextResponse } from "next/server";
import { persistAllRecords } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 저장된 모든 결과의 만료(TTL)를 제거해 영구 보존한다(일회성 마이그레이션).
export async function POST() {
  const count = await persistAllRecords();
  return NextResponse.json({ ok: true, persisted: count });
}
