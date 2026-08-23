import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

// PATCH is hand-written rather than going through `lib/proxy`, which only forwards GET. This is
// the one write the web app makes: replacing a recorded price with the fill actually received.
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await req.text();
    const res = await fetch(`${BASE}/momentum/journal/${encodeURIComponent(ctx.params.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);
    if (!res.ok)
      return NextResponse.json({ error: j?.error ?? `upstream ${res.status}` }, { status: res.status });
    return NextResponse.json({ data: j?.payload?.data ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
