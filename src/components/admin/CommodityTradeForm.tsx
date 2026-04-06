"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
  startedAt: string;
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

export function CommodityTradeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    title: "",
    symbol: "CRUDEOIL",
    exchange: "MCX",
    direction: "LONG",
    instrumentType: "FUTURES",
    lotSize: "1",
    expiry: "",
    strike: "",
    optionType: "",
    startedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const isOptions = state.instrumentType === "OPTIONS";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (isOptions && (!state.expiry || !state.strike || !state.optionType)) {
      setError("For options trades, expiry, strike and option type are required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/commodities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title || null,
          symbol: state.symbol,
          exchange: state.exchange,
          direction: state.direction,
          instrumentType: state.instrumentType,
          lotSize: Number(state.lotSize),
          expiry: isOptions ? state.expiry || null : null,
          strike: isOptions ? Number(state.strike) : null,
          optionType: isOptions ? state.optionType || null : null,
          startedAt: state.startedAt,
          notes: state.notes || null,
        }),
      });

      const payload = await readJsonSafely<{ id?: string; error?: string }>(response);

      if (!response.ok || !payload?.id) {
        setError(toErrorMessage(payload, `Could not create commodity trade (HTTP ${response.status}).`));
        return;
      }

      router.push(`/desk/commodities/${payload.id}`);
      router.refresh();
    } catch {
      setError("Unexpected network issue. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Create commodity trade</h3>

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="title">
          Trade title (optional)
        </label>
        <input
          id="title"
          value={state.title}
          onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Crude oil swing"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="symbol">
            Symbol
          </label>
          <input
            id="symbol"
            required
            value={state.symbol}
            onChange={(event) => setState((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-slate-500">Use tradable symbol, e.g. MCX contract code.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="exchange">
            Exchange
          </label>
          <input
            id="exchange"
            required
            value={state.exchange}
            onChange={(event) => setState((prev) => ({ ...prev, exchange: event.target.value.toUpperCase() }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="direction">
            Direction
          </label>
          <select
            id="direction"
            value={state.direction}
            onChange={(event) =>
              setState((prev) => ({ ...prev, direction: event.target.value as "LONG" | "SHORT" }))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="instrumentType">
            Instrument type
          </label>
          <select
            id="instrumentType"
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
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="FUTURES">Futures</option>
            <option value="OPTIONS">Options</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="lotSize">
            Lot size
          </label>
          <input
            id="lotSize"
            type="number"
            min="1"
            required
            value={state.lotSize}
            onChange={(event) => setState((prev) => ({ ...prev, lotSize: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="startedAt">
            Start date
          </label>
          <input
            id="startedAt"
            type="date"
            required
            value={state.startedAt}
            onChange={(event) => setState((prev) => ({ ...prev, startedAt: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      {isOptions ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="expiry">
              Expiry
            </label>
            <input
              id="expiry"
              type="date"
              required={isOptions}
              value={state.expiry}
              onChange={(event) => setState((prev) => ({ ...prev, expiry: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="strike">
              Strike
            </label>
            <input
              id="strike"
              type="number"
              step="0.01"
              min="0"
              required={isOptions}
              value={state.strike}
              onChange={(event) => setState((prev) => ({ ...prev, strike: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="optionType">
              Option type
            </label>
            <select
              id="optionType"
              required={isOptions}
              value={state.optionType}
              onChange={(event) =>
                setState((prev) => ({ ...prev, optionType: event.target.value as "" | "CALL" | "PUT" }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Select</option>
              <option value="CALL">Call</option>
              <option value="PUT">Put</option>
            </select>
          </div>
        </div>
      ) : null}

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          value={state.notes}
          onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create trade"}
      </button>
    </form>
  );
}
