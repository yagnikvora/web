"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { istClock } from "@/lib/format";
import { useOutsideClose } from "@/lib/useOutsideClose";

// The alert channels' switches, in the nav bar.
//
// WHY IT LIVES HERE AND NOT ON A PAGE. The two channels it controls belong to two different
// modules — the trend-day confirmation is the Trend Day board's alert and the ignition is the
// Momentum Scanner's — and the decision to mute one is almost never made while looking at either.
// It is made when the phone has just buzzed for the fourth time in a minute. So it is reachable
// from wherever the reader happens to be, which on this app means the nav.
//
// WHAT IT IS EDITING. `TREND_DAY_ALERTS`, `TREND_DAY_ALERT_MIN_CONVICTION`, `IGNITION_ALERTS` and
// `IGNITION_ALERT_MIN_EQ` — four settings that until now lived in a file on the server, which
// meant a hosting-panel edit and a restart to change a number worth changing mid-morning. Only
// the fields actually MOVED here are sent, so a panel that touches one switch leaves the other
// three following the server's own .env rather than quietly freezing them at today's values.
//
// WHEN IT TAKES EFFECT. On the next scan — fifteen seconds — so the save is not the end of the
// story and the footer says so. Nothing already announced today is replayed by switching a
// channel back on; the day's announced record is kept separately and is untouched by any of this.

interface AlertSettings {
  trendDay: { enabled: boolean; minConviction: number };
  ignition: { enabled: boolean; minEntryQuality: number };
}

