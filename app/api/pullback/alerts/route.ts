import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The alert feed. Polled with `?since=<last event timestamp>`, which is deliberately
// subscription-free: the backend ring is bounded and in-process, so a client that missed ten
// minutes asks for ten minutes and gets exactly the events it missed — with nothing to lose
// across a page navigation or a backend restart.
export const GET = (req: Request) => proxy(`/pullback/alerts${new URL(req.url).search}`);
