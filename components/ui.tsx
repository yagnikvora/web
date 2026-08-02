import { ReactNode } from "react";

/** A plain card, for content that isn't a table. Tables get `TableCard` from components/table. */
export function Panel({ title, badge, right, children, className = "" }: {
  title?: ReactNode; badge?: "live"; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || right) && (
        <header className="flex items-center gap-2 mb-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {badge === "live" && <span className="badge-live">● LIVE</span>}
          <div className="ml-auto">{right}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  if (source === "stale")
    return (
      <span className="text-[11px] px-2.5 py-1 rounded-full border text-sky-300 border-sky-800/70">
        LAST LIVE · NSE
      </span>
    );
  if (source === "upstox")
    return (
      <span className="text-[11px] px-2.5 py-1 rounded-full border text-bull border-emerald-800">
        LIVE · UPSTOX
      </span>
    );
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
