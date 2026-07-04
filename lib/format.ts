export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const signCls = (n: number) => (n >= 0 ? "text-bull" : "text-bear");

export const tvLink = (sym: string) =>
  `https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym.replace("&", "_"))}&interval=5`;

export const timeOf = (epoch: number) =>
  new Date(epoch * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// treemap tile colour from % change, clamped to [-3, +3]
export function heatColor(p: number) {
  const x = Math.max(-3, Math.min(3, p)) / 3;
  if (x >= 0) return `rgb(${Math.round(46 - x * 22)},${Math.round(150 + x * 40)},${Math.round(85 - x * 12)})`;
  return `rgb(${Math.round(190 + -x * 35)},${Math.round(60 + x * 22)},${Math.round(64 + x * 6)})`;
}

export const titleCase = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
