import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The signal log with outcomes. `?day=YYYY-MM-DD` for an earlier session.
export const GET = (req: Request) => proxy(`/pullback/history${new URL(req.url).search}`);
