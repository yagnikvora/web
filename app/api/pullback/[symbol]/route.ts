import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// One symbol's full read: every timeframe's indicators, the raw bars the chart is drawn from, and
// today's signals on it. `?timeframe=` picks which bar series comes back.
export const GET = (req: Request, { params }: { params: { symbol: string } }) =>
  proxy(`/pullback/${encodeURIComponent(params.symbol)}${new URL(req.url).search}`);
