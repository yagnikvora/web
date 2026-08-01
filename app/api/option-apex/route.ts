import { NextResponse } from "next/server";
import { loadApex, DEFAULT_SCRIPT, DEFAULT_TF } from "@/lib/apex";

export const dynamic = "force-dynamic";

// Same-origin endpoint the page polls and re-queries from, so changing the index,
// timeframe or expiry never leaves the browser talking to the API host directly.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const data = await loadApex(
      q.get("script") || DEFAULT_SCRIPT,
      Number(q.get("tf")) || DEFAULT_TF,
      q.get("exp") || undefined,
    );
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
