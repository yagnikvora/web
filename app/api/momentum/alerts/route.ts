import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

// The alert panel's three calls. Hand-written rather than `lib/proxy`, which only forwards GET.
//
// The upstream refusals are passed through verbatim for the same reason the journal's exit route
// does it: "trendDay.minConviction must be a number between 0 and 100" tells whoever moved the
// slider what to do, and a flattened "failed to save" tells them nothing — and this panel decides
// whether a phone rings at 10:30, so a save that silently did not happen is the one outcome that
// must never look like a save that did.
const upstream = async (path: string, init?: RequestInit) => {
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok)
      return NextResponse.json(
        { error: j?.error ?? `upstream ${res.status}`, issues: j?.issues ?? null },
        { status: res.status },
      );
    return NextResponse.json({ data: j?.payload?.data ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
};

export const GET = () => upstream("/momentum/alerts/settings");

export async function PUT(req: Request) {
  const body = await req.text();
  return upstream("/momentum/alerts/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

// Back to whatever the server's .env says. DELETE rather than a second route file, because what
// it removes is the stored override — the settings themselves are never absent.
export const DELETE = () => upstream("/momentum/alerts/settings/reset", { method: "POST" });
