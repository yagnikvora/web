import { NextResponse } from "next/server";
import { loadClock } from "@/lib/optionclock";

export const dynamic = "force-dynamic";

// Same-origin endpoint the page polls and re-queries from, so changing the index,
// expiry or time window never leaves the browser talking to the API host directly.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const data = await loadClock(q.get("script") || "NIFTY 50", q.get("exp") || undefined);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
