const ITEMS: [string, number, number][] = [
  ["NIFTY 50", 24081.7, 0.67], ["BANKNIFTY", 51840.2, 0.42], ["SENSEX", 79210.5, 0.55],
  ["NIKKEI", 67960, -2.18], ["BTC/USD", 61642, 2.77], ["DAX", 25040, 0.18],
  ["FTSE", 10646, 1.64], ["S&P 500", 7457, -0.25], ["DOW", 52617, 0.75], ["HSI", 23055, 0.76],
];

export default function TopTicker() {
  return (
    <div className="flex gap-7 overflow-x-auto px-5 py-2 bg-[#0c1017] border-b border-border text-xs whitespace-nowrap">
      {ITEMS.map(([n, p, c]) => (
        <span key={n} className="shrink-0">
          <span className="text-muted mr-1.5">{n}</span>
          {p.toLocaleString("en-IN")}{" "}
          <span className={c >= 0 ? "text-bull" : "text-bear"}>{c >= 0 ? "+" : ""}{c}%</span>
        </span>
      ))}
    </div>
  );
}
