import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The board. Query is passed through so the client's filters are applied server-side — filtering
// 215 rows in the browser would work, but the backend already owns the config's own limit and
// thresholds and should stay the one place that decides them.
export const GET = (req: Request) => proxy(`/pullback${new URL(req.url).search}`);
