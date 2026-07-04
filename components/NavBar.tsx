"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; items: [string, string][] }[] = [
  { label: "Stocks", items: [
    ["Market Pulse", "/market-pulse"], ["Insider Strategy", "/insider-strategy"],
    ["Sector Scope", "/sector-scope"], ["Swing Spectrum", "/swing-spectrum"],
  ]},
  { label: "Index", items: [
    ["Option Clock", "/option-clock"], ["Option Apex", "/option-apex"],
    ["Index Mover", "/index-mover"], ["FII / DII", "/fii-dii"],
  ]},
];

export default function NavBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-6 px-5 py-3 bg-[#0c1017] border-b border-border">
      <Link href="/" className="text-lg font-extrabold tracking-tight shrink-0">
        Trade<span className="text-accent">Finder</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1">
        {GROUPS.flatMap((g) => g.items).map(([label, href]) => {
          const active = path === href;
          return (
            <Link key={href} href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"}`}>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2 text-muted text-sm shrink-0">
        <span className="hidden sm:inline">Yagnikpatel2956</span>
        <span className="grid place-items-center w-8 h-8 rounded-full bg-[#5a4a42] text-white font-bold">Y</span>
      </div>
    </header>
  );
}
