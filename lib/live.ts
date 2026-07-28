"use client";

import { useEffect, useRef, useState } from "react";

export const REFRESH_MS = 60_000; // poll the backend every 1 min for fresh live data

// NSE trades 09:15–15:30 IST, Mon–Fri. Resolved in IST explicitly so the check is
// right whatever timezone the browser sits in. (Trading holidays aren't handled —
// on a holiday this still polls, the backend just keeps returning the same data.)
export function isMarketOpen(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday");
  if (day === "Sat" || day === "Sun") return false;
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

// Polls a same-origin proxy every REFRESH_MS and returns the freshest data.
// Starts from the server-rendered snapshot so the first paint is instant, then
// swaps in new data in place (widgets keep their search/sort — no remount, no reload).
export function useLiveData<T>(initial: T, url: string) {
  const [data, setData] = useState<T>(initial);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  // assume open for the server render; the first client-side check corrects it
  const [open, setOpen] = useState(true);
  const lastJson = useRef<string>("");

  useEffect(() => {
    let alive = true;
    async function poll() {
      if (!alive) return;
      const marketOpen = isMarketOpen();
      setOpen(marketOpen);
      // Outside trading hours the numbers are frozen for the day — skip the request
      // entirely. The interval keeps ticking so polling resumes on its own at 09:15.
      if (!marketOpen) return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const j = await res.json();
        if (!alive || !j?.data) return;
        // Only update state if something actually changed — avoids needless re-renders.
        const next = JSON.stringify(j.data);
        if (next !== lastJson.current) {
          lastJson.current = next;
          setData(j.data as T);
          setUpdatedAt(Date.now());
        }
      } catch {
        /* transient network/backend hiccup — keep showing last good data, retry next tick */
      }
    }
    setOpen(isMarketOpen()); // get the badge right on first paint
    const id = setInterval(poll, REFRESH_MS);
    // fire once shortly after mount so we don't wait a full interval for the first refresh
    const kick = setTimeout(poll, 3_000);
    return () => { alive = false; clearInterval(id); clearTimeout(kick); };
  }, [url]);

  return { data, updatedAt, open };
}
