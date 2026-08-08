"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Panel, SourceBadge } from "@/components/ui";
import { isMarketOpen, REFRESH_MS } from "@/lib/live";
import { expLabel, expParam, istTime } from "@/lib/oi";
import { SCRIPTS, TIMEFRAMES, scriptLabel, type ApexLoad } from "@/lib/apex";
import ApexDial from "./ApexDial";
import { SymbolAvatar } from "@/components/icons";
import {
  apexChartOption, moverOption, rupees,
  CHART_TYPES, CHART_TYPE_LABEL, type ChartType,
} from "./charts";

const EChart = dynamic(() => import("@/components/EChart"), { ssr: false });

/* ------------------------------------------------------------------ controls --- */

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="chip appearance-none pr-8 max-w-full font-semibold cursor-pointer hover:border-accent/50 transition-colors">
        {options.map(([v, l]) => <option key={v} value={v}>{`${label}: ${l}`}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[10px]">▼</span>
    </label>
  );
}

/* ---------------------------------------------------------------------- page --- */

export default function OptionApexClient({ initial }: { initial: ApexLoad }) {
  const [d, setD] = useState<ApexLoad>(initial);
  const [script, setScript] = useState(initial.script);
  const [tf, setTf] = useState(initial.tf);
  const [exp, setExp] = useState(initial.exp);
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // A selector change and a background poll can be in flight together; only the newest
  // request may land, or a slow one overwrites the view the user just asked for.
  const req = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async (showSpinner: boolean) => {
      const mine = ++req.current;
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/option-apex?script=${encodeURIComponent(script)}&tf=${tf}&exp=${encodeURIComponent(exp)}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive || mine !== req.current) return;
        if (!res.ok || j.error) { setErr(String(j.error || res.status)); return; }
        setErr(null);
        setD(j as ApexLoad);
      } catch (e) {
        if (alive && mine === req.current) setErr(String((e as Error).message));
      } finally {
        if (alive && mine === req.current) setLoading(false);
      }
    };

    // Skip the fetch when the view still matches what the server rendered.
    const same = script === initial.script && tf === initial.tf && exp === initial.exp;
    if (!same) void load(true);

    setOpen(isMarketOpen());
    const id = setInterval(() => {
      const o = isMarketOpen();
      setOpen(o);
      // Outside trading hours nothing upstream changes — the interval keeps ticking so
      // polling resumes on its own at 09:15.
      if (o) void load(false);
    }, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [script, tf, exp, initial.script, initial.tf, initial.exp]);

  // Changing the index invalidates the expiry, which belongs to the old chain.
  const pickScript = (s: string) => { setScript(s); setExp(""); };

  const { chart, flux, dials, mover } = d;
  const chartOpt = useMemo(
    () => apexChartOption(chart.candles, flux.points, chartType),
    [chart.candles, flux.points, chartType],
  );

  // Against the previous session's close — the baseline "the index is up N points" means
  // everywhere, and the one Index Mover totals its contributions against. Falling back to
  // the first candle's open only when there is no previous close to use.
  const base = chart.prevClose ?? chart.candles[0]?.[1] ?? 0;
  const move = chart.last - base;
  const movePct = base ? (move / base) * 100 : 0;

  const expiryOptions: [string, string][] = d.expiries.map(([epoch]) => {
    const { date, away } = expLabel(epoch);
    return [expParam(epoch), `${date} (${away})`];
  });

  return (
    <div>
      {/* ------------------------------------------------------------ header --- */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Options Apex</h1>
        <SourceBadge source={d.source} />
        {loading && <span className="text-xs text-muted animate-pulse">updating…</span>}
        {/* Its own row on a phone: three selects beside a heading leaves each about 70px. */}
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
          <Select label="Index" value={script} onChange={pickScript} options={SCRIPTS} />
          <Select label="Time" value={String(tf)} onChange={(v) => setTf(Number(v))}
            options={TIMEFRAMES.map((t) => [String(t), `${t}m`])} />
          {expiryOptions.length > 0 && (
            <Select label="Exp" value={exp || expiryOptions[0][0]} onChange={setExp} options={expiryOptions} />
          )}
        </div>
      </div>

      {err && (
        <div className="panel p-3 mb-4 text-sm text-amber-400 border-amber-700/40">
          Couldn&apos;t refresh: {err} — showing the last data that loaded.
        </div>
      )}
      {(d.note || !open) && (
        <p className="text-xs text-muted mb-4">
          {d.note ?? `Market closed — showing the ${chart.day} session. Live updates resume at 09:15 IST.`}
        </p>
      )}

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------- main chart --- */}
        <Panel
          title={
            <span className="flex items-baseline gap-2">
              {scriptLabel(script)}
              <span className="text-xl font-extrabold">{chart.last.toFixed(2)}</span>
              <span className={`text-sm font-semibold ${move >= 0 ? "text-bull" : "text-bear"}`}>
                {move >= 0 ? "+" : ""}{move.toFixed(2)} ({movePct >= 0 ? "+" : ""}{movePct.toFixed(2)}%)
              </span>
            </span>
          }
          badge={open ? "live" : undefined}
          right={
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted mr-1 hidden sm:inline">Chart Type:</span>
              {CHART_TYPES.map((t) => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`px-2 py-1.5 sm:py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    chartType === t ? "bg-accent text-white" : "bg-chip text-muted hover:text-white"}`}>
                  {CHART_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          }
        >
          {chart.candles.length ? (
            <EChart option={chartOpt} height="clamp(320px, 52vh, 520px)" />
          ) : (
            <p className="text-muted text-sm py-20 text-center">No candles for this session yet.</p>
          )}
          <p className="text-[11px] text-muted mt-1">
            {chart.day} · {tf}m candles · money flux in the lower pane at{" "}
            {flux.step / 60}m buckets
          </p>
        </Panel>

        {/* ---------------------------------------------------- dials + flux --- */}
        <div className="grid gap-4 content-start">
          <Panel title="Sentiment" badge={open ? "live" : undefined}>
            {dials ? (
              <>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ApexDial
                    label="Sentimental Dial"
                    value={dials.sentiment}
                    readout={dials.buckets ? `${rupees(dials.netFlow)} net` : "PCR only"}
                    hint={
                      dials.buckets === 0
                        ? "No flux readings yet — reading the standing OI alone."
                        : dials.buckets < 3
                          ? `Only ${dials.buckets} flux reading${dials.buckets === 1 ? "" : "s"} recorded — a thin sample pins the needle.`
                          : undefined
                    }
                  />
                  <ApexDial label="PCR" value={dials.pcrScore} readout={`PCR ${dials.pcr.toFixed(2)}`} hint="Upstox · whole chain" />
                </div>
                {dials.pcrSeries.length > 1 ? (
                  <PcrTrend series={dials.pcrSeries} bucket={dials.pcrBucketMinutes} />
                ) : dials.pcrTrendNote ? (
                  <p className="text-[10px] text-muted/70 mt-3 leading-relaxed">
                    No intraday PCR trend: {dials.pcrTrendNote}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                  <div className="rounded-lg bg-chip/60 py-2">
                    <div className="text-[10px] text-muted uppercase tracking-wide">Put OI (bulls)</div>
                    <div className="text-sm font-bold text-bull">{dials.bulls.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="rounded-lg bg-chip/60 py-2">
                    <div className="text-[10px] text-muted uppercase tracking-wide">Call OI (bears)</div>
                    <div className="text-sm font-bold text-bear">{dials.bears.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6">
                <p className="text-sm font-semibold mb-1">Dials unavailable for {chart.day}</p>
                <p className="text-xs text-muted leading-relaxed">
                  They are left off rather than drawn at zero — a needle resting in the
                  middle is a reading, and this is the absence of one.
                </p>
                {d.dialsError && (
                  <p className="text-[11px] text-amber-400/80 mt-2 font-mono leading-relaxed break-words">
                    {d.dialsError}
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Money Flux" badge={open ? "live" : undefined}>
            <FluxSummary flux={flux} lastTs={dials?.ts ?? 0} />
          </Panel>
        </div>
      </div>

      {/* ------------------------------------------------------- index mover --- */}
      <Panel title="Index Mover" className="mt-4" badge={open ? "live" : undefined}>
        {mover ? <Mover mover={mover} /> : (
          <p className="text-muted text-sm py-6">
            NSE publishes a constituent breakdown for Nifty 50 and Bank Nifty only —
            no point contribution is available for {scriptLabel(script)}.
          </p>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------- pieces --- */

/**
 * PCR through the session.
 *
 * Upstox serves the ratio as a series, so the dial's needle has a history behind it — the
 * thing the needle alone can't show is whether the day has been drifting bullish or just
 * sitting there. Drawn against 1.0, the line where puts and calls are evenly matched.
 */
function PcrTrend({ series, bucket }: { series: [number, number][]; bucket: number }) {
  const vals = series.map((p) => p[1]);
  // Always frame 1.0, so the neutral line is on screen even on a day that never crosses it.
  const lo = Math.min(...vals, 1), hi = Math.max(...vals, 1);
  const pad = (hi - lo) * 0.15 || 0.1;
  const min = lo - pad, max = hi + pad;
  const W = 100, H = 30;
  const x = (i: number) => (series.length < 2 ? 0 : (i / (series.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / (max - min)) * H;

  const path = series.map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(2)} ${y(p[1]).toFixed(2)}`).join(" ");
  const last = series[series.length - 1];

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[10px] text-muted mb-1">
        <span className="uppercase tracking-wide">PCR through the day · {bucket}m</span>
        <span>{series[0][1].toFixed(2)} → <span className="text-white font-semibold">{last[1].toFixed(2)}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[42px]">
        <line x1={0} y1={y(1)} x2={W} y2={y(1)} stroke="#3a4759" strokeWidth={0.5} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" stroke={last[1] >= 1 ? "#2ec76a" : "#e5484d"} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[9px] text-muted">
        <span>{istTime(series[0][0])}</span>
        <span className="text-muted/60">1.00 = puts and calls level</span>
        <span>{istTime(last[0])}</span>
      </div>
    </div>
  );
}

function FluxSummary({ flux, lastTs }: { flux: ApexLoad["flux"]; lastTs: number }) {
  const net = flux.peFlow - flux.ceFlow;
  const gross = Math.abs(flux.peFlow) + Math.abs(flux.ceFlow);
  const putShare = gross ? (Math.abs(flux.peFlow) / gross) * 100 : 50;
  const latest = flux.points[flux.points.length - 1];

  if (!flux.points.length)
    return (
      <div className="py-4">
        <p className="text-sm font-semibold mb-1">No option candles for {flux.day}</p>
        <p className="text-xs text-muted leading-relaxed">
          Money flux is the change in open interest between two candles, so it needs a
          session Upstox has candles for. Nothing is shown rather than a flat line.
        </p>
      </div>
    );

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-extrabold ${net >= 0 ? "text-bull" : "text-bear"}`}>
          {net >= 0 ? "+" : ""}{rupees(net)}
        </span>
        <span className="text-xs text-muted">net, session to date</span>
      </div>

      <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-chip">
        <div className="bg-bull h-full" style={{ width: `${putShare}%` }} />
        <div className="bg-bear h-full" style={{ width: `${100 - putShare}%` }} />
      </div>
      <div className="flex justify-between text-[11px] mt-1.5">
        <span className="text-bull font-semibold">Puts {rupees(flux.peFlow)}</span>
        <span className="text-bear font-semibold">Calls {rupees(flux.ceFlow)}</span>
      </div>

      <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3 mt-4 text-xs">
        <dt className="text-muted">Latest bucket</dt>
        <dd className={`text-right font-semibold ${latest[2] >= 0 ? "text-bull" : "text-bear"}`}>
          {rupees(latest[2])} <span className="text-muted font-normal">@ {istTime(latest[0])}</span>
        </dd>
        <dt className="text-muted">Readings</dt>
        <dd className="text-right font-semibold">
          {flux.points.length}
          {flux.missing > 1 && <span className="text-muted font-normal"> · {flux.missing} gap{flux.missing === 1 ? "" : "s"}</span>}
        </dd>
        {lastTs > 0 && (
          <>
            <dt className="text-muted">Last chain read</dt>
            <dd className="text-right font-semibold">{istTime(lastTs)} IST</dd>
          </>
        )}
      </dl>

      <p className="text-[11px] text-muted mt-3 leading-relaxed">
        New open interest since the previous candle, priced at what each option is
        worth. Puts written are the bulls, calls written the bears — green is money
        backing support, red money backing resistance.
      </p>
      {/* One "missing" bucket is just the session's first candle, which has nothing before
          it to be measured against. More than that means Upstox had no candles there. */}
      {flux.missing > 1 && (
        <p className="text-[11px] text-amber-400/80 mt-2 leading-relaxed">
          Upstox served no option candles for {flux.missing} of the session&apos;s{" "}
          {flux.step / 60}-minute buckets — those are left out rather than drawn as zero.
        </p>
      )}
    </div>
  );
}

function Mover({ mover }: { mover: NonNullable<ApexLoad["mover"]> }) {
  const ranked = [...mover.stocks].sort((a, b) => Math.abs(b.point_to_index) - Math.abs(a.point_to_index));
  const top = ranked.slice(0, 10);
  const pts = mover.points;

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <EChart option={moverOption(mover.stocks)} height="clamp(280px, 40vh, 340px)" />
      <div>
        <p className="text-lg font-bold mb-3">
          {mover.index} is{" "}
          {pts == null ? "flat" : (
            <>
              {pts >= 0 ? "up by " : "down by "}
              <span className={pts >= 0 ? "text-bull" : "text-bear"}>{Math.abs(pts).toFixed(2)} pts</span>
            </>
          )}
        </p>
        <ul className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1">
          {top.map((s) => (
            <li key={s.Symbol} className="flex items-center gap-2 text-sm">
              <SymbolAvatar symbol={s.Symbol} className="w-6 h-6 text-[9px]" />
              <span className="font-semibold truncate">{s.Symbol}</span>
              <span className="text-muted text-xs">added</span>
              <span className={`ml-auto font-semibold tabular-nums ${s.point_to_index >= 0 ? "text-bull" : "text-bear"}`}>
                {s.point_to_index >= 0 ? "+" : ""}{s.point_to_index.toFixed(2)} pts
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted mt-2">
          {mover.gainers} up · {mover.losers} down
        </p>
      </div>
    </div>
  );
}

