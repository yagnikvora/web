"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, VIEWER, moduleGloss, moduleLabel } from "@/lib/brand";

// Routes, grouped as the nav shows them. Labels come from lib/brand.ts, and the paths are
// deliberately NOT derived from them: a route is what people bookmark and what search
// engines hold, so renaming a module must not break either.
const GROUPS: { label: string; items: string[] }[] = [
  { label: "Stocks", items: ["/market-pulse", "/insider-strategy", "/sector-scope", "/swing-spectrum"] },
  { label: "Index", items: ["/option-clock", "/option-apex", "/index-mover", "/fii-dii"] },
];

export default function NavBar() {
  const path = usePathname();
  const initial = VIEWER.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-20 flex items-center gap-6 px-5 py-3 bg-[#0c1017] border-b border-border">
      <Link href="/" className="text-lg font-extrabold tracking-tight shrink-0" title={BRAND.tagline}>
        {BRAND.nameLead}<span className="text-accent">{BRAND.nameAccent}</span>
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
