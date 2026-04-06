"use client";

import { useEffect, useRef, useState } from "react";
import { formatInr, pnlColor } from "@/lib/format";

type Props = {
  groupId: string;
  status: "OPEN" | "CLOSED";
  initialPnl: number;
};

const POLL_INTERVAL_MS = 10000;

export function LiveGroupPnl({ groupId, status, initialPnl }: Props) {
  const [totalPnl, setTotalPnl] = useState(initialPnl);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchPnl() {
    try {
      const res = await fetch(`/api/quotes/positional/${groupId}/total`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: { totalPnl: number } = await res.json();
      setTotalPnl(data.totalPnl);
    } catch {
      // keep current value on error
    }
  }

  useEffect(() => {
    if (status !== "OPEN") return;
    fetchPnl();
    intervalRef.current = setInterval(fetchPnl, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, status]);

  return (
    <p className={`font-semibold ${pnlColor(totalPnl)}`}>{formatInr(totalPnl)}</p>
  );
}
