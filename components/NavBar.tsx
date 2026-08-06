"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, VIEWER, moduleGloss, moduleLabel } from "@/lib/brand";

// Routes, grouped as the nav shows them. Labels come from lib/brand.ts, and the paths are
// deliberately NOT derived from them: a route is what people bookmark and what search
// engines hold, so renaming a module must not break either.
const GROUPS: { label: string; items: string[] }[] = [
  { label: "Stocks", items: ["/momentum-scanner", "/trend-day", "/pullback-scanner", "/market-pulse", "/sector-scope"] },
  { label: "Index", items: ["/option-clock", "/option-apex"] },
];

export default function NavBar() {
  const path = usePathname();
  const initial = VIEWER.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-20 flex items-center gap-6 px-5 py-3 bg-[#0c1017] border-b border-border">
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
      <nav className="flex flex-wrap items-center gap-1">
        {GROUPS.flatMap((g) => g.items).map((href) => {
          const active = path === href;
          return (
            <Link key={href} href={href} title={moduleGloss(href)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"}`}>
              {moduleLabel(href)}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2 text-muted text-sm shrink-0">
        <span className="hidden sm:inline">{VIEWER.name}</span>
        <span className="grid place-items-center w-8 h-8 rounded-full bg-chip border border-border text-white font-bold">
          {initial}
        </span>
      </div>
    </header>
  );
}
