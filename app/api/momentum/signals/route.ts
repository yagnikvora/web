import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The entry feed — the board filtered to rows the timing layer has something to say about,
// ordered by entry quality rather than by score.
//
// A separate route from the board rather than a query on it, because the ordering is the
// whole point: sorting entries by score puts the most extended stock first, which is exactly
// the row the timing layer exists to demote.
export const GET = (req: Request) => {
  const qs = new URL(req.url).search;
  return proxy(`/momentum/signals${qs}`);
};
