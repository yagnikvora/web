import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// One stock's full breakdown. `config` and `status` are backend routes under the same
// prefix, and they are legitimate values here — the backend router declares them before its
// own /:symbol, so they resolve there rather than being read as a stock.
export const GET = (_req: Request, ctx: { params: { symbol: string } }) =>
  proxy(`/momentum/${encodeURIComponent(ctx.params.symbol)}`);
