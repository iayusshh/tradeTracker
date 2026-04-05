"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  groupId: string;
  underlyingSymbol: string;
};

type FormState = {
  optionType: "CALL" | "PUT";
  side: "BUY" | "SELL";
  strike: number;
  expiry: string;
  quantity: number;
  lotSize: number;
  entryPrice: string;
  underlyingLtp: string;
  executedAt: string;
};

function parseNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

function symbolDefaults(symbol: string): { strikeStep: number; lotSize: number } {
  const s = symbol.toUpperCase();
  if (s.includes("SENSEX") || s.includes("BSE")) return { strikeStep: 100, lotSize: 20 };
  if (s.includes("NIFTY")) return { strikeStep: 50, lotSize: 65 };
  return { strikeStep: 50, lotSize: 1 };
}

function apiError(payload: { error?: unknown }): string {
  if (typeof payload.error === "string") return payload.error;
  return "Validation error — check all fields.";
}

export function AddOptionLegForm({ groupId, underlyingSymbol }: Props) {
  const router = useRouter();
  const { strikeStep, lotSize: defaultLotSize } = symbolDefaults(underlyingSymbol);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    optionType: "CALL",
    side: "BUY",
    strike: 22000,
    expiry: "",
    quantity: 1,
    lotSize: defaultLotSize,
    entryPrice: "",
    underlyingLtp: "",
    executedAt: toDateTimeLocalValue(new Date()),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // Step 1: create the leg
      const legRes = await fetch(`/api/admin/positional/${groupId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionType: state.optionType,
          side: state.side,
          strike: state.strike,
          expiry: state.expiry,
          quantity: state.quantity,
          lotSize: state.lotSize,
        }),
      });
      const legPayload = await legRes.json() as { id?: string; error?: unknown };
      if (!legRes.ok) { setError(apiError(legPayload)); return; }

      // Step 2: if entry price provided, log the entry execution immediately
      if (state.entryPrice && legPayload.id) {
        const optionPrice = parseNumber(state.entryPrice);
        if (optionPrice === null || optionPrice <= 0) {
          setError("Entry price must be a valid number greater than 0.");
          return;
        }

        const parsedUnderlying = parseNumber(state.underlyingLtp);
        // If underlying is left blank, fall back to strike so entry logging does not fail.
        const underlyingLtp = parsedUnderlying && parsedUnderlying > 0
          ? parsedUnderlying
          : state.strike;

        const exRes = await fetch(`/api/admin/positional/${groupId}/executions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legId: legPayload.id,
            kind: "ENTRY",
            optionPrice,
            quantity: state.quantity,
            underlyingLtp,
            executedAt: toIsoDateTime(state.executedAt),
            fees: 0,
            notes: null,
          }),
        });
        if (!exRes.ok) {
          const exPayload = await exRes.json() as { error?: unknown };
          setError("Leg added but entry execution failed: " + apiError(exPayload));
          router.refresh();
          return;
        }
      }

      setState(p => ({ ...p, entryPrice: "", underlyingLtp: "", expiry: "" }));
      router.refresh();
    } catch {
      setError("Unexpected network issue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Add Leg</p>

      {/* Row 1: leg definition */}
      <div className="flex flex-wrap items-end gap-4">

        {/* B / S */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Side</span>
          <div className="flex">
            <button type="button" onClick={() => setState(p => ({ ...p, side: "BUY" }))}
              className={`h-10 w-12 rounded-l-lg border text-sm font-bold transition-colors ${
                state.side === "BUY" ? "border-blue-600 bg-blue-600 text-white z-10" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >B</button>
            <button type="button" onClick={() => setState(p => ({ ...p, side: "SELL" }))}
              className={`h-10 w-12 rounded-r-lg border-y border-r text-sm font-bold transition-colors ${
                state.side === "SELL" ? "border-rose-600 bg-rose-600 text-white z-10" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >S</button>
          </div>
        </div>

        {/* CE / PE */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Type</span>
          <div className="flex">
            <button type="button" onClick={() => setState(p => ({ ...p, optionType: "CALL" }))}
              className={`h-10 w-16 rounded-l-lg border text-sm font-bold transition-colors ${
                state.optionType === "CALL" ? "border-teal-700 bg-teal-700 text-white z-10" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >CE</button>
            <button type="button" onClick={() => setState(p => ({ ...p, optionType: "PUT" }))}
              className={`h-10 w-16 rounded-r-lg border-y border-r text-sm font-bold transition-colors ${
                state.optionType === "PUT" ? "border-teal-700 bg-teal-700 text-white z-10" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >PE</button>
          </div>
        </div>

        {/* Strike */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Strike</span>
          <div className="flex">
            <button type="button" onClick={() => setState(p => ({ ...p, strike: p.strike - strikeStep }))}
              className="h-10 w-10 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >−</button>
            <input type="text" inputMode="numeric" value={state.strike}
              onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setState(p => ({ ...p, strike: n })); }}
              className="h-10 w-24 border-y border-slate-300 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500"
            />
            <button type="button" onClick={() => setState(p => ({ ...p, strike: p.strike + strikeStep }))}
              className="h-10 w-10 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >+</button>
          </div>
        </div>

        {/* Expiry */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Expiry</span>
            <span className="text-xs text-slate-400">optional</span>
          </div>
          <input type="date" value={state.expiry}
            onChange={e => setState(p => ({ ...p, expiry: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Lots */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Lots</span>
          <div className="flex">
            <button type="button" onClick={() => setState(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}
              className="h-10 w-10 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >−</button>
            <input type="text" inputMode="numeric" value={state.quantity}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setState(p => ({ ...p, quantity: n })); }}
              className="h-10 w-16 border-y border-slate-300 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500"
            />
            <button type="button" onClick={() => setState(p => ({ ...p, quantity: p.quantity + 1 }))}
              className="h-10 w-10 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >+</button>
          </div>
        </div>

        {/* Multiplier */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Multiplier</span>
            <span className="text-xs text-slate-500">= {state.quantity * state.lotSize} units</span>
          </div>
          <div className="flex">
            <button type="button" onClick={() => setState(p => ({ ...p, lotSize: Math.max(1, p.lotSize - 1) }))}
              className="h-10 w-10 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >−</button>
            <input type="text" inputMode="numeric" value={state.lotSize}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setState(p => ({ ...p, lotSize: n })); }}
              className="h-10 w-16 border-y border-slate-300 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500"
            />
            <button type="button" onClick={() => setState(p => ({ ...p, lotSize: p.lotSize + 1 }))}
              className="h-10 w-10 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >+</button>
          </div>
        </div>
      </div>

      {/* Row 2: entry execution */}
      <div className="flex flex-wrap items-end gap-4 border-t border-slate-100 pt-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Entry price</span>
          <input type="text" inputMode="decimal"
            value={state.entryPrice}
            onChange={e => setState(p => ({ ...p, entryPrice: e.target.value }))}
            placeholder="0.00"
            className="h-10 w-32 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Underlying LTP</span>
          <input type="text" inputMode="decimal"
            value={state.underlyingLtp}
            onChange={e => setState(p => ({ ...p, underlyingLtp: e.target.value }))}
            placeholder="0.00"
            className="h-10 w-32 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">At time</span>
          <input type="datetime-local"
            value={state.executedAt}
            onChange={e => setState(p => ({ ...p, executedAt: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <button type="submit" disabled={isSubmitting}
          className="h-10 self-end rounded-lg bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? "Adding…" : "Add leg"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </form>
  );
}
