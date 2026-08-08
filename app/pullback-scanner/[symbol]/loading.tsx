import { SkeletonDetail } from "@/components/skeleton";

// The "Chart →" link on every board row lands here, and the per-symbol fetch pulls candles
// for the chart — so this is the slowest hop in the module and the one that most needs a
// boundary to commit to.
export default function Loading() {
  return <SkeletonDetail back="the pullback scanner" />;
}
