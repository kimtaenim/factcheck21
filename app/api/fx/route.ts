import { NextResponse } from "next/server";
import { DEFAULT_USD_KRW, getFxMeta } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const fx = await getFxMeta();
  return NextResponse.json({
    rate: fx?.rate ?? DEFAULT_USD_KRW,
    date: fx?.date ?? null,
    fallback: !fx,
  });
}
