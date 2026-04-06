"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { formatInr, pnlColor } from "@/lib/format";
import { computeCommodityTradePnl, type CommodityExecutionLike } from "@/lib/math/pnl";

type SerializedExecution = CommodityExecutionLike & {
  id: string;
};

type Props = {
  tradeId: string;
  status: "OPEN" | "CLOSED";
  direction: "LONG" | "SHORT";
  lotSize: number;
  executions: SerializedExecution[];
  pollIntervalMs?: number;
};

type QuotePayload = {
  markPrice: number | null;
  underlyingLtp: number | null;
  resolvedSymbol: string | null;
  source: "quotes" | "option-chain" | null;
  openQuantity: number;
  lotSize: number;
};

const POLL_INTERVAL_MS = 5000;

function computeOpenLots(executions: SerializedExecution[]) {
  const entered = executions
    .filter((execution) => execution.kind !== "EXIT")
    .reduce((sum, execution) => sum + execution.quantity, 0);
  const exited = executions
    .filter((execution) => execution.kind === "EXIT")
    .reduce((sum, execution) => sum + execution.quantity, 0);

  return entered - exited;
}

export function LiveCommodityPnl({
  tradeId,
  status,
  direction,
  lotSize,
  executions,
  pollIntervalMs = POLL_INTERVAL_MS,
}: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openLots = useMemo(() => computeOpenLots(executions), [executions]);
  const hasOpenPosition = status === "OPEN" && openLots > 0;

  const snapshot = useMemo(
    () =>
      computeCommodityTradePnl(
        {
          direction,
          lotSize,
          executions,
        },
        hasOpenPosition && quote?.markPrice !== null ? quote?.markPrice ?? undefined : undefined
      ),
    [direction, executions, hasOpenPosition, lotSize, quote?.markPrice]
  );

  async function fetchLiveQuote() {
    try {
      const response = await fetch(`/api/quotes/commodities/${tradeId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload: QuotePayload = await response.json();
      setQuote(payload);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch live quote");
    }
  }

  useEffect(() => {
    if (!hasOpenPosition) {
      return;
    }

    fetchLiveQuote();
    intervalRef.current = setInterval(fetchLiveQuote, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpenPosition, pollIntervalMs, tradeId]);

  const livePrice = quote?.markPrice ?? null;
  const openUnits = openLots * lotSize;

  return (
    <section
      className={`rounded-3xl border p-5 ${
        hasOpenPosition ? "border-teal-200 bg-teal-50/60" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasOpenPosition ? (
            <span className="flex h-2 w-2 rounded-full bg-teal-500 shadow-[0_0_6px_2px_rgba(20,184,166,0.5)]" />
          ) : null}
          <h3 className={`text-lg font-semibold ${hasOpenPosition ? "text-teal-900" : "text-slate-700"}`}>
            {hasOpenPosition ? "Live Commodity P&L" : "Final Commodity P&L"}
          </h3>
          {hasOpenPosition && lastUpdated ? (
            <span className="text-xs text-teal-600">updated {format(lastUpdated, "HH:mm:ss")}</span>
          ) : null}
          {error ? (
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              {error}
            </span>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total P&amp;L</p>
          <p className={`text-2xl font-bold ${pnlColor(snapshot.totalPnl)}`}>
            {formatInr(snapshot.totalPnl)}
          </p>
          <p className="text-xs text-slate-500">
            Realized {formatInr(snapshot.realizedPnl)} / Unrealized {formatInr(snapshot.unrealizedPnl)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Open Lots</p>
          <p className="text-sm font-semibold text-slate-800">{Math.max(0, openLots)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Open Units</p>
          <p className="text-sm font-semibold text-slate-800">{Math.max(0, openUnits)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Live Mark</p>
          <p className="text-sm font-semibold text-slate-800">
            {livePrice !== null ? livePrice.toFixed(2) : "--"}
          </p>
          {quote?.resolvedSymbol ? (
            <p className="truncate text-[11px] text-slate-400">{quote.resolvedSymbol}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
