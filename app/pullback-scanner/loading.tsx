// The route-level loading boundary.
//
// This file is why the redirect is immediate. Without it the App Router has nothing to
// commit to when the link is clicked — it has to wait for the whole RSC payload, and this
// board's is by far the app's largest — so the browser stays on the PREVIOUS page for that
// whole time and the click reads as though it did nothing.
export { default } from "./Skeleton";
