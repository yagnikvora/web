"use client";

// One symbol, fully explained.
//
// The board says WHICH rows to look at; this page has to answer "and why should I believe it". So
// almost everything here is the model's own working shown back: the trend checklist with the reading
// that decided each line, the score's six components with the points each earned and why, the three
// candidate stops with the reasoning behind the recommendation, all five targets, and the contract
// with its liquidity broken out.
//
// THE MULTI-TIMEFRAME TABLE IS THE PART THAT PAYS FOR ITSELF. A 5-minute pullback inside a 15-minute
// uptrend is the setup; a 5-minute pullback against a 15-minute downtrend is the trap, and the two
// are indistinguishable on a 5-minute chart. Every timeframe's read is on the page at once, side by
// side, precisely so that disagreement is visible rather than being blended into one number.
//
// A FAILED SETUP IS SHOWN, NOT HIDDEN. When the row has no signal the page renders the blockers as
// prominently as it would render an entry, because "this is not a trade and here is which of the
// seven conditions is missing" is the answer most of the time and is the useful one.

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { useLiveData } from "@/lib/live";
import { fmt, istClock } from "@/lib/format";
import { Panel, SourceBadge } from "@/components/ui";
import { pullbackChartOption } from "../chart";
import {
  ageStr, atrStr, bandClass, bandColours, bestOf, ENTRY_KIND_HELP, liquidityClass,
  moneynessClass, n, OUTCOME_LABEL, outcomeClass, PATTERN_LABEL, PHASE_HELP, PHASE_SHORT, phaseClass,
  pctStr, rupees, TIMEFRAME_LABEL, TIMEFRAMES, trendClass, xStr,
  type PullbackDetail, type PullbackSignal, type Timeframe, type TimeframeRead,
} from "@/lib/pullback";

const EChart = dynamicImport(() => import("@/components/EChart"), { ssr: false });

const REFRESH_MS = 20_000;

/* -------------------------------------------------------------------------- pieces --- */

const Dash = ({ title }: { title?: string }) => <span className="text-muted" title={title}>—</span>;

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[5px] border-b border-border/60 last:border-0">
      <span className="text-[12.5px] text-muted" title={hint}>{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-right">{value}</span>
    </div>
  );
}

