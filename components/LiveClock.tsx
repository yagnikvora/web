"use client";

// "Live · updated 12s ago".
//
// THE CLOCK IS NEVER READ DURING RENDER. `Date.now()` in the render body runs once on the
// server and again during hydration, and the two are seconds apart — React compares the two
// outputs, finds "just now" against "6s ago", and throws the tree away. That is the
// `Text content does not match server-rendered HTML` error, and a component whose whole job
// is displaying the current time is the easiest place in an app to cause it.
//
// So `now` lives in state, starts null, and is only ever set from an effect — which does not
// run on the server. The first paint says "Live" with no age attached, which is what the
// server renders too, and the age appears a tick later once there is a browser clock to
// measure against.

import { useEffect, useState } from "react";

export default function LiveClock({ at, open }: { at: number | null; open: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    // Re-render every second so the age stays current — pointless once the market is shut
    // and nothing is refreshing, so stop ticking then.
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const age = (() => {
    if (now === null || at === null) return null;
    const secs = Math.max(0, Math.round((now - at) / 1000));
    return secs < 5 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
  })();

  return (
    <span className="flex items-center gap-1.5 text-[13px] text-[#8a8aa0]">
      <span className={`w-2 h-2 rounded-full ${open ? "bg-[#2ec76a] animate-pulse" : "bg-[#8a8aa0]"}`} />
      {open ? (age ? `Live · updated ${age}` : "Live") : "Market closed · showing last update"}
    </span>
  );
}
