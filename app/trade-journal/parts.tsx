"use client";

// The journal's furniture: the hero, the metric tiles, the three analytics panels and the two
// small visuals the table rows are built out of.
//
// They live here rather than in components/ because none of them is general — a path bar that
// assumes MFE/MAE and a calendar that skips weekends are journal ideas, and pretending they are
// shared components would only invite a second caller to bend them.

import { Fragment, ReactNode } from "react";
import EChart from "@/components/EChart";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { tvLink } from "@/lib/format";
import {
  CHANNEL_LABEL, EXIT_LABEL, inr, JournalTotals, JournalView, pct, plural,
  type ExitReason, type JournalChannel,
} from "@/lib/journal";
import { equityOption, shadowOption } from "./charts";
import { type CalMonth, type EquityPoint, type Rollup } from "./analytics";

/* -------------------------------------------------------------------------- helpers --- */

/** Green above zero, red below, grey on nothing. The one rule every number on the page obeys. */
export const sign = (n: number | null | undefined) =>
  n === null || n === undefined ? "text-muted" : n > 0 ? "text-bull" : n < 0 ? "text-bear" : "text-muted";

/**
 * A rupee figure short enough for a calendar cell: 9142 → "+₹9.1k", −173400 → "−₹1.7L".
 *
 * The sign leads, not the currency, because these are read down a column where what matters
 * first is which way the day went.
 */
export function short(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const lead = `${n < 0 ? "−" : "+"}₹`;
  if (a >= 100_000) return `${lead}${(a / 100_000).toFixed(a >= 1_000_000 ? 0 : 1)}L`;
  if (a >= 1_000) return `${lead}${(a / 1_000).toFixed(1)}k`;
  return `${lead}${Math.round(a)}`;
}

/** A date the way it is spoken, not the way it is stored. */
export const pretty = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });

/* ------------------------------------------------------------------ segmented control --- */

/**
 * The one control shape this page uses for a choice out of a short list.
 *
 * A real segmented control — one recessed track with a raised active pill — rather than a row
 * of independent buttons. On a page carrying four separate choices, the track is what tells
 * you at a glance which four they are.
 */