/** The trend checklist, with the reading that decided each line. */
function Checklist({ signal }: { signal: PullbackSignal }) {
  const t = signal.trend;
  return (
    <div className="flex flex-col gap-[3px]">
      {t.checks.map((c) => (
        <div key={c.key} className="flex items-baseline gap-2 text-[12.5px] leading-[16px]">
          <span className={c.ok ? "text-bull" : c.required ? "text-bear" : "text-muted"}>
            {c.ok ? "✓" : c.required ? "✗" : "○"}
          </span>
          <span className={c.ok ? "text-[#c7d2dc]" : "text-[#7d8895]"}>
            {c.label}
            {!c.required && <span className="text-[10.5px] text-muted"> (optional)</span>}
          </span>
          <span className="ml-auto text-muted tabular-nums text-[11.5px] whitespace-nowrap">{c.value}</span>
        </div>
      ))}
      {t.vetoes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-800/40">
          {/* Vetoes are shown separately from failed checks because they say something different: a
              failed check means "this is not a trend", a veto means "this may well be a trend and it
              is still not tradable". */}
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1">
            Disqualified even if the trend holds
          </div>
          {t.vetoes.map((v, i) => (
            <div key={i} className="text-[12px] text-amber-200/80 leading-[16px]">⚠ {v}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The 100-point score, component by component, with the arithmetic visible. */
function ScorePanel({ signal }: { signal: PullbackSignal }) {
  const s = signal.score;
  const c = bandColours(s.band);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span
          className="inline-block min-w-[58px] text-center rounded-[10px] px-2.5 py-2 text-[24px] leading-[22px] font-black tabular-nums"
          style={{ background: c.bg, color: c.fg }}
        >
          {s.total.toFixed(0)}
        </span>
        <div>
          <div className={`text-[15px] font-bold ${trendClass(signal.direction === 1 ? "Bullish" : "Bearish")}`}>
            {s.band}
          </div>
          <div className="text-[11.5px] text-muted">
            {(s.coverage * 100).toFixed(0)}% of the model was measurable
            {s.coverage < 1 && " — the rest is out of the denominator, not scored as zero"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {s.components.map((k) => (
          <div key={k.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[12.5px] font-semibold ${k.available ? "" : "text-muted"}`}>
                {k.label}
                {!k.available && <span className="text-[10.5px] text-amber-300/70"> · not measurable</span>}
              </span>
              <span className="text-[12.5px] font-bold tabular-nums">
                {k.available ? k.points.toFixed(1) : "—"}
                <span className="text-muted"> / {k.max}</span>
              </span>
            </div>
            <span className="mt-1 block h-[4px] w-full rounded-full bg-[#2a3341] overflow-hidden">
              <span
                className="block h-full"
                style={{
                  width: `${k.available ? (k.points / k.max) * 100 : 0}%`,
                  background: k.points / k.max > 0.66 ? "#2ec76a" : k.points / k.max > 0.33 ? "#e2c15c" : "#8a5c5c",
                }}
              />
            </span>
            <div className="mt-1 flex flex-col">
              {k.reasons.map((r, i) => (
                <span key={i} className="text-[11px] text-muted leading-[14px]">{r}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The plan: three stops, five targets, one recommendation each, and the trailing rule. */
function PlanPanel({ signal }: { signal: PullbackSignal }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Stop</div>
        {signal.stop.candidates.map((c) => {
          const chosen = c.kind === signal.stop.recommended.kind;
          return (
            <div
              key={c.kind}
              className={`flex items-baseline justify-between gap-3 py-1 ${chosen ? "" : "opacity-55"}`}
              title={c.reason}
            >
              <span className="text-[12.5px]">
                {chosen && <span className="text-bull mr-1">●</span>}
                <span className="capitalize">{c.kind}</span>
              </span>
              <span className="text-[12.5px] tabular-nums text-right">
                <span className={chosen ? "text-bear font-bold" : ""}>{fmt(c.price)}</span>
                <span className="text-muted"> · {c.distanceAtr.toFixed(2)} ATR · {c.distancePct.toFixed(2)}%</span>
              </span>
            </div>
          );
        })}
        <div className="text-[11px] text-muted mt-1 leading-[15px]">{signal.stop.recommended.reason}</div>
        {signal.stop.warning && (
          <div className="text-[11.5px] text-amber-300/90 mt-1.5 leading-[15px]">⚠ {signal.stop.warning}</div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Targets</div>
        {signal.target.candidates.map((t) => {
          const chosen = t.kind === signal.target.primary.kind;
          return (
            <div
              key={t.kind}
              className={`flex items-baseline justify-between gap-3 py-1 ${chosen ? "" : "opacity-55"}`}
              title={t.reason}
            >
              <span className="text-[12.5px]">
                {chosen && <span className="text-bull mr-1">●</span>}
                {t.label}
              </span>
              <span className="text-[12.5px] tabular-nums text-right">
                <span className={chosen ? "text-bull font-bold" : ""}>{fmt(t.price)}</span>
                <span className="text-muted"> · {t.r.toFixed(2)}R · {t.distancePct.toFixed(2)}%</span>
              </span>
            </div>
          );
        })}
        <Row
          label="Reward : risk"
          value={<span className={signal.target.rewardRisk >= 2 ? "text-bull" : "text-amber-300"}>{signal.target.rewardRisk.toFixed(2)}</span>}
          hint="To the primary target. With a 2R primary this is 2.00 by construction — it is what gets quoted, not what decides."
        />
        <Row
          label="Room to the objective"
          value={
            <span className={signal.target.roomR >= 2 ? "text-bull" : signal.target.roomR >= 1.5 ? "text-emerald-300" : "text-amber-300"}>
              {signal.target.roomR.toFixed(2)}R
            </span>
          }
          hint="The impulse leg repeating from the pullback's low, in multiples of the risk. This is the independent measurement the scanner gates on: the retracement created this much risk, so is the leg repeating worth it?"
        />
        <Row
          label="Trailing stop"
          value={fmt(signal.target.trailing.current)}
          hint="A trailing stop is a rule, not a resting order — this is what the rule evaluates to right now."
        />
        <div className="text-[11px] text-muted leading-[15px]">{signal.target.trailing.rule}</div>
      </div>
    </div>
  );
}

/** The contract, with the liquidity score broken out and the delta band explained. */
function OptionPanel({ signal }: { signal: PullbackSignal }) {
  const o = signal.option;
  if (!o)
    return (
      <p className="text-[13px] text-muted">
        No option chain for this row this cycle. Only candidates are enriched, so most of the board carries a complete
        price plan on the underlying and no contract — which is a missing lookup, not a missing setup.
      </p>
    );

  const inBand = Math.abs(o.delta) >= o.band.min && Math.abs(o.delta) <= o.band.max;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <span className={`text-[20px] font-extrabold ${o.side === "CE" ? "text-bull" : "text-bear"}`}>{o.label}</span>
        <span className={`text-[11px] font-bold ${moneynessClass(o.moneyness)}`}>{o.moneyness}</span>
        <span className={`text-[12px] font-bold ${liquidityClass(o.liquidity.grade)}`}>
          {o.liquidity.grade} {o.liquidity.score.toFixed(0)}
        </span>
      </div>
      <div className="text-[11.5px] text-muted mb-3 leading-[16px]">{o.reason}</div>

      <Row label="Entry (the ask)" value={`₹${o.entryCost.toFixed(2)}`} hint="What getting in costs. Not the mid, and not the last traded premium." />
      <Row label="Bid / ask" value={`${o.bid.toFixed(2)} / ${o.ask.toFixed(2)}${o.spreadPct == null ? "" : ` · ${o.spreadPct.toFixed(1)}%`}`} />
      <Row label="Cost per lot" value={rupees(o.costPerLot)} />
      <Row
        label="Delta"
        value={
          <span className={inBand ? "text-bull" : "text-amber-300"}>
            {Math.abs(o.delta).toFixed(3)}
            <span className="text-muted"> (band {o.band.min.toFixed(2)}–{o.band.max.toFixed(2)})</span>
          </span>
        }
        hint={ENTRY_KIND_HELP[signal.entryKind]}
      />
      <Row label="Gamma" value={n(o.gamma, 5)} />
      <Row
        label="Theta"
        value={o.thetaPctPerHour == null ? "—" : `${o.thetaPctPerHour.toFixed(2)}% / hour`}
        hint="Decay as a share of the premium per hour. Over a one-to-two-hour hold this is charged whether or not the move arrives."
      />
      <Row label="Vega" value={n(o.vega, 2)} />
      <Row label="Implied volatility" value={n(o.iv, 1, "%")} />
      <Row label="Open interest" value={`${o.oi.toLocaleString("en-IN")}${o.oiChange == null ? "" : ` (${o.oiChange >= 0 ? "+" : ""}${o.oiChange.toLocaleString("en-IN")} d/d)`}`} hint="The change is day-over-day: the chain's prev_oi is the previous session's close, not the previous poll." />
      <Row label="Traded today" value={o.volume.toLocaleString("en-IN")} />
      <Row label="Expiry" value={`${o.expiry} · ${o.expiryDays}d`} />
      <Row label="Break-even" value={fmt(o.breakEven)} />
      <Row
        label="At the target"
        value={
          o.gainPctAtTarget == null ? "—" : (
            <span className={o.gainPctAtTarget >= 40 ? "text-bull" : ""}>
              ₹{o.premiumAtTarget?.toFixed(2)} · {o.gainPctAtTarget >= 0 ? "+" : ""}{o.gainPctAtTarget.toFixed(0)}%
              {o.profitPerLot != null && <span className="text-muted"> · {rupees(o.profitPerLot)}/lot</span>}
            </span>
          )
        }
        hint="Second-order in gamma, and NET of paying the ask and selling the bid. It ignores any change in implied volatility over the hold."
      />

      <div className="mt-2 text-[11px] text-muted leading-[15px]">
        Liquidity: {o.liquidity.reasons.join(" · ")}
      </div>
      {o.warnings.length > 0 && (
        <div className="mt-2">
          {o.warnings.map((w, i) => (
            <div key={i} className="text-[11.5px] text-amber-300/90 leading-[15px]">⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Every timeframe at once, so disagreement between them is visible rather than blended. */
function Frames({ detail, active, onPick }: {
  detail: PullbackDetail; active: Timeframe; onPick: (tf: Timeframe) => void;
}) {
  const row = detail.row;
  const cells: Array<{ label: string; get: (r: TimeframeRead, tf: Timeframe) => React.ReactNode }> = [
    { label: "Trend", get: (_r, tf) => {
      const t = row?.trends[tf];
      if (!t) return <Dash />;
      return <span className={trendClass(t.state)}>{t.state === "None" ? "—" : t.state} {t.strength}</span>;
    } },
    { label: "Pullback", get: (_r, tf) => {
      const p = row?.pullbacks[tf];
      if (!p) return <Dash />;
      return (
        <span className={`inline-block rounded-full border px-1.5 py-[1px] text-[10.5px] font-bold ${phaseClass(p.phase)}`} title={PHASE_HELP[p.phase]}>
          {PHASE_SHORT[p.phase]}
        </span>
      );
    } },
    { label: "9 EMA", get: (r) => (r.ema.ema9 == null ? <Dash /> : fmt(r.ema.ema9)) },
    { label: "20 EMA", get: (r) => (r.ema.ema20 == null ? <Dash /> : fmt(r.ema.ema20)) },
    { label: "50 EMA", get: (r) => (r.ema.ema50 == null ? <Dash title="still warming" /> : fmt(r.ema.ema50)) },
    { label: "200 EMA", get: (r) => (r.ema.ema200 == null ? <Dash title="a 200-period EMA on this timeframe spans several sessions" /> : fmt(r.ema.ema200)) },
    { label: "VWAP", get: (r) => (r.vwap == null ? <Dash /> : fmt(r.vwap)) },
    { label: "vs VWAP", get: (r) => <span className={(r.distance.vwapAtr ?? 0) >= 0 ? "text-bull" : "text-bear"}>{atrStr(r.distance.vwapAtr)}</span> },
    { label: "ATR", get: (r) => (r.atr == null ? <Dash /> : r.atr.toFixed(3)) },
    { label: "ADX", get: (r) => (r.adx.adx == null ? <Dash title="needs about 28 bars" /> : (
      <span className={r.adx.adx >= 25 ? "text-bull" : r.adx.adx < 20 ? "text-bear" : "text-amber-300"}>
        {r.adx.adx.toFixed(1)}{r.adx.rising === true ? " ↑" : r.adx.rising === false ? " ↓" : ""}
      </span>
    )) },
    { label: "+DI / −DI", get: (r) => `${n(r.adx.plusDi, 1)} / ${n(r.adx.minusDi, 1)}` },
    { label: "9 EMA slope", get: (r) => (r.slope.ema9AtrPerBar == null ? <Dash /> : `${r.slope.ema9AtrPerBar.toFixed(3)} ATR/bar`) },
    { label: "Volume", get: (r) => xStr(r.participation) },
    { label: "Structure", get: (r) => (
      r.structure.note && r.structure.steps === 0
        ? <Dash title={r.structure.note} />
        : `${r.structure.steps} step${r.structure.steps === 1 ? "" : "s"}`
    ) },
    { label: "Bars", get: (r) => (r.warming ? <span className="text-amber-300">{r.bars} (warming)</span> : r.bars) },
  ];

  const frames = TIMEFRAMES.filter((tf) => detail.frames[tf]);

  return (
    <div className="overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>
            <th className="text-left text-muted font-semibold px-2 py-1.5">Reading</th>
            {frames.map((tf) => (
              <th key={tf} className="px-2 py-1.5 text-right">
                <button
                  type="button"
                  onClick={() => onPick(tf)}
                  className={`font-bold ${tf === active ? "text-accent underline" : "text-[#c7d2dc] hover:text-white"}`}
                  title={tf === active ? "Charted" : "Chart this timeframe"}
                >
                  {TIMEFRAME_LABEL[tf]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((c) => (
            <tr key={c.label} className="hover:bg-white/[0.03]">
              <td className="px-2 py-[5px] text-muted whitespace-nowrap">{c.label}</td>
              {frames.map((tf) => (
                <td key={tf} className="px-2 py-[5px] text-right tabular-nums whitespace-nowrap">
                  {c.get(detail.frames[tf] as TimeframeRead, tf)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------------- the page --- */

export default function DetailClient({ initial, source }: { initial: PullbackDetail; source?: string }) {
  const [tf, setTf] = useState<Timeframe>(initial.timeframe);
  const { data: detail, updatedAt } = useLiveData<PullbackDetail>(
    initial,
    `/api/pullback/${encodeURIComponent(initial.symbol)}?timeframe=${tf}`,
    REFRESH_MS,
  );

  const row = detail.row;
  const signal = row ? bestOf(row) : null;
  const read = detail.frames[detail.timeframe];

  const option = useMemo(
    () => pullbackChartOption({ bars: detail.bars, read, signal, timeframe: detail.timeframe }),
    [detail.bars, read, signal, detail.timeframe],
  );

  return (
    <main className="px-0 py-1 sm:p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/pullback-scanner" className="text-[13px] text-accent hover:underline">← Scanner</Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{detail.symbol}</h1>
        {detail.name && <span className="text-[14px] text-muted">{detail.name}</span>}
        <SourceBadge source={source} />
        {row && (
          <span className="text-[16px] font-bold tabular-nums">
            {fmt(row.price)}
            <span className={`ml-2 text-[13px] ${row.changePct >= 0 ? "text-bull" : "text-bear"}`}>
              {pctStr(row.changePct)}
            </span>
          </span>
        )}
        <span className="text-[12px] text-muted ml-auto">
          config v{detail.configVersion}
          {updatedAt !== null && ` · updated ${istClock(updatedAt, true)}`}
        </span>
      </div>

      {detail.seriesNote && (
        // Said on the page rather than buried in a tooltip: this is the one instrument class whose
        // prices are not the ones everybody quotes, and a reader comparing against an index chart
        // deserves to know the series is the future.
        <p className="panel p-3 mb-4 text-[12.5px] text-[#c7d2dc] border-accent/30">{detail.seriesNote}</p>
      )}

      {signal && (
        <section className="panel p-4 mb-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Setup</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[18px] font-extrabold ${signal.direction === 1 ? "text-bull" : "text-bear"}`}>
                  {signal.side}
                </span>
                <span className={`inline-block rounded-full border px-2 py-[3px] text-[11.5px] font-bold ${phaseClass(signal.pullback.phase)}`} title={PHASE_HELP[signal.pullback.phase]}>
                  {PHASE_SHORT[signal.pullback.phase]}
                </span>
                <span className={`inline-block rounded-full border px-2 py-[3px] text-[11.5px] font-bold ${bandClass(signal.score.band)}`}>
                  {signal.score.total.toFixed(0)} {signal.score.band}
                </span>
                <span className="text-[12px] text-muted">{TIMEFRAME_LABEL[signal.timeframe]}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Entry</div>
              <div className="text-[16px] font-bold tabular-nums mt-1">
                {fmt(signal.entry)}
                <span className="text-[12px] text-muted ml-2">
                  {row?.signal ? ageStr(signal.ageMin) : "projected"}
                </span>
              </div>
              {row?.signal && (
                <div className={`text-[11.5px] tabular-nums ${signal.movedSincePct >= 0 ? "text-bull" : "text-bear"}`}>
                  {pctStr(signal.movedSincePct)} since it fired
                  {/* In R as well as in percent, because that is the form that says whether the
                      entry still exists. The plan's stop and target are measured from `entry`, so a
                      drift of +0.30R has already spent a third of the risk this row is quoting. */}
                  {typeof signal.entryDriftR === "number" && (
                    <span className="text-muted">
                      {" · "}
                      {signal.entryDriftR >= 0 ? "+" : ""}
                      {signal.entryDriftR.toFixed(2)}R of the risk
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Stop / Target</div>
              <div className="text-[14px] font-bold tabular-nums mt-1">
                <span className="text-bear">{fmt(signal.stop.recommended.price)}</span>
                <span className="text-muted"> → </span>
                <span className="text-bull">{fmt(signal.target.primary.price)}</span>
              </div>
              <div className="text-[11.5px] text-muted tabular-nums">
                {signal.target.rewardRisk.toFixed(2)}R to {signal.target.primary.label}
              </div>
            </div>

            {row?.signal && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Outcome</div>
                <div className={`text-[15px] font-bold mt-1 ${outcomeClass(signal.outcome.state)}`}>
                  {OUTCOME_LABEL[signal.outcome.state]}
                  {signal.outcome.r != null && (
                    <span className="text-[13px]"> · {signal.outcome.r > 0 ? "+" : ""}{signal.outcome.r.toFixed(2)}R</span>
                  )}
                </div>
                {signal.outcome.note && <div className="text-[11px] text-amber-300/80 max-w-[280px]">{signal.outcome.note}</div>}
              </div>
            )}

            {signal.pullback.confirmation && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted">Confirmation</div>
                <div className="text-[13.5px] font-semibold mt-1">
                  {PATTERN_LABEL[signal.pullback.confirmation.pattern]}
                </div>
                <div className="text-[11.5px] text-muted tabular-nums">
                  {istClock(signal.pullback.confirmation.at)} · {xStr(signal.pullback.confirmation.volumeRatio)} volume
                  · body {(signal.pullback.confirmation.bodyRatio * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </div>

          {!row?.signal && signal.blockers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1">
                Why this is not an entry yet
              </div>
              {signal.blockers.map((b, i) => (
                <div key={i} className="text-[12.5px] text-[#c7d2dc] leading-[17px]">✗ {b}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {!signal && (
        <section className="panel p-4 mb-4">
          <p className="text-[13.5px] text-muted">
            No setup on {detail.symbol} right now — not even a near miss. Either no timeframe reads as a trend, or price
            has not moved far enough from its own averages for a retracement to mean anything. The frames below say
            which.
          </p>
        </section>
      )}

      <Panel
        title={`${TIMEFRAME_LABEL[detail.timeframe]} — ${detail.bars.length} bars`}
        right={
          <div className="flex flex-wrap items-center gap-1">
            {TIMEFRAMES.filter((t) => detail.frames[t]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTf(t)}
                className={`rounded-lg px-2.5 py-2 sm:py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                  t === detail.timeframe ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"
                }`}
              >
                {t}m
              </button>
            ))}
          </div>
        }
        className="mb-4"
      >
        <EChart option={option} height="clamp(320px, 52vh, 520px)" />
        <p className="mt-2 text-[11px] text-muted leading-relaxed">
          The shaded band is the pullback zone — the span of the 9 EMA, the 20 EMA and VWAP, widened by the ATR
          tolerance. It is drawn as a band and not as three lines because that is what the entry actually is: price
          returning into that region and turning, not touching one specific average to the paisa. The pale blue line is
          the impulse leg the retracement belongs to. Bars marked <em>poll-built</em> in the tooltip had their high and
          low assembled from the quote poll rather than from an exchange candle, so their extremes run slightly narrow.
        </p>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {signal && (
          <>
            <Panel title="Trend checklist">
              <Checklist signal={signal} />
            </Panel>
            <Panel title="Confidence">
              <ScorePanel signal={signal} />
            </Panel>
            <Panel title="Plan">
              <PlanPanel signal={signal} />
            </Panel>
          </>
        )}

        <Panel title="Pullback" className={signal ? "" : "xl:col-span-1"}>
          {signal ? (
            <>
              <Row label="Phase" value={PHASE_SHORT[signal.pullback.phase]} hint={PHASE_HELP[signal.pullback.phase]} />
              <Row
                label="Retracement"
                value={signal.pullback.retracement == null ? "—" : `${(signal.pullback.retracement * 100).toFixed(1)}%`}
                hint="Of the impulse leg. The trend is intact inside the configured band and reversing outside it."
              />
              <Row label="Depth from the extreme" value={atrStr(signal.pullback.depthAtr)} />
              <Row
                label="Zone"
                value={signal.pullback.zone ? `${fmt(signal.pullback.zone.bottom)} – ${fmt(signal.pullback.zone.top)}` : "—"}
              />
              <Row
                label="Touched"
                value={
                  [
                    signal.pullback.touch.ema9 && "9 EMA",
                    signal.pullback.touch.ema20 && "20 EMA",
                    signal.pullback.touch.vwap && "VWAP",
                  ].filter(Boolean).join(", ") || "nothing yet"
                }
              />
              <Row label="Bars at the zone" value={signal.pullback.barsInZone ?? "—"} />
              {signal.pullback.impulse && (
                <Row
                  label="Impulse leg"
                  value={`${fmt(signal.pullback.impulse.fromPrice)} → ${fmt(signal.pullback.impulse.toPrice)} · ${(
                    Math.abs(signal.pullback.impulse.toPrice - signal.pullback.impulse.fromPrice) / signal.pullback.impulse.atr
                  ).toFixed(2)} ATR`}
                />
              )}
              <Row label="Entry kind" value={signal.entryKind} hint={ENTRY_KIND_HELP[signal.entryKind]} />
              {signal.pullback.note && <div className="text-[11.5px] text-muted mt-2 leading-[15px]">{signal.pullback.note}</div>}
            </>
          ) : (
            <p className="text-[13px] text-muted">Nothing to measure — there is no impulse leg to retrace.</p>
          )}
        </Panel>

        {signal && (
          <Panel title="Option">
            <OptionPanel signal={signal} />
          </Panel>
        )}

        <Panel title="Timeframes" className="xl:col-span-3">
          <Frames detail={detail} active={detail.timeframe} onPick={setTf} />
          <p className="mt-2 text-[11px] text-muted leading-relaxed">
            Held apart rather than blended, because the whole module turns on the timeframes disagreeing: a 5-minute
            pullback inside a 15-minute uptrend is the setup, and a 5-minute pullback against a 15-minute downtrend is
            the trap that looks identical on a 5-minute chart.
          </p>
        </Panel>

        {detail.history.length > 0 && (
          <Panel title="Signals on this symbol today" className="xl:col-span-3">
            <div className="flex flex-wrap gap-2">
              {detail.history.map((h) => (
                <span
                  key={h.id}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${bandClass(h.band)}`}
                  title={h.outcome.note ?? undefined}
                >
                  {istClock(h.firedAt)} · {h.direction === 1 ? "BUY" : "SELL"} {fmt(h.entry)} ·{" "}
                  {TIMEFRAME_LABEL[h.timeframe]} ·{" "}
                  <span className={outcomeClass(h.outcome.state)}>
                    {OUTCOME_LABEL[h.outcome.state]}
                    {h.outcome.r != null && ` ${h.outcome.r > 0 ? "+" : ""}${h.outcome.r.toFixed(2)}R`}
                  </span>
                </span>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {(detail.warnings.length > 0 || (row?.warnings.length ?? 0) > 0) && (
        <div className="panel p-3.5 mt-4 border-amber-800/50">
          <div className="text-[12px] font-bold uppercase tracking-wide text-amber-300 mb-1.5">
            What could not be computed
          </div>
          <ul className="text-[13px] text-muted space-y-1 list-disc pl-5">
            {[...(row?.warnings ?? []), ...detail.warnings].map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </main>
  );
}
