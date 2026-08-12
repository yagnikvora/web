// The route-level loading boundary.
//
// Next.js wraps the segment in a Suspense boundary with this as its fallback, and it covers a
// different gap from the `<Suspense>` inside `page.tsx`. That one covers the DATA — the board being
// fetched and serialised. This one covers the ROUTE: on a cold navigation the page module and its
// client chunks have to arrive before anything in `page.tsx` can run at all, and without a
// `loading.tsx` the router holds the previous screen for that whole time.
//
// It re-exports the page's own skeleton rather than defining a second one, so both gaps show the
// SAME shape. Two different placeholders on one navigation reads as a layout jumping around, which
// is worse than either alone — and a skeleton that does not match the table it precedes makes the
// real content look like it moved when it arrives.
//
// Every board page in this app does this and the others point here for the reasoning.
export { default } from "./Skeleton";
