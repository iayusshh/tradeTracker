"use client";

import { useEffect, useRef, useState } from "react";
import { formatInr, pnlColor } from "@/lib/format";
import { computeOptionLegSnapshot, type OptionLegLike } from "@/lib/math/pnl";

type SerializedLeg = OptionLegLike & { id: string };

type PnlBreakdown = {
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
};

type Props = {
  groupId: string;
  legs: SerializedLeg[];
  status: "OPEN" | "CLOSED";
  initialPnl: PnlBreakdown;
};

const POLL_INTERVAL_MS = 5000;

export function LivePnlSummary({ groupId, legs, status, initialPnl }: Props) {
  const [pnl, setPnl] = useState<PnlBreakdown>(initialPnl);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasOpenLegs =
    status === "OPEN" &&
    legs.some((leg) => computeOptionLegSnapshot(leg).openQuantity > 0);

  async function fetchAndCompute() {
    try {
      const res = await fetch(`/api/quotes/positional/${groupId}`, { cache: "no-store" });
      if (!res.ok) return;
      const ltpMap: Record<string, number> = await res.json();

      const totals = legs.reduce(
        (acc, leg) => {
          const snapshot = computeOptionLegSnapshot(leg, ltpMap[leg.id]);
          acc.realizedPnl += snapshot.realizedPnl;
          acc.unrealizedPnl += snapshot.unrealizedPnl;
          acc.totalPnl += snapshot.totalPnl;
          return acc;
        },
        { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0 }
      );

      setPnl({
        realizedPnl: Math.round(totals.realizedPnl * 100) / 100,
        unrealizedPnl: Math.round(totals.unrealizedPnl * 100) / 100,
        totalPnl: Math.round(totals.totalPnl * 100) / 100,
      });
    } catch {
      // keep current value on error
    }
  }

  useEffect(() => {
    if (!hasOpenLegs) return;
    fetchAndCompute();
    intervalRef.current = setInterval(fetchAndCompute, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, hasOpenLegs]);

  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Total PnL</p>
      <p className={`text-xl font-bold ${pnlColor(pnl.totalPnl)}`}>{formatInr(pnl.totalPnl)}</p>
      <p className="text-[11px] text-slate-400">
        R: {formatInr(pnl.realizedPnl)} · U: {formatInr(pnl.unrealizedPnl)}
      </p>
    </div>
  );
}
