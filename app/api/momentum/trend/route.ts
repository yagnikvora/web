import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The one-sided-day feed. A separate route from `/api/momentum` for the same reason the
// backend keeps them apart: this list is ranked by conviction and is deliberately STABLE, so
// it is polled at a slower cadence and rendered without the churn the score-ranked board has.
export const GET = (req: Request) => {
  const qs = new URL(req.url).search;
  return proxy(`/momentum/trend${qs}`);
};
