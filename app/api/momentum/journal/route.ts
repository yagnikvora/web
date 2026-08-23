import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The trade journal. Its own route rather than a query on /api/momentum because it is not a
// board — it reads from disk, answers for a date range, and is the one view that is worth
// loading when the market is shut.
export const GET = (req: Request) => {
  const qs = new URL(req.url).search;
  return proxy(`/momentum/journal${qs}`);
};
