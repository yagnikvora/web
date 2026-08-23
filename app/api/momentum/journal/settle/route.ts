import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

// Force the settlement pass. The recording machine runs it from 15:15 anyway; this is for
// finishing a day from the machine you read it on, after shutting the other one down early.
export async function POST() {
  try {
    const res = await fetch(`${BASE}/momentum/journal/settle`, { method: "POST", cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok)
      return NextResponse.json({ error: j?.error ?? `upstream ${res.status}` }, { status: res.status });
    return NextResponse.json({ data: j?.payload?.data ?? null, note: j?.note });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
