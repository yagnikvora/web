import type { Metadata } from "next";
import "./globals.css";
import TopTicker from "@/components/TopTicker";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "TradeFinder — Real-time Market Analysis",
  description: "Find the best trades available for stocks and indices.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TopTicker />
        <NavBar />
        <main className="max-w-[1400px] mx-auto px-5 py-6">{children}</main>
      </body>
    </html>
  );
}
