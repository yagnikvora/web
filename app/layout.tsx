import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import TopTicker from "@/components/TopTicker";
import NavBar from "@/components/NavBar";
import { BRAND } from "@/lib/brand";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={manrope.className}>
        <TopTicker />
        <NavBar />
        <main className="max-w-[1400px] mx-auto px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
