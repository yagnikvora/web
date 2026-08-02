"use client";

import { useEffect, useState } from "react";
import { isMarketOpen, REFRESH_MS } from "@/lib/live";
import type { TickerRow } from "@/lib/overview";

/**
 * The index ticker.
 *
 * Replaces a strip of ten hardcoded index levels — real-looking numbers that never moved
 * and matched nothing. These are the same quotes every other page draws.
 *
 * The scroll is a CSS animation over the list rendered twice: the copy is what makes the
 * wrap seamless, because the first copy leaves the viewport exactly as the second reaches
 * its starting position. `aria-hidden` on the duplicate keeps a screen reader from
 * announcing every index twice, and the animation pauses on hover so a number can actually
 * be read.
 */
export default function Marquee({ initial }: { initial: TickerRow[] }) {
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!isMarketOpen()) return; // frozen outside trading hours
      try {
        const res = await fetch("/api/overview", { cache: "no-store" });
        const j = await res.json();
        if (alive && j?.data?.ticker?.length) setRows(j.data.ticker as TickerRow[]);
      } catch { /* keep the last good strip */ }
    };
    const id = setInterval(poll, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!rows.length) return null;

  return (
    <div className="marquee bg-[#0a0e14] border-b border-border">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="marquee-copy" aria-hidden={copy === 1 || undefined}>
            {rows.map((r) => (
              <span key={r.name} className="inline-flex items-baseline gap-1.5 px-4 text-[12px] whitespace-nowrap">
                <span className="text-muted font-medium tracking-wide">{r.label}</span>
                <span className="font-semibold tabular-nums">
                  {r.last.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`tabular-nums font-medium ${r.pct >= 0 ? "text-bull" : "text-bear"}`}>
                  {r.pct >= 0 ? "▲" : "▼"} {Math.abs(r.pct).toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
