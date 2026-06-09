import { NextResponse } from "next/server";
import { deleteFactcheck, loadFactcheck } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const record = await loadFactcheck(id);
  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ok = await deleteFactcheck(id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
