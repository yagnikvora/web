import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

/**
 * Re-grade the real trades under exit rules the reader supplies.
 *
 * A POST body rather than a query string because it carries a list of rules — a sweep across
 * twenty arming levels is twenty rules in one request, which is the whole point: asking them one
 * at a time would be twenty walks of the same archive.
 *
 * Its own hand-written route rather than `proxy()`, which only speaks GET.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const res = await fetch(`${BASE}/momentum/journal/exit-lab`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      // 404 here almost always means the API is running a build from before this endpoint
      // existed, which is worth saying rather than leaving as a bare status code.
      const hint = res.status === 404
        ? "the API has no /momentum/journal/exit-lab route — restart it to pick up the new endpoint"
        : j?.error ?? `upstream ${res.status}`;
      return NextResponse.json({ error: hint }, { status: res.status });
    }
    return NextResponse.json({ data: j?.payload?.data ?? null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
