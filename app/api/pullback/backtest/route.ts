import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

/**
 * The one POST proxy in this app.
 *
 * `lib/proxy.ts` only forwards GETs, and widening it for this would give every read-only route a
 * body-forwarding path it does not want. The backtest is a POST because its request is a
 * four-field object rather than a query string, and because it is an action — it spends upstream
 * candle requests.
 *
 * A 400 from the backend is forwarded WITH its `issues` array rather than flattened to "upstream
 * 400": those issues are the validation messages the form has to show, and losing them would turn
 * "the range cannot exceed 180 days" into a blank error.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const res = await fetch(`${BASE}/pullback/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);

    if (!res.ok)
      return NextResponse.json(
        { error: j?.error ?? `upstream ${res.status}`, issues: j?.issues ?? [] },
        { status: res.status },
      );

    return NextResponse.json(
      { data: j?.payload?.data ?? null, source: j?.source },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
