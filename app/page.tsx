import Link from "next/link";
import { BRAND, MODULES, moduleGloss, moduleLabel } from "@/lib/brand";
import { loadOverview } from "@/lib/overview";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    return <HomeClient initial={await loadOverview()} />;
  } catch (e) {
    // The workspace links work with or without live quotes, so the page falls back to them
    // rather than to an error screen — and says why the numbers are missing instead of
    // showing placeholders that would read as real levels.
    return (
      <div>
        <h1 className="text-3xl sm:text-[42px] font-extrabold tracking-tight leading-[1.1]">{BRAND.tagline}</h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">{BRAND.description}</p>
        <div className="panel p-4 mt-6 mb-8">
          <p className="text-sm font-semibold mb-1">Live quotes unavailable</p>
          <p className="text-xs text-muted leading-relaxed">
            Nothing is shown in their place. Check that the API is running and that
            <code className="mx-1">UPSTOX_ACCESS_TOKEN</code> is set in <code>api/.env</code>.
          </p>
          <p className="text-[11px] text-muted/70 mt-2 font-mono break-words">{String((e as Error).message)}</p>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Object.keys(MODULES).map((href) => (
            <Link key={href} href={href} className="panel p-5 hover:border-accent/60 transition-colors group">
              <div className="text-lg font-bold group-hover:text-accent transition-colors">{moduleLabel(href)}</div>
              <p className="text-sm text-muted mt-2 leading-relaxed">{moduleGloss(href)}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }
}
