"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, moduleForPath, moduleGloss, moduleLabel } from "@/lib/brand";
import AccountMenu from "@/components/AccountMenu";
import AlertSettings from "@/components/AlertSettings";

// Routes, grouped as the nav shows them. Labels come from lib/brand.ts, and the paths are
// deliberately NOT derived from them: a route is what people bookmark and what search
// engines hold, so renaming a module must not break either.
//
// The group labels went unused while the bar was one flat row. The phone menu uses them —
// on a screen that can only show a list, "Stocks" and "Index" are what make it scannable.
const GROUPS: { label: string; items: string[] }[] = [
  { label: "Stocks", items: ["/momentum-scanner", "/trend-day", "/market-pulse", "/sector-scope"] },
  { label: "Index", items: ["/option-clock", "/option-apex"] },
  { label: "Record", items: ["/trade-journal"] },
];

const ALL = GROUPS.flatMap((g) => g.items);

export default function NavBar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Matched by module rather than by exact path, so a symbol page keeps its scanner lit.
  const current = moduleForPath(path);

  // Close on arrival. Without this the panel stays open over the page the reader just
  // asked for — and since navigation is now instant, it would cover the skeleton too.
  useEffect(() => setOpen(false), [path]);

  // Escape closes it, and the body stops scrolling underneath while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const linkClass = (href: string) =>
    `rounded-lg font-medium transition-colors ${
      current === href ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-30 bg-[#0c1017] border-b border-border">
      {/* z-10 on the bar and the panel, nothing on the backdrop between them — that is what
          keeps the backdrop over the page but under the controls that dismiss it. */}
      <div className="relative z-10 flex items-center gap-3 lg:gap-6 px-3 sm:px-5 py-2.5 sm:py-3 bg-[#0c1017]">
        {/*
          The logo master, used as-is. It centres a 1223x416 wordmark inside a 1536x1024
          frame, so ~25% of its height is empty above and ~34% below — rendered whole at a
          nav-bar height the logo itself would be about 14px tall. The wrapper crops to the
          artwork instead, which keeps this pointing at the untouched source file.

          Numbers are that content box as fractions of the frame (x 8.92%, y 25.29%,
          w 79.62%, h 40.63%) solved for a 34px-tall logo. Re-derive them if the master is
          re-exported with different padding.
        */}
        <Link href="/" className="shrink-0" title={BRAND.tagline} aria-label={BRAND.name}>
          <span className="relative block w-[100px] h-[34px] overflow-hidden">
            <Image
              src="/images/Trinetra_navbar.png"
              alt={BRAND.name}
              width={1536}
              height={1024}
              priority
              sizes="126px"
              className="absolute select-none max-w-none"
              style={{ width: "125.5px", height: "83.7px", left: "-11.2px", top: "-21.2px" }}
            />
          </span>
        </Link>

        {/* The full bar, from lg up. Below that seven labels wrap into a header three rows
            deep, which on a phone is most of the screen before any content starts. */}
        <nav className="hidden lg:flex flex-wrap items-center gap-1">
          {ALL.map((href) => (
            <Link key={href} href={href} title={moduleGloss(href)} className={`${linkClass(href)} px-3 py-1.5 text-sm`}>
              {moduleLabel(href)}
            </Link>
          ))}
        </nav>

        {/* The module the reader is on. Only needed while the links are behind a button —
            above lg the highlighted tab already says it. */}
        {current && (
          <span className="lg:hidden text-[13px] font-semibold text-white/90 truncate min-w-0">
            {moduleLabel(current)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 text-muted text-sm shrink-0">
          {/* Before the account, not inside the phone menu: muting a channel is done in the
              fifteen seconds after it buzzed, and a control two taps deep is one nobody reaches
              in time. It is the same 36px target at every width for that reason. */}
          <AlertSettings />
          <AccountMenu />

          {/* 44px square — the smallest target that is reliably hittable with a thumb. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden grid place-items-center w-11 h-11 -mr-2 text-muted hover:text-white"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Dismiss-on-tap-outside. A div rather than a button because it must not take
              focus or appear in the tab order; Escape is the keyboard route out. */}
          <div role="presentation" onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 bg-black/60" />
          <nav
            id="mobile-nav"
            className="lg:hidden relative z-10 border-t border-border bg-[#0c1017] px-3 pb-4 pt-2 max-h-[70vh] overflow-y-auto"
          >
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-3 last:mb-0">
                <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted/70">
                  {g.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((href) => (
                    <Link key={href} href={href} className={`${linkClass(href)} px-3 py-2.5 text-[15px]`}>
                      {moduleLabel(href)}
                      <span className="block text-[11.5px] font-normal opacity-70 mt-0.5 leading-snug">
                        {moduleGloss(href)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
