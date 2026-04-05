"use client";

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { formatInr } from "@/lib/format";
import type { PayoffPoint } from "@/lib/math/payoff";

type Props = {
  data: PayoffPoint[];
  currentPrice: number;
  breakevens: number[];
};

function formatPnl(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
  return `${sign}${abs}`;
}

function computeXTicks(data: PayoffPoint[]): number[] {
  if (data.length < 2) return data.map(d => d.price);
  const min = data[0].price;
  const max = data[data.length - 1].price;
  const range = max - min;
  const raw = range / 7;
  const interval =
    raw < 50 ? 50 :
    raw < 100 ? 100 :
    raw < 250 ? 250 :
    raw < 500 ? 500 : 1000;
  const first = Math.ceil(min / interval) * interval;
  const ticks: number[] = [];
  for (let t = first; t <= max; t += interval) ticks.push(t);
  return ticks;
}

export function PayoffChart({ data, currentPrice, breakevens }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      setIsReady(width > 0 && height > 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-400">
        Add legs with entry prices to generate the payoff chart.
      </div>
    );
  }

  const allPnl = data.flatMap(d => [d.expiryPnl, d.targetPnl]);
  const minPnl = Math.min(...allPnl, 0);
  const maxPnl = Math.max(...allPnl, 0);
  const span = Math.max(Math.abs(maxPnl), Math.abs(minPnl));
  const pad = span === 0 ? 1 : span * 0.12;
  const yMin = minPnl - pad;
  const yMax = maxPnl + pad;
  const xTicks = computeXTicks(data);

  return (
    <div ref={containerRef} className="h-[320px] w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      {isReady ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dfe6ec" />
            <XAxis
              dataKey="price"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={xTicks}
              tick={{ fill: "#334155", fontSize: 12 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: "#334155", fontSize: 12 }}
              width={90}
              tickFormatter={formatPnl}
            />
            <Tooltip
              formatter={(value) => formatInr(Number(value ?? 0))}
              labelFormatter={(value) => `Underlying: ${value}`}
            />

            <Legend />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="6 4" />
            <ReferenceLine x={currentPrice} stroke="#0d9488" strokeDasharray="4 4" />

            {breakevens.map(be => (
              <ReferenceLine
                key={be}
                x={be}
                stroke="#b45309"
                strokeOpacity={0.7}
                strokeDasharray="2 6"
                label={{
                  value: `BE ${be}`,
                  fill: "#92400e",
                  fontSize: 10,
                  position: "insideTopLeft",
                }}
              />
            ))}

            <Line
              type="monotone"
              dataKey="expiryPnl"
              name="On Expiry"
              stroke="#ef4444"
              strokeWidth={2.4}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="targetPnl"
              name="On Target Date"
              stroke="#0284c7"
              strokeWidth={2.4}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full rounded-xl bg-slate-50" />
      )}
    </div>
  );
}
