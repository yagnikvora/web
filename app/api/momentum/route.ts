import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// The board. Query is passed through so the client's filters are applied server-side —
// filtering 208 rows in the browser would work, but the backend already knows the config's
// own limit and minScore and should stay the one place that decides them.
export const GET = (req: Request) => {
  const qs = new URL(req.url).search;
  return proxy(`/momentum${qs}`);
};
