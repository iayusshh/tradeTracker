"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  trade: {
    id: string;
    title: string | null;
    symbol: string;
    exchange: string;
    direction: "LONG" | "SHORT";
    instrumentType: "FUTURES" | "OPTIONS";
    lotSize: number;
    expiry: string | null;
    strike: number | null;
    optionType: "CALL" | "PUT" | null;
    notes: string | null;
  };
};

type FormState = {
  title: string;
  symbol: string;
  exchange: string;
  direction: "LONG" | "SHORT";
  instrumentType: "FUTURES" | "OPTIONS";
  lotSize: string;
  expiry: string;
  strike: string;
  optionType: "" | "CALL" | "PUT";
  notes: string;
};

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function toErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") {
      return value;
    }
  }
  return fallback;
}

export function CommodityTradeSettingsForm({ trade }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [state, setState] = useState<FormState>({
    title: trade.title ?? "",
    symbol: trade.symbol,
    exchange: trade.exchange,
    direction: trade.direction,
    instrumentType: trade.instrumentType,
    lotSize: String(trade.lotSize),
    expiry: trade.expiry ? trade.expiry.slice(0, 10) : "",
    strike: trade.strike !== null ? String(trade.strike) : "",
    optionType: trade.optionType ?? "",
    notes: trade.notes ?? "",
  });

  const isOptions = state.instrumentType === "OPTIONS";

  const dirty = useMemo(
    () =>
      state.title !== (trade.title ?? "") ||
      state.symbol !== trade.symbol ||
      state.exchange !== trade.exchange ||
      state.direction !== trade.direction ||
      state.instrumentType !== trade.instrumentType ||
      Number(state.lotSize) !== trade.lotSize ||
      state.expiry !== (trade.expiry ? trade.expiry.slice(0, 10) : "") ||
      state.strike !== (trade.strike !== null ? String(trade.strike) : "") ||
      state.optionType !== (trade.optionType ?? "") ||
      state.notes !== (trade.notes ?? ""),
    [state, trade]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (isOptions && (!state.expiry || !state.strike || !state.optionType)) {
      setError("For options trades, expiry, strike and option type are required.");
      return;
    }

    const parsedLotSize = Number(state.lotSize);
    if (!Number.isFinite(parsedLotSize) || parsedLotSize <= 0) {
      setError("Lot size must be a number greater than 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/commodities/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title || null,
          symbol: state.symbol,
          exchange: state.exchange,
          direction: state.direction,
          instrumentType: state.instrumentType,
          lotSize: parsedLotSize,
          expiry: isOptions ? state.expiry || null : null,
          strike: isOptions ? Number(state.strike) : null,
          optionType: isOptions ? state.optionType : null,
          notes: state.notes || null,
        }),
      });

      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        setError(toErrorMessage(payload, `Could not update trade settings (HTTP ${response.status}).`));
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Unexpected network issue. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Trade settings</h4>
        {saved ? <span className="text-xs text-teal-700">Saved</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={state.title}
          onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Trade title"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={state.symbol}
          onChange={(event) => setState((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
          placeholder="Symbol"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <input
          value={state.exchange}
          onChange={(event) => setState((prev) => ({ ...prev, exchange: event.target.value.toUpperCase() }))}
          placeholder="Exchange"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <select
          value={state.direction}
          onChange={(event) =>
            setState((prev) => ({ ...prev, direction: event.target.value as "LONG" | "SHORT" }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="LONG">Long</option>
          <option value="SHORT">Short</option>
        </select>

        <select
          value={state.instrumentType}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              instrumentType: event.target.value as "FUTURES" | "OPTIONS",
              expiry: event.target.value === "OPTIONS" ? prev.expiry : "",
              strike: event.target.value === "OPTIONS" ? prev.strike : "",
              optionType: event.target.value === "OPTIONS" ? prev.optionType : "",
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="FUTURES">Futures</option>
          <option value="OPTIONS">Options</option>
        </select>

        <input
          type="number"
          min="1"
          value={state.lotSize}
          onChange={(event) => setState((prev) => ({ ...prev, lotSize: event.target.value }))}
          placeholder="Lot size"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      {isOptions ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="date"
            value={state.expiry}
            onChange={(event) => setState((prev) => ({ ...prev, expiry: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />

          <input
            type="number"
            step="0.01"
            min="0"
            value={state.strike}
            onChange={(event) => setState((prev) => ({ ...prev, strike: event.target.value }))}
            placeholder="Strike"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />

          <select
            value={state.optionType}
            onChange={(event) =>
              setState((prev) => ({ ...prev, optionType: event.target.value as "" | "CALL" | "PUT" }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Select option type</option>
            <option value="CALL">Call</option>
            <option value="PUT">Put</option>
          </select>
        </div>
      ) : null}

      <textarea
        value={state.notes}
        onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
        placeholder="Notes"
        className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || !dirty}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isSubmitting ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
