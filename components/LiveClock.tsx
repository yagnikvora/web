"use client";

import { useEffect, useState } from "react";

export default function LiveClock({ at, open }: { at: number; open: boolean }) {
  const [, tick] = useState(0);
  // re-render every second so the "updated Ns ago" label stays current — pointless
  // once the market is shut and nothing is refreshing, so stop ticking then
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open]);
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  const label = secs < 5 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-[#8a8aa0]">
      <span className={`w-2 h-2 rounded-full ${open ? "bg-[#2ec76a] animate-pulse" : "bg-[#8a8aa0]"}`} />
      {open ? `Live · updated ${label}` : "Market closed · showing last update"}
    </span>
  );
}
