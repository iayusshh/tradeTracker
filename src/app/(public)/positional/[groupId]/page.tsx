import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PayoffChart } from "@/components/charts/PayoffChart";
import { formatInr, pnlColor } from "@/lib/format";
import { buildPayoffSeries } from "@/lib/math/payoff";
import { computeOptionLegSnapshot } from "@/lib/math/pnl";
import { getPositionalGroupById } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function PositionalDetailPage({ params }: Props) {
  const { groupId } = await params;
  const group = await getPositionalGroupById(groupId);

  if (!group) {
    notFound();
  }

  const allExecutions = group.legs.flatMap((leg: (typeof group.legs)[number]) => leg.executions);
  const latestExecution = [...allExecutions].sort(
    (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
  )[0];
  const currentPrice = latestExecution?.underlyingLtp ?? group.legs[0]?.strike ?? 0;
  const chart = buildPayoffSeries({
    legs: group.legs,
    currentPrice,
    targetDate: group.targetDate,
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">
      <Link href="/positional" className="text-sm font-medium text-teal-700 hover:text-teal-600">
        Back to positional list
      </Link>

      <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{group.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {group.underlyingSymbol} • started {format(group.startedAt, "dd MMM yyyy")} • {group.status}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total PnL</p>
            <p className={`text-2xl font-bold ${pnlColor(group.totalPnl)}`}>{formatInr(group.totalPnl)}</p>
            <p className="text-xs text-slate-500">
              Realized {formatInr(group.realizedPnl)} / Unrealized {formatInr(group.unrealizedPnl)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <PayoffChart data={chart.points} currentPrice={chart.currentPrice} breakevens={chart.breakevens} />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Leg snapshots</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Side</th>
                <th className="px-2 py-2">Strike</th>
                <th className="px-2 py-2">Expiry</th>
                <th className="px-2 py-2">Open Qty</th>
                <th className="px-2 py-2">Avg Entry</th>
                <th className="px-2 py-2">PnL</th>
              </tr>
            </thead>
            <tbody>
              {group.legs.map((leg: (typeof group.legs)[number]) => {
                const snapshot = computeOptionLegSnapshot(leg);

                return (
                  <tr key={leg.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{leg.optionType}</td>
                    <td className="px-2 py-2">{leg.side}</td>
                    <td className="px-2 py-2">{leg.strike}</td>
                    <td className="px-2 py-2">{format(leg.expiry, "dd MMM yyyy")}</td>
                    <td className="px-2 py-2">{snapshot.openQuantity}</td>
                    <td className="px-2 py-2">{snapshot.averageEntryPrice.toFixed(2)}</td>
                    <td className={`px-2 py-2 font-semibold ${pnlColor(snapshot.totalPnl)}`}>
                      {formatInr(snapshot.totalPnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
