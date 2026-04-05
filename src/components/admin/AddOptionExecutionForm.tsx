"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LegChoice = {
  id: string;
  label: string;
  side: "BUY" | "SELL";
};

type Props = {
  groupId: string;
  legs: LegChoice[];
};

type Kind = "ENTRY" | "EXIT" | "ADJUSTMENT";

type FormState = {
  legId: string;
  kind: Kind;
  optionPrice: string;
  quantity: number;
  underlyingLtp: string;
  executedAt: string;
  fees: string;
  notes: string;
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

export function AddOptionExecutionForm({ groupId, legs }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    legId: legs[0]?.id ?? "",
    kind: "ENTRY",
    optionPrice: "",
    quantity: 1,
    underlyingLtp: "",
    executedAt: toDateTimeLocalValue(new Date()),
    fees: "0",
    notes: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const optionPrice = parseNumber(state.optionPrice);
      if (optionPrice === null || optionPrice <= 0) {
        setError("Price must be a valid number greater than 0.");
        return;
      }

      const underlyingLtp = parseNumber(state.underlyingLtp);
      if (underlyingLtp === null || underlyingLtp <= 0) {
        setError("Underlying must be a valid number greater than 0.");
        return;
      }

      const fees = parseNumber(state.fees);
      if (fees === null || fees < 0) {
        setError("Fees must be a valid number greater than or equal to 0.");
        return;
      }

      const response = await fetch(`/api/admin/positional/${groupId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legId: state.legId,
          kind: state.kind,
          optionPrice,
          quantity: state.quantity,
          underlyingLtp,
          executedAt: toIsoDateTime(state.executedAt),
          fees,
          notes: state.notes || null,
        }),
      });
      const payload = await response.json() as { error?: unknown };
      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Validation error — check all fields.");
        return;
      }
      setState(prev => ({ ...prev, optionPrice: "", underlyingLtp: "", quantity: 1, fees: "0", notes: "" }));
      router.refresh();
    } catch {
      setError("Unexpected network issue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (legs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-400">
        Add a leg first to log executions.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Log Execution</p>

      {/* Leg chips */}
      <div className="flex flex-wrap gap-2">
        {legs.map(leg => {
          const active = state.legId === leg.id;
          const isBuy = leg.side === "BUY";
          return (
            <button key={leg.id} type="button"
              onClick={() => setState(p => ({ ...p, legId: leg.id }))}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? isBuy ? "border-blue-600 bg-blue-600 text-white" : "border-rose-600 bg-rose-600 text-white"
                  : isBuy ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400" : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400"
              }`}
            >
              {leg.label}
            </button>
          );
        })}
      </div>

      {/* Entry / Exit / Adj */}
      <div className="flex">
        {(["ENTRY", "EXIT", "ADJUSTMENT"] as Kind[]).map((k, i) => {
          const label = k === "ADJUSTMENT" ? "Adj" : k.charAt(0) + k.slice(1).toLowerCase();
          const isFirst = i === 0;
          const isLast = i === 2;
          const active = state.kind === k;
          const activeClass =
            k === "ENTRY" ? "border-teal-700 bg-teal-700 text-white z-10" :
            k === "EXIT"  ? "border-rose-600 bg-rose-600 text-white z-10" :
                            "border-amber-500 bg-amber-500 text-white z-10";
          const inactiveClass = "border-slate-300 bg-white text-slate-500 hover:bg-slate-50";
          return (
            <button key={k} type="button"
              onClick={() => setState(p => ({ ...p, kind: k }))}
              className={`flex-1 h-10 border text-sm font-semibold transition-colors
                ${isFirst ? "rounded-l-lg" : ""}
                ${isLast ? "rounded-r-lg border-l-0" : "border-r-0"}
                ${!isFirst && !isLast ? "" : ""}
                ${active ? activeClass : inactiveClass}
              `}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Price · Qty · Underlying */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Price</span>
          <input type="text" inputMode="decimal" required
            value={state.optionPrice}
            onChange={e => setState(p => ({ ...p, optionPrice: e.target.value }))}
            placeholder="0.00"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Qty</span>
            <span className="text-xs text-slate-400">lots</span>
          </div>
          <div className="flex">
            <button type="button"
              onClick={() => setState(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}
              className="h-10 w-10 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >−</button>
            <input type="text" inputMode="numeric"
              value={state.quantity}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setState(p => ({ ...p, quantity: n })); }}
              className="h-10 flex-1 border-y border-slate-300 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500"
            />
            <button type="button"
              onClick={() => setState(p => ({ ...p, quantity: p.quantity + 1 }))}
              className="h-10 w-10 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >+</button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Underlying</span>
          <input type="text" inputMode="decimal" required
            value={state.underlyingLtp}
            onChange={e => setState(p => ({ ...p, underlyingLtp: e.target.value }))}
            placeholder="0.00"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Time · Fees */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Time</span>
          <input type="datetime-local" required
            value={state.executedAt}
            onChange={e => setState(p => ({ ...p, executedAt: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Fees</span>
          <input type="text" inputMode="decimal"
            value={state.fees}
            onChange={e => setState(p => ({ ...p, fees: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <input
        value={state.notes}
        onChange={e => setState(p => ({ ...p, notes: e.target.value }))}
        placeholder="Notes (optional)"
        className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button type="submit" disabled={isSubmitting}
        className="w-full h-10 rounded-lg bg-teal-700 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60 transition-colors"
      >
        {isSubmitting ? "Saving…" : "Add execution"}
      </button>
    </form>
  );
}
