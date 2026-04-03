"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
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

export function PayoffChart({ data, currentPrice, breakevens }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Add legs and executions to generate the payoff chart.
      </div>
    );
  }

  return (
    <div className="h-[360px] w-full rounded-2xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe6ec" />
          <XAxis dataKey="price" tick={{ fill: "#334155", fontSize: 12 }} />
          <YAxis tick={{ fill: "#334155", fontSize: 12 }} width={90} />
          <Tooltip
            formatter={(value) => formatInr(Number(value ?? 0))}
            labelFormatter={(value) => `Underlying: ${value}`}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="6 4" />
          <ReferenceLine x={currentPrice} stroke="#0d9488" strokeDasharray="4 4" />

          {breakevens.map((value) => (
            <ReferenceLine
              key={value}
              x={value}
              stroke="#b45309"
              strokeOpacity={0.7}
              strokeDasharray="2 6"
            />
          ))}

          <Line
            type="monotone"
            dataKey="expiryPnl"
            name="On Expiry"
            stroke="#dc2626"
            strokeWidth={2.4}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="targetPnl"
            name="On Target Date"
            stroke="#0369a1"
            strokeWidth={2.4}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
