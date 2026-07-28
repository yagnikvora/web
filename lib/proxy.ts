import { NextResponse } from "next/server";

// Same-origin proxy so the browser can poll for fresh data without CORS or
// env-var concerns. Always hits the backend live (no Next caching).
const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

export async function proxy(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    const j = await res.json();
    return NextResponse.json(
      { data: j.payload?.data ?? null, source: j.source },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
