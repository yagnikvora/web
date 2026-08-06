import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Upcoming pullbacks — at the zone, no confirmation yet. The feed a human can actually act on:
// by the time a confirmation candle has closed, the entry is already a bar old.
export const GET = (req: Request) => proxy(`/pullback/watch${new URL(req.url).search}`);
