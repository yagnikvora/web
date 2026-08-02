import type { Metadata } from "next";
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

// The ticker is server-rendered with real quotes so it never flashes empty, and a failed
// fetch simply omits it rather than showing an empty strip where levels should be.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ticker = await loadOverview().then((o) => o.ticker).catch(() => []);
  return (
    <html lang="en">
      <body className={manrope.className}>
        <Marquee initial={ticker} />
        <NavBar />
        <main className="max-w-[1400px] mx-auto px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