interface AlertSettingsState {
  effective: AlertSettings;
  overrides: {
    trendDay?: Partial<AlertSettings["trendDay"]>;
    ignition?: Partial<AlertSettings["ignition"]>;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

const LIVE = "/api/momentum/alerts";

/** How many fields the stored record is overriding. Zero means "the server's .env, untouched". */
const overrideCount = (s: AlertSettingsState) =>
  Object.keys(s.overrides.trendDay ?? {}).length + Object.keys(s.overrides.ignition ?? {}).length;

/**
 * Only what actually changed.
 *
 * The endpoint merges, so sending all four every time would work — and would silently convert
 * every field into a stored override the first time anybody moved one slider. A deployment that
 * sets its floors in .env would then stop being able to change them there, which is a surprise
 * nobody would connect back to this panel weeks later.
 */
function diff(draft: AlertSettings, saved: AlertSettings) {
  const trendDay = {
    ...(draft.trendDay.enabled !== saved.trendDay.enabled ? { enabled: draft.trendDay.enabled } : {}),
    ...(draft.trendDay.minConviction !== saved.trendDay.minConviction
      ? { minConviction: draft.trendDay.minConviction }
      : {}),
  };
  const ignition = {
    ...(draft.ignition.enabled !== saved.ignition.enabled ? { enabled: draft.ignition.enabled } : {}),
    ...(draft.ignition.minEntryQuality !== saved.ignition.minEntryQuality
      ? { minEntryQuality: draft.ignition.minEntryQuality }
      : {}),
  };
  return {
    ...(Object.keys(trendDay).length ? { trendDay } : {}),
    ...(Object.keys(ignition).length ? { ignition } : {}),
  };
}

export default function AlertSettings() {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AlertSettingsState | null>(null);
  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, box, close);

  const adopt = useCallback((s: AlertSettingsState) => {
    setState(s);
    setDraft(structuredClone(s.effective));
    setErr(null);
  }, []);

  // Read once on mount rather than when the panel opens, so the bell can carry the state: a dot
  // that only lights after you click the thing it is telling you about is not worth drawing.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const r = await fetch(LIVE, { cache: "no-store" });
        const j = await r.json();
        if (!live) return;
        if (!r.ok) setErr(j?.error ?? `HTTP ${r.status}`);
        else adopt(j.data as AlertSettingsState);
      } catch (e) {
        if (live) setErr(String((e as Error).message));
      }
    })();
    return () => {
      live = false;
    };
  }, [adopt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (init: RequestInit) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(LIVE, init);
      const j = await r.json();
      // The issue list is what names the offending field; without it a rejected save reads as
      // "400" and the reader is left guessing which of the four numbers the server disliked.
      if (!r.ok) setErr(j?.issues?.join("; ") ?? j?.error ?? `HTTP ${r.status}`);
      else adopt(j.data as AlertSettingsState);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft || !state) return;
    const patch = diff(draft, state.effective);
    if (!Object.keys(patch).length) return;
    void send({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  };

  const reset = () => void send({ method: "DELETE" });

  const dirty = !!draft && !!state && Object.keys(diff(draft, state.effective)).length > 0;
  const overrides = state ? overrideCount(state) : 0;
  const live = state ? Number(state.effective.trendDay.enabled) + Number(state.effective.ignition.enabled) : 0;

  return (
    // Positioned only from `sm` up. Below that the panel deliberately anchors to the NAV BAR
    // instead of to this button: the bell sits about 100px in from the screen edge (the account
    // chip and the menu button are to its right), so a 324px panel hung off the button's own
    // right edge runs past the left of a 390px screen — and `body { overflow-x: clip }` then
    // silently cuts the first third of it off rather than letting it scroll into view.
    <div className="sm:relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={
          state
            ? `Alert channels — ${live} of 2 live${overrides ? ` · ${overrides} overriding .env` : ""}`
            : "Alert channels"
        }
        aria-label="Alert settings"
        aria-expanded={open}
        className={`relative grid place-items-center w-9 h-9 rounded-lg border transition-colors ${
          open ? "bg-chip border-white/20 text-white" : "border-border text-muted hover:text-white hover:bg-chip"
        }`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Only drawn once the state is known — an indicator that guesses while the fetch is in
            flight would show "muted" for a moment on every page load. */}
        {state && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0c1017] ${
              live === 0 ? "bg-muted" : live === 2 ? "bg-bull" : "bg-amber-400"
            }`}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-3 top-[calc(100%+6px)] sm:right-0 sm:top-[calc(100%+10px)] z-50
                     w-[min(324px,calc(100vw-24px))] panel p-3.5 shadow-panel text-left"
        >
          <header className="flex items-baseline gap-2 mb-3">
            <h2 className="text-[13.5px] font-semibold text-white">Alert channels</h2>
            <span className="ml-auto text-[10.5px] text-muted">Telegram · Discord</span>
          </header>

          {!draft && !err && <p className="text-[12px] text-muted py-2">Loading…</p>}

          {draft && (
            <div className="flex flex-col gap-2.5">
              <Channel
                name="Trend Day"
                gloss="A day's conviction confirming. Cannot fire before 10:30."
                floorLabel="Min conviction"
                enabled={draft.trendDay.enabled}
                value={draft.trendDay.minConviction}
                onToggle={(enabled) => setDraft({ ...draft, trendDay: { ...draft.trendDay, enabled } })}
                onValue={(minConviction) => setDraft({ ...draft, trendDay: { ...draft.trendDay, minConviction } })}
              />
              <Channel
                name="Ignition"
                gloss="A move starting. Earlier than the above, and less certain."
                floorLabel="Min entry quality"
                enabled={draft.ignition.enabled}
                value={draft.ignition.minEntryQuality}
                onToggle={(enabled) => setDraft({ ...draft, ignition: { ...draft.ignition, enabled } })}
                onValue={(minEntryQuality) =>
                  setDraft({ ...draft, ignition: { ...draft.ignition, minEntryQuality } })
                }
              />
            </div>
          )}

          {err && <p className="mt-3 text-[11.5px] text-bear leading-snug">{err}</p>}

          {draft && (
            <>
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || busy}
                  className="px-3.5 py-2 rounded-xl bg-accent text-white text-[12.5px] font-semibold
                             hover:brightness-110 disabled:opacity-40 transition"
                >
                  {busy ? "Saving…" : dirty ? "Save" : "Saved"}
                </button>
                {dirty && (
                  <button
                    type="button"
                    onClick={() => state && setDraft(structuredClone(state.effective))}
                    className="text-[11.5px] text-muted hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                )}
                {!dirty && overrides > 0 && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy}
                    className="ml-auto text-[11.5px] text-accent hover:underline disabled:opacity-40"
                    title="Hand all four settings back to the server's .env"
                  >
                    Reset to server
                  </button>
                )}
              </div>

              {/* The two facts worth carrying: a save is not instant, and whether what is on
                  screen is this panel's doing or the server's own file. */}
              <p className="mt-2.5 text-[10.5px] text-muted/80 leading-relaxed">
                {dirty ? "Takes effect on the next scan, about 15s after saving. " : ""}
                {overrides === 0
                  ? "Following the server's .env."
                  : `Overriding ${overrides} of 4 .env settings${
                      state?.updatedAt ? ` · saved ${istClock(Date.parse(state.updatedAt))}` : ""
                    }.`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- one channel --- */

function Channel({
  name, gloss, floorLabel, enabled, value, onToggle, onValue,
}: {
  name: string;
  gloss: string;
  floorLabel: string;
  enabled: boolean;
  value: number;
  onToggle: (v: boolean) => void;
  onValue: (n: number) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-black/20 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-white">{name}</div>
          <p className="text-[10.5px] text-muted leading-snug mt-0.5">{gloss}</p>
        </div>
        <Switch on={enabled} label={`${name} alerts`} onChange={onToggle} />
      </div>

      {/* Still editable while the channel is off: setting the floor you want BEFORE switching it
          on is the order anybody who has just muted something works in. Dimmed, not disabled. */}
      <div className={`mt-2.5 flex items-center gap-2.5 ${enabled ? "" : "opacity-45"}`}>
        <span className="text-[10px] uppercase tracking-[0.09em] text-muted shrink-0">{floorLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={`${name} ${floorLabel}`}
          onChange={(e) => onValue(Number(e.target.value))}
          className="flex-1 min-w-0 h-1 accent-accent cursor-pointer"
        />
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={`${name} ${floorLabel}, exact`}
          onChange={(e) => {
            const n = Number(e.target.value);
            // Clamped here as well as on the server, so the slider and the box cannot disagree
            // about what 0-100 means while the value is being typed.
            if (Number.isFinite(n)) onValue(Math.max(0, Math.min(100, Math.round(n))));
          }}
          className="w-[46px] shrink-0 rounded-lg border border-border bg-black/30 px-1.5 py-1
                     text-[12.5px] text-white tabular-nums text-center outline-none focus:border-accent/60"
        />
      </div>
    </section>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative ml-auto shrink-0 h-[22px] w-[38px] rounded-full border transition-colors ${
        on ? "bg-bull/85 border-bull/60" : "bg-chip border-border"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all ${
          on ? "left-[19px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}
