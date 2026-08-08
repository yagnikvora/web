import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Marquee from "@/components/Marquee";
import NavBar from "@/components/NavBar";
import { BRAND } from "@/lib/brand";
import { loadOverview } from "@/lib/overview";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

/**
 * `maximumScale` is deliberately left alone.
 *
 * Locking zoom is the usual reflex on a dense dashboard and it is the wrong one here: these
 * boards print figures at 11px, and pinch-zoom is how somebody reads a strike price on a
 * phone. `viewportFit: "cover"` lets the page reach into the notch area, which the padding
 * below then accounts for.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0e14",
  viewportFit: "cover",
};

// The ticker is server-rendered with real quotes so it never flashes empty, and a failed
// fetch simply omits it rather than showing an empty strip where levels should be.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ticker = await loadOverview().then((o) => o.ticker).catch(() => []);
  return (
    <html lang="en">
      <body className={manrope.className}>
        <Marquee initial={ticker} />
        <NavBar />
        {/*
          Padding tightens on phones. At px-5 a 390px screen spends a tenth of its width on
          margins that a table then has to scroll to make up for — the content is the point,
          and the gutter is what gives way. The safe-area insets keep it clear of a notch in
          landscape, where the boards are actually usable.
        */}
        <main className="page-shell max-w-[1400px] mx-auto py-4 sm:py-6">{children}</main>
      </body>
    </html>
  );
}
