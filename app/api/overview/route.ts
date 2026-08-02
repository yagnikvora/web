import { NextResponse } from "next/server";
import { loadOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

// Same-origin endpoint the ticker and the index cards poll, so the browser never talks to
// the API host directly.
export async function GET() {
  try {
    return NextResponse.json({ data: await loadOverview() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
