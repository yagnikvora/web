import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Fired signals only, freshest first. Its own route rather than `?signalsOnly=1` on the board
// because it is polled at a much shorter interval and carries a much smaller payload — collapsing
// the two would force the heaviest response on the caller that asks most often.
export const GET = (req: Request) => proxy(`/pullback/signals${new URL(req.url).search}`);
