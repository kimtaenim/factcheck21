import { NextResponse } from "next/server";
import { getFxMeta, setUsdKrwRate } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 무료·키 불필요 환율 소스 (USD 기준 전체 환율)
const FX_URL = "https://open.er-api.com/v6/latest/USD";

export async function GET(req: Request) {
  // Vercel Cron은 CRON_SECRET 설정 시 Authorization 헤더를 함께 보낸다.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const res = await fetch(FX_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`fx http ${res.status}`);
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const krw = data?.rates?.KRW;
    if (data?.result !== "success" || !krw || !Number.isFinite(krw)) {
      throw new Error("fx payload invalid");
    }

    const rate = Math.round(krw * 100) / 100;
    const date = new Date().toISOString().slice(0, 10);
    await setUsdKrwRate(rate, date);

    return NextResponse.json({ ok: true, rate, date });
  } catch (err) {
    // 실패 시 기존 저장값을 유지(덮어쓰지 않음)하고 그 값을 알려준다.
    const prev = await getFxMeta();
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        kept: prev?.rate ?? null,
      },
      { status: 502 },
    );
  }
}
