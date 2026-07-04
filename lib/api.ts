import type { Envelope } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

export async function fetchData<T>(path: string): Promise<{ data: T; source?: string }> {
  const res = await fetch(BASE + path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  const j = (await res.json()) as Envelope<T>;
  return { data: j.payload.data, source: j.source };
}
