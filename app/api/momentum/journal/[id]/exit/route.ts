import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

// Close one open position at the live bid. Hand-written for the same reason the PATCH beside it
// is: `lib/proxy` only forwards GET.
//
// The upstream refusals are worth passing through verbatim rather than flattening to "failed".
// "already closed" and "the feed has no price for this contract" ask for completely different
// things from whoever clicked, and a generic error tells them neither.
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const res = await fetch(
      `${BASE}/momentum/journal/${encodeURIComponent(ctx.params.id)}/exit`,
      { method: "POST", cache: "no-store" },
    );
    const j = await res.json().catch(() => null);
    if (!res.ok)
      return NextResponse.json({ error: j?.error ?? `upstream ${res.status}` }, { status: res.status });
    return NextResponse.json({ data: j?.payload?.data ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
