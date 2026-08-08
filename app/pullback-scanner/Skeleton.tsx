import { SkeletonBoard } from "@/components/skeleton";

// The board's placeholder, shown the instant the nav link is clicked and replaced when the
// data arrives. It lives here rather than in `loading.tsx` because BOTH boundaries use it:
// `loading.tsx` re-exports it for route-level navigation, and `page.tsx` uses it as the
// Suspense fallback so the server can flush the shell without waiting for the fetch.
//
// Counts are the real board's — 5 cards, 18 columns, a 740px table — so the swap does not
// move anything the reader has already started looking at.
export default function PullbackSkeleton() {
  return (
    <SkeletonBoard
      title="EMA Pullback Scanner"
      table="Pullback setups"
      strip={7}
      cards={5}
      cols={18}
      rows={9}
      height={740}
      filters={2}
    />
  );
}
