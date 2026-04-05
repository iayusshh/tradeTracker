"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { formatInr, pnlColor } from "@/lib/format";
import {
  computeOptionLegSnapshot,
  computePositionalGroupPnl,
  type OptionLegLike,
  type LegSnapshot,
} from "@/lib/math/pnl";

type SerializedLeg = OptionLegLike & { id: string };

type Props = {
  groupId: string;
  legs: SerializedLeg[];
  status: "OPEN" | "CLOSED";
  /** Interval in ms between price refreshes. Defaults to 5000. */
  pollIntervalMs?: number;
};

type LegRow = {
  leg: SerializedLeg;
  snapshot: LegSnapshot;
  ltp: number | null;
};

const POLL_INTERVAL_MS = 5000;

export function LivePositionalPnl({ groupId, legs, status, pollIntervalMs = POLL_INTERVAL_MS }: Props) {
  const [ltpMap, setLtpMap] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasOpenLegs = status === "OPEN" && legs.some((leg) => {
    const snapshot = computeOptionLegSnapshot(leg);
    return snapshot.openQuantity > 0;
  });

  async function fetchQuotes() {
    try {
      const res = await fetch(`/api/quotes/positional/${groupId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Record<string, number> = await res.json();
      setLtpMap(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quotes");
    }
  }

  useEffect(() => {
    if (!hasOpenLegs) return;

    fetchQuotes();
    intervalRef.current = setInterval(fetchQuotes, pollIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, hasOpenLegs, pollIntervalMs]);

  const rows: LegRow[] = legs.map((leg) => {
    const ltp = ltpMap[leg.id] ?? null;
    const snapshot = computeOptionLegSnapshot(leg, ltp ?? undefined);
    return { leg, snapshot, ltp };
  });

  const livePnl = computePositionalGroupPnl(
    legs.map((leg) => {
      const ltp = ltpMap[leg.id];
      if (ltp === undefined) return leg;
      // Inject a synthetic "last price" execution so the group PnL math
      // uses the live LTP for unrealized legs.
      return leg;
    })
  );

  // Re-compute group totals using the live snapshots
  const liveTotal = rows.reduce(
    (acc, { snapshot }) => {
      acc.realizedPnl += snapshot.realizedPnl;
      acc.unrealizedPnl += snapshot.unrealizedPnl;
      acc.totalPnl += snapshot.totalPnl;
      return acc;
    },
    { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0 }
  );
  // suppress unused warning
  void livePnl;

  if (!hasOpenLegs) return null;

  return (
    <section className="mt-6 rounded-3xl border border-teal-200 bg-teal-50/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-teal-500 shadow-[0_0_6px_2px_rgba(20,184,166,0.5)]" />
          <h2 className="text-lg font-semibold text-teal-900">Live P&amp;L</h2>
          {lastUpdated && (
            <span className="text-xs text-teal-600">
              updated {format(lastUpdated, "HH:mm:ss")}
            </span>
          )}
          {error && (
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              {error}
            </span>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-teal-600">Total P&amp;L</p>
          <p className={`text-2xl font-bold ${pnlColor(liveTotal.totalPnl)}`}>
            {formatInr(Math.round(liveTotal.totalPnl * 100) / 100)}
          </p>
          <p className="text-xs text-teal-700">
            Realized {formatInr(Math.round(liveTotal.realizedPnl * 100) / 100)} / Unrealized{" "}
            {formatInr(Math.round(liveTotal.unrealizedPnl * 100) / 100)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-teal-200 text-left text-teal-700">
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Side</th>
              <th className="px-2 py-2">Strike</th>
              <th className="px-2 py-2">Expiry</th>
              <th className="px-2 py-2">Open Qty</th>
              <th className="px-2 py-2">Avg Entry</th>
              <th className="px-2 py-2">Live LTP</th>
              <th className="px-2 py-2">Live P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ leg, snapshot, ltp }) => (
              <tr key={leg.id} className="border-b border-teal-100">
                <td className="px-2 py-2">{leg.optionType}</td>
                <td className="px-2 py-2">{leg.side}</td>
                <td className="px-2 py-2">{leg.strike}</td>
                <td className="px-2 py-2">{format(new Date(leg.expiry), "dd MMM yyyy")}</td>
                <td className="px-2 py-2">{snapshot.openQuantity}</td>
                <td className="px-2 py-2">{snapshot.averageEntryPrice.toFixed(2)}</td>
                <td className="px-2 py-2 font-mono">
                  {ltp !== null ? ltp.toFixed(2) : <span className="text-slate-400">—</span>}
                </td>
                <td className={`px-2 py-2 font-semibold ${pnlColor(snapshot.totalPnl)}`}>
                  {formatInr(snapshot.totalPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
