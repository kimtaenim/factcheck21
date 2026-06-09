import { NextResponse } from "next/server";
import { listRecent } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET() {
  const items = await listRecent(50);
  return NextResponse.json({ items });
}
