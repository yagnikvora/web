import { ReactNode } from "react";
import { fmt, signCls } from "@/lib/format";
import type { Signal } from "@/lib/types";

export function Panel({ title, badge, right, children, className = "" }: {
  title?: ReactNode; badge?: "live" | "demo"; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || right) && (
        <header className="flex items-center gap-2 mb-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {badge === "live" && <span className="badge-live">● LIVE</span>}
          {badge === "demo" && <span className="badge-demo">DEMO</span>}
          <div className="ml-auto">{right}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export const Pill = ({ signal }: { signal: Signal }) => (
  <span className={`pill ${signal === "BULL" ? "pill-bull" : "pill-bear"}`}>{signal}</span>
);

export const Pct = ({ v, suffix = "%" }: { v: number; suffix?: string }) => (
  <span className={signCls(v)}>{v >= 0 ? "+" : ""}{fmt(v)}{suffix}</span>
);

export function SourceBadge({ source }: { source?: string }) {
  const live = source === "nse";
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full border ${live ? "text-bull border-emerald-800" : "text-amber-400 border-amber-700/50"}`}>
      {live ? "LIVE · NSE" : "DEMO DATA"}
    </span>
  );
}

export const PageTitle = ({ children, source }: { children: ReactNode; source?: string }) => (
  <div className="flex items-center gap-3 mb-5">
    <h1 className="text-3xl font-extrabold tracking-tight">{children}</h1>
    <SourceBadge source={source} />
  </div>
);
