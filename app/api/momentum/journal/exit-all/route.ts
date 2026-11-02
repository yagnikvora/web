import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

// Close every open position of the day at its live bid. Hand-written for the same reason the
// single exit beside it is: `lib/proxy` only forwards GET. The per-row results are passed through
// whole, because "sold 17, one had no price" asks the operator to act on exactly one row.
export async function POST() {
  try {
    const res = await fetch(`${BASE}/momentum/journal/exit-all`, { method: "POST", cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok)
      return NextResponse.json({ error: j?.error ?? `upstream ${res.status}` }, { status: res.status });
    return NextResponse.json(
      { data: j?.payload?.data ?? null, note: j?.note },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