export function Segmented<T extends string | number>({ value, options, onChange, size = "md" }: {
  value: T;
  options: Array<{ k: T; label: ReactNode; title?: string; badge?: ReactNode }>;
  onChange: (k: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl bg-black/25 border border-border p-0.5">
      {options.map((o) => {
        const on = o.k === value;
        return (
          <button
            key={String(o.k)}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(o.k)}
            className={`rounded-[9px] font-medium whitespace-nowrap transition-colors ${pad} ${
              on
                ? "bg-accent/90 text-white shadow-[0_1px_0_rgba(255,255,255,.18)_inset]"
                : "text-muted hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {o.label}
            {o.badge !== undefined && (
              <span className={`ml-1.5 tabular-nums ${on ? "text-white/70" : "text-muted/70"}`}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A small square button — the date steppers and the manual refresh. */
export function IconButton({ children, onClick, disabled, title }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-[32px] w-[32px] grid place-items-center rounded-lg border border-border bg-chip text-muted
                 hover:text-white hover:border-white/20 disabled:opacity-35 disabled:hover:text-muted
                 disabled:hover:border-border transition-colors"
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------------- tiles --- */

/** The split bar under a win rate. Two tones, one track, no legend needed. */
export function WinBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  // An empty track rather than a red one when nothing has been decided — a full-width loss bar
  // is a statement, and "no trades yet" is not that statement.
  return (
    <div
      className={`mt-2 h-[5px] rounded-full overflow-hidden ${total ? "bg-bear/25" : "bg-white/[0.06]"}`}
      title={total ? `${wins} won, ${losses} lost` : "nothing decided yet"}
    >
      {total > 0 && (
        <div className="h-full rounded-full bg-bull/80" style={{ width: `${(100 * wins) / total}%` }} />
      )}
    </div>
  );
}

export function StatCard({ label, value, note, cls = "", hint }: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  cls?: string;
  /** Tooltip on the label — where a definition goes, so the tile itself stays a number. */
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-3.5 transition-colors hover:border-white/15">
      <div
        className={`text-[10px] uppercase tracking-[0.09em] text-muted ${hint ? "cursor-help" : ""}`}
        title={hint}
      >
        {label}
      </div>
      <div className={`text-[20px] leading-tight font-bold tabular-nums mt-1.5 ${cls}`}>{value}</div>
      {note && <div className="text-[11px] text-muted mt-1 truncate">{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------------ hero --- */

/**
 * The number the page exists to report, and the shape of how it got there.
 *
 * Everything else on the page is a way of interrogating these two things, so they are given the
 * top of the screen and nothing competes with them. The realised total is the headline; open
 * positions are a separate chip beside it and are never added in, because a day's result that
 * moves every fifteen seconds is not a result.
 */
export function Hero({ totals, roll, rangeLabel, live, config, right }: {
  totals: JournalTotals;
  roll: Rollup;
  rangeLabel: string;
  live: { open: number; marked: number; net: number; netPct: number | null };
  config: JournalView["config"];
  right?: ReactNode;
}) {
  const up = totals.netPnl >= 0;
  const curve: EquityPoint[] = roll.equity;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-border bg-panel
                  ${up ? "shadow-[0_20px_60px_-40px_rgba(46,199,106,.55)]" : "shadow-[0_20px_60px_-40px_rgba(229,72,77,.55)]"}`}
    >
      {/* The wash is the only place on the page where the result is stated as a colour rather
          than as a figure. Kept far under the type so it tints the card without staining it. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: up
            ? "radial-gradient(120% 100% at 0% 0%, rgba(46,199,106,.13), transparent 55%)"
            : "radial-gradient(120% 100% at 0% 0%, rgba(229,72,77,.13), transparent 55%)",
        }}
      />

      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Net P&amp;L</span>
            <span className="text-[11px] text-muted">· {rangeLabel}</span>
            <div className="ml-auto lg:hidden">{right}</div>
          </div>

          <div className="flex items-end gap-3 flex-wrap mt-1.5">
            <div className={`text-[40px] sm:text-[46px] leading-[1.05] font-extrabold tabular-nums ${sign(totals.netPnl)}`}>
              {inr(totals.netPnl, true)}
            </div>
            {totals.netPct !== null && (
              <div
                className={`mb-1.5 text-[13px] font-semibold tabular-nums px-2 py-1 rounded-lg ${
                  up ? "bg-bull/[0.12] text-bull" : "bg-bear/[0.12] text-bear"
                }`}
                title="net as a percentage of the premium deployed"
              >
                {pct(totals.netPct)}
              </div>
            )}
            {live.open > 0 && (
              <div
                className="mb-1.5 text-[12px] tabular-nums px-2 py-1 rounded-lg border border-accent/40 bg-accent/10"
                title={`${live.marked} of ${live.open} open positions are priced right now`}
              >
                <span className="text-accent">{live.open} open</span>
                {live.marked > 0 && (
                  <span className={`ml-1.5 font-semibold ${sign(live.net)}`}>{inr(live.net, true)}</span>
                )}
              </div>
            )}
          </div>

          {/* Where the headline came from. Charges are a seventh of the gross here, which is
              exactly the sort of thing a net-only number lets you forget. */}
          <div className="text-[11.5px] text-muted mt-2 tabular-nums">
            gross <span className={sign(totals.grossPnl)}>{inr(totals.grossPnl, true)}</span>
            <span className="mx-1.5 opacity-50">−</span>
            charges <span className="text-bear">{inr(totals.charges)}</span>
            <span className="mx-1.5 opacity-50">=</span>
            <span className={`font-semibold ${sign(totals.netPnl)}`}>{inr(totals.netPnl, true)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <MicroStat label="Trades" value={String(totals.trades)} note={`${totals.wins}W / ${totals.losses}L`} />
            <MicroStat
              label="Win rate"
              value={totals.winRate === null ? "—" : pct(totals.winRate, 1, false)}
              note={roll.scored ? `of ${plural(roll.scored, "settled trade")}` : "nothing settled"}
            />
            <MicroStat
              label="Profit factor"
              value={roll.profitFactor === null ? "—" : `${roll.profitFactor.toFixed(2)}×`}
              note="won per ₹1 lost"
              cls={roll.profitFactor === null ? "" : roll.profitFactor >= 1 ? "text-bull" : "text-bear"}
            />
            <MicroStat
              label="Per trade"
              value={inr(roll.expectancy, true)}
              note="expectancy"
              cls={sign(roll.expectancy)}
            />
          </div>
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.09em] text-muted">Equity curve</span>
            <span className="text-[11px] text-muted">
              {curve.length ? plural(curve.length, "settled trade") : "nothing settled yet"}
            </span>
            <div className="ml-auto hidden lg:block">{right}</div>
          </div>
          {curve.length > 1 ? (
            <EChart option={equityOption(curve, true)} height={148} className="mt-1 -mx-1" />
          ) : (
            <div className="mt-1 h-[148px] rounded-xl border border-dashed border-border grid place-items-center">
              <p className="text-[12px] text-muted px-4 text-center">
                {curve.length === 1
                  ? "One settled trade. A curve needs a second point."
                  : "No settled trades in this range yet."}
              </p>
            </div>
          )}
          <p className="text-[10.5px] text-muted mt-1">
            Cumulative net, trade by trade, after {`₹${config.chargePerLot}`}/lot of charges.
            {roll.maxDrawdown > 0 && (
              <span className="text-bear/90">
                {" "}Deepest dip {inr(-roll.maxDrawdown)}
                {roll.maxDrawdownAt ? ` on ${pretty(roll.maxDrawdownAt)}` : ""}.
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function MicroStat({ label, value, note, cls = "" }: {
  label: string; value: string; note: string; cls?: string;
}) {
  return (
    <div className="rounded-xl bg-black/20 border border-border/70 px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.09em] text-muted">{label}</div>
      <div className={`text-[16px] font-bold tabular-nums leading-tight mt-0.5 ${cls}`}>{value}</div>
      <div className="text-[10px] text-muted truncate">{note}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- the edge --- */

/** Per-channel scorecard. The comparison the journal was built to make. */
export function ChannelEdge({ rows, onPick, active }: {
  rows: JournalTotals["byChannel"];
  onPick: (c: JournalChannel) => void;
  active: JournalChannel | "all";
}) {
  const worst = Math.max(1, ...rows.map((r) => Math.abs(r.netPnl)));
  if (!rows.length) return <p className="text-[12px] text-muted">No channel has traded in this range.</p>;

  // Biggest contributor first. The order the API happens to return them in is the order they
  // were declared, which tells the reader nothing about which one is carrying the range.
  const ranked = [...rows].sort((a, b) => b.netPnl - a.netPnl);

  return (
    <div className="space-y-2.5">
      {ranked.map((r) => {
        const on = active === r.channel;
        return (
          <button
            key={r.channel}
            type="button"
            onClick={() => onPick(r.channel as JournalChannel)}
            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
              on ? "border-accent/50 bg-accent/[0.07]" : "border-border bg-black/20 hover:border-white/15"
            }`}
            title={`Show only ${CHANNEL_LABEL[r.channel as JournalChannel] ?? r.channel}`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold truncate">
                {CHANNEL_LABEL[r.channel as JournalChannel] ?? r.channel}
              </span>
              <span className="text-[11px] text-muted">{plural(r.trades, "trade")}</span>
              <span className={`ml-auto text-[14px] font-bold tabular-nums ${sign(r.netPnl)}`}>
                {inr(r.netPnl, true)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.netPnl >= 0 ? "bg-bull/75" : "bg-bear/75"}`}
                  style={{ width: `${Math.max(3, (100 * Math.abs(r.netPnl)) / worst)}%` }}
                />
              </div>
              <span className="text-[10.5px] text-muted tabular-nums shrink-0">
                {r.winRate === null ? "—" : `${pct(r.winRate, 0, false)} won`}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const EXIT_TONE: Record<ExitReason, { bar: string; text: string }> = {
  target: { bar: "bg-bull", text: "text-bull" },
  stop: { bar: "bg-bear", text: "text-bear" },
  // Its own colour rather than a shade of the target's: it is a different rule firing, and two
  // greens a step apart in a legend are two greens.
  checkpoint: { bar: "bg-teal-400", text: "text-teal-300" },
  "square-off": { bar: "bg-accent", text: "text-accent" },
  manual: { bar: "bg-amber-400", text: "text-amber-400" },
  untracked: { bar: "bg-white/25", text: "text-muted" },
};

/** How the positions actually ended, as one bar plus a key that carries the money. */
export function ExitMix({ exits }: { exits: Rollup["exits"] }) {
  const total = exits.reduce((a, e) => a + e.n, 0);
  if (!total) return <p className="text-[12px] text-muted">Nothing has closed in this range.</p>;

  return (
    <div>
      <div className="flex h-[8px] rounded-full overflow-hidden bg-white/[0.06] gap-[2px]">
        {exits.map((e) => (
          <div
            key={e.reason}
            className={EXIT_TONE[e.reason].bar}
            style={{ width: `${(100 * e.n) / total}%`, opacity: 0.85 }}
            title={`${EXIT_LABEL[e.reason]} · ${e.n}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {exits.map((e) => (
          <li key={e.reason} className="flex items-center gap-2 text-[12px]">
            <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${EXIT_TONE[e.reason].bar}`} />
            <span className="text-white/90">{EXIT_LABEL[e.reason]}</span>
            <span className="text-muted tabular-nums">{e.n}</span>
            <span className="text-muted/60 text-[10.5px] tabular-nums">
              {Math.round((100 * e.n) / total)}%
            </span>
            <span className={`ml-auto tabular-nums font-medium ${sign(e.net)}`}>{inr(e.net, true)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- calendar --- */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * A month at a glance, weekdays only, with each week totalled in a sixth column.
 *
 * THE CELLS ARE A FIXED HEIGHT, NOT A SQUARE. A square cell in a panel this wide is 200px tall
 * and the month becomes a poster; 72px keeps a whole month on screen at a size a figure can
 * still be read at, and lets the cell widen with the panel instead of growing downward.
 *
 * The tint is scaled against the biggest day in the range rather than against a fixed rupee
 * ladder, so a quiet fortnight still shows its own shape instead of rendering flat grey. It is
 * kept deliberately low — the colour says which way and roughly how much, the figure says
 * exactly how much, and a wall of saturated blocks would drown the second job in the first.
 */
export function CalendarGrid({ months, onPick, selected }: {
  months: CalMonth[];
  onPick: (day: string) => void;
  selected?: string;
}) {
  const peak = Math.max(
    1,
    ...months.flatMap((m) => m.weeks.map((w) => w.map((c) => Math.abs(c.point?.net ?? 0)))).flat(),
  );
  const tint = (net: number | null) => {
    if (net === null || net === 0) return "transparent";
    const a = Math.max(0.09, Math.min(0.42, Math.abs(net) / peak));
    return net > 0 ? `rgba(46,199,106,${a})` : `rgba(229,72,77,${a})`;
  };

  return (
    <div className="space-y-5">
      {months.map((m) => (
        <div key={m.key}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[12px] font-semibold">{m.label}</span>
            <span className="text-[11px] text-muted">{plural(m.days, "session")}</span>
            <span className={`ml-auto text-[13px] font-bold tabular-nums ${sign(m.net)}`}>
              {m.days ? inr(m.net, true) : "—"}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {DOW.map((d) => (
              <div key={d} className="text-[9.5px] uppercase tracking-[0.08em] text-muted/70 pb-0.5 pl-1">
                {d}
              </div>
            ))}
            <div className="text-[9.5px] uppercase tracking-[0.08em] text-muted/50 pb-0.5 pl-1">Week</div>

            {m.weeks.map((week, wi) => {
              const traded = week.filter((c) => c.point);
              const weekNet = traded.reduce((a, c) => a + (c.point?.net ?? 0), 0);
              return (
                <Fragment key={wi}>
                  {week.map((c, i) => {
                    if (!c.day) return <div key={`${wi}-${i}`} className="h-[72px]" />;
                    const net = c.point?.net ?? null;
                    const on = c.day === selected;
                    return (
                      <button
                        key={c.day}
                        type="button"
                        onClick={() => onPick(c.day as string)}
                        title={
                          c.point
                            ? `${c.day} · ${plural(c.point.trades, "trade")} · ${inr(c.point.net, true)}`
                            : `${c.day} · no record`
                        }
                        className={`h-[72px] rounded-lg border text-left px-2 py-1.5 flex flex-col
                                    transition-colors hover:border-white/30 ${
                          on
                            ? "border-white/60"
                            : c.inRange ? "border-white/[0.07]" : "border-transparent opacity-40"
                        }`}
                        style={{ background: tint(net) }}
                      >
                        <div className="text-[9.5px] text-white/45 leading-none tabular-nums">
                          {Number(c.day.slice(-2))}
                        </div>
                        <div className={`text-[13px] font-bold tabular-nums leading-tight mt-auto ${
                          net === null ? "text-muted/30" : sign(net)
                        }`}>
                          {net === null ? "·" : short(net)}
                        </div>
                        <div className="text-[9px] text-muted/70 leading-tight">
                          {c.point ? plural(c.point.trades, "trade") : ""}
                        </div>
                      </button>
                    );
                  })}
                  <div className="h-[72px] rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 flex flex-col">
                    <div className="text-[9px] uppercase tracking-wider text-muted/50 leading-none">
                      wk {wi + 1}
                    </div>
                    <div className={`text-[12.5px] font-bold tabular-nums leading-tight mt-auto ${
                      traded.length ? sign(weekNet) : "text-muted/30"
                    }`}>
                      {traded.length ? short(weekNet) : "·"}
                    </div>
                    <div className="text-[9px] text-muted/70 leading-tight">
                      {traded.length ? plural(traded.length, "day") : ""}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ shadow lab --- */

/**
 * What the same trades would have made under a different exit.
 *
 * Kept on the page rather than in a document because the case for the wide stop is only
 * convincing next to the alternatives, priced on the reader's own trades.
 */
export function ShadowLab({ totals, config }: { totals: JournalTotals; config: JournalView["config"] }) {
  /*
   * The name has to carry the CHECKPOINT, not just the two fixed levels.
   *
   * It used to read "+80/−50", which is what the config's tp and sl say and is not the rule
   * being run: with `armAtPct` set, every trade is also graded with its stop moved once to
   * `lockPct` after it has been up `armAtPct`. Labelling the in-use bar with only half its rule
   * made the whole panel misleading — the alternatives were being compared against something
   * the reader thought was a flat pair, and there was no way to tell from the page that a
   * checkpoint was in force at all.
   */
  const arm = config.armAtPct ?? 0;
  const lock = config.lockPct ?? 0;
  const active = `+${Math.round(100 * config.tpPct)}/−${Math.round(100 * config.slPct)}`
    + (arm > 0 ? ` →${lock >= 0 ? "+" : "−"}${Math.abs(Math.round(100 * lock))}@${Math.round(100 * arm)}` : "");
  const rules = [
    { name: active, netPnl: totals.netPnl, active: true },
    ...totals.shadow.filter((s) => s.trades > 0).map((s) => ({ name: s.name, netPnl: s.netPnl, active: false })),
  ];
  const best = rules.reduce((a, b) => (b.netPnl > a.netPnl ? b : a));
  const gap = best.netPnl - totals.netPnl;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5">
      <EChart option={shadowOption(rules)} height={Math.max(150, 34 * rules.length)} />
      <div className="text-[12px] text-muted space-y-2.5 lg:border-l lg:border-border lg:pl-5">
        <p>
          Every alternative is graded on the same candle path, with the stop winning any minute
          that could have gone either way. Charges come off all of them equally.
        </p>
        {arm > 0 && (
          <p>
            The rule in use is <span className="text-white font-medium">{active}</span> — the two
            fixed levels <span className="text-white">and</span> a checkpoint that moves the stop
            once to {pct(lock, 0)} after the position has been up {pct(arm, 0, false)}. None of
            the alternatives below carries that checkpoint, so the comparison is against the flat
            pairs and the trailing rules, not against a version of itself.
          </p>
        )}
        {best.active ? (
          <p className="text-bull">
            The exit in use is the best of the set over this range.
          </p>
        ) : (
          <p>
            <span className="text-white font-medium">{best.name}</span> would have made{" "}
            <span className={sign(gap)}>{inr(gap, true)}</span> more here. One range is not a
            reason to switch — the rule in use was chosen on the whole archive, not on a month.
          </p>
        )}
        {config.shadow.some((s) => "trail" in s) && (
          <p>
            The trailing rules only apply once a position has been up by their arming level, so
            they cover slightly fewer trades than the fixed pairs.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- the row visuals --- */

/**
 * The path a trade took, on one track.
 *
 * Entry is the centre. Red runs left to the worst it ever showed, green runs right to the best,
 * and the notch is where it actually got out. Two percentages cannot say that a trade was up
 * 65% before it closed at 52% — this can, in the width of a table cell.
 *
 * Scaled to a fixed ±100% so rows are comparable down the column. Anything past that clamps to
 * the end of the track, which is honest enough at that size: the numbers are printed above it.
 */
export function PathBar({ mfe, mae, exit, live = false }: {
  mfe: number | null | undefined;
  mae: number | null | undefined;
  exit: number | null | undefined;
  live?: boolean;
}) {
  const at = (v: number) => 50 + 50 * Math.max(-1, Math.min(1, v));
  const up = typeof mfe === "number" ? Math.max(0, mfe) : 0;
  const down = typeof mae === "number" ? Math.min(0, mae) : 0;
  const marker = typeof exit === "number" ? at(exit) : null;

  return (
    <div className="relative h-[7px] rounded-full bg-white/[0.05] overflow-hidden" aria-hidden>
      <div
        className="absolute inset-y-0 bg-bear/45"
        style={{ left: `${at(down)}%`, width: `${50 - at(down)}%` }}
      />
      <div
        className="absolute inset-y-0 bg-bull/45"
        style={{ left: "50%", width: `${at(up) - 50}%` }}
      />
      <div className="absolute inset-y-0 w-px bg-white/25" style={{ left: "50%" }} />
      {marker !== null && (
        <div
          className={`absolute -top-[2px] -bottom-[2px] w-[2px] rounded-full ${live ? "bg-accent" : "bg-white"}`}
          style={{ left: `calc(${marker}% - 1px)` }}
        />
      )}
    </div>
  );
}

const OUTCOME_TONE: Record<ExitReason, string> = {
  target: "bg-bull/15 text-bull border-bull/25",
  stop: "bg-bear/15 text-bear border-bear/25",
  checkpoint: "bg-teal-400/[0.14] text-teal-300 border-teal-400/25",
  "square-off": "bg-white/[0.06] text-white/80 border-white/15",
  manual: "bg-amber-400/[0.12] text-amber-300 border-amber-400/25",
  untracked: "bg-white/[0.04] text-muted border-white/10",
};

/** How a row ended, as a filled badge. Reads as a column of results, not a column of outlines. */
export function OutcomeBadge({ reason, live }: { reason: ExitReason | null; live?: number | null }) {
  if (reason === null) {
    const tone = live === null || live === undefined
      ? "bg-accent/[0.12] text-accent border-accent/30"
      : live > 0 ? "bg-bull/15 text-bull border-bull/25"
        : live < 0 ? "bg-bear/15 text-bear border-bear/25"
          : "bg-white/[0.06] text-muted border-white/15";
    return (
      <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide
                        px-2 py-1 rounded-md border whitespace-nowrap ${tone}`}>
        <span className="w-[5px] h-[5px] rounded-full bg-current animate-pulse" />
        Open
      </span>
    );
  }
  return (
    <span className={`inline-block text-[10.5px] font-semibold uppercase tracking-wide px-2 py-1
                      rounded-md border whitespace-nowrap ${OUTCOME_TONE[reason]}`}>
      {EXIT_LABEL[reason]}
    </span>
  );
}

/**
 * Whether a row was taken on the stock's quarterly results, from the two readings the API records.
 *
 * Null covers three cases the row cannot tell apart on its face and need not: an ordinary day, a
 * morning the NSE calendar could not be read, and a row written before the readings existed.
 */
export function resultsOf(readings?: Record<string, number | null>): "out" | "today" | null {
  if (readings?.resultsDay !== 1) return null;
  return readings.resultsOut === 1 ? "out" : "today";
}

/**
 * How the stock's overnight news read when the alert fired, as the badge the row shows.
 *
 * Every checked row gets one, so a quiet stock can be told from one that was never looked at.
 */
export type NewsBadge = "positive" | "negative" | "neutral" | "none" | "unread";

export function newsOf(readings?: Record<string, number | null>): NewsBadge | null {
  // A row written before the reading existed has no key at all, and gets no badge: it was never
  // checked, which is a different thing from being checked and found quiet.
  if (!readings || !("newsSentiment" in readings)) return null;
  const v = readings.newsSentiment;
  if (v === null) return "unread";
  if (v === 1) return "positive";
  if (v === -1) return "negative";
  return (readings.newsCount ?? 0) > 0 ? "neutral" : "none";
}

const NEWS_TEXT: Record<NewsBadge, string> = {
  positive: "News +", negative: "News −", neutral: "News neutral", none: "No news", unread: "News unread",
};

const NEWS_TONE: Record<NewsBadge, string> = {
  positive: "border-bull/25 bg-bull/15 text-bull",
  negative: "border-bear/25 bg-bear/15 text-bear",
  neutral: "border-white/10 bg-white/[0.04] text-muted",
  none: "border-white/10 bg-white/[0.04] text-muted",
  unread: "border-white/10 bg-transparent text-muted/70",
};

const NEWS_TITLE: Record<NewsBadge, (symbol: string) => string> = {
  positive: (s) => `The overnight news on ${s} read positive when the alert fired`,
  negative: (s) => `The overnight news on ${s} read negative when the alert fired`,
  neutral: (s) => `${s} had fresh headlines, and none was clearly good or bad for it`,
  none: (s) => `No headline on ${s} between the previous close and the alert`,
  unread: (s) => `${s} had fresh headlines the model had not answered for when the alert fired`,
};

/**
 * Symbol, its logo and its direction — the identity half of a row.
 *
 * The name opens the underlying's chart on TradingView, the same `tvLink` every other table on
 * this platform uses, so "what was the stock doing here" is one click from the journal rather
 * than a retyped ticker. The link is the name and the logo only: the channel line below is not
 * part of it, and the direction arrow stays outside so the underline reads as the ticker's.
 */
export function SymbolBlock({ symbol, direction, channel, readings }: {
  symbol: string; direction: 1 | -1; channel: JournalChannel;
  /** The row's readings. Only the results-day pair is read here — see `resultsOf`. */
  readings?: Record<string, number | null>;
}) {
  const results = resultsOf(readings);
  const news = newsOf(readings);
  return (
    <div className="flex items-center gap-2.5 min-w-[132px]">
      <a
        href={tvLink(symbol)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${symbol} on TradingView`}
        className="shrink-0"
      >
        <SymbolAvatar symbol={symbol} className="w-[26px] h-[26px] text-[9px] shrink-0" />
      </a>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-[13.5px] leading-tight">
          <a
            href={tvLink(symbol)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${symbol} on TradingView`}
            className="truncate hover:text-accent hover:underline transition-colors"
          >
            {symbol}
          </a>
          <span className={`text-[10px] ${direction === 1 ? "text-bull" : "text-bear"}`}>
            {direction === 1 ? "▲" : "▼"}
          </span>
        </div>
        {/* Badges sit on the channel line, not beside the ticker: there they truncated the name. */}
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted">
          <span className="truncate">{CHANNEL_LABEL[channel]}</span>
          {results && (
            <span
              title={results === "out"
                ? "Results day — the board met before this session, so the numbers were already out"
                : "Results today — the board met on this day, so the numbers may not have been out at entry"}
              className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded
                         border border-amber-500/30 bg-amber-500/[0.12] text-amber-400 whitespace-nowrap"
            >
              {results === "out" ? "Results" : "Results today"}
            </span>
          )}
          {news !== null && (
            <span
              title={NEWS_TITLE[news](symbol) + (
                (news === "positive" && direction === -1) || (news === "negative" && direction === 1)
                  ? " — against this trade" : "")}
              className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded border
                          whitespace-nowrap ${NEWS_TONE[news]}`}
            >
              {NEWS_TEXT[news]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------- panels --- */

/** A titled card. Local to the journal so the heading treatment matches the hero's. */
export function Card({ title, sub, right, children }: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-panel p-4">
      {(title || right) && (
        <header className="flex items-center gap-3 mb-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>}
            {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
          </div>
          <div className="ml-auto shrink-0">{right}</div>
        </header>
      )}
      {children}
    </section>
  );
}

/** A one-line notice: something needs doing, or something is not working. */
export function Notice({ tone = "info", children, action }: {
  tone?: "info" | "warn" | "bad";
  children: ReactNode;
  action?: ReactNode;
}) {
  const skin = tone === "bad"
    ? "border-bear/30 bg-bear/[0.07]"
    : tone === "warn" ? "border-amber-500/30 bg-amber-500/[0.07]" : "border-accent/30 bg-accent/[0.06]";
  return (
    <div className={`rounded-2xl border ${skin} px-4 py-3 flex flex-wrap items-center gap-3`}>
      <div className="text-[12.5px] leading-relaxed min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

