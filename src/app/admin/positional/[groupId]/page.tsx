import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AddOptionExecutionForm } from "@/components/admin/AddOptionExecutionForm";
import { AddOptionLegForm } from "@/components/admin/AddOptionLegForm";
import { formatInr, pnlColor } from "@/lib/format";
import { computeOptionLegSnapshot } from "@/lib/math/pnl";
import { getPositionalGroupById } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function AdminPositionalDetailPage({ params }: Props) {
  const { groupId } = await params;
  const group = await getPositionalGroupById(groupId);

  if (!group) {
    notFound();
  }

  const legOptions = group.legs.map((leg: (typeof group.legs)[number]) => ({
    id: leg.id,
    label: `${leg.side} ${leg.optionType} ${leg.strike} (${format(leg.expiry, "dd MMM")})`,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{group.title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {group.underlyingSymbol} • started {format(group.startedAt, "dd MMM yyyy")} • {group.status}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total PnL</p>
            <p className={`text-xl font-bold ${pnlColor(group.totalPnl)}`}>{formatInr(group.totalPnl)}</p>
            <p className="text-xs text-slate-500">
              R: {formatInr(group.realizedPnl)} | U: {formatInr(group.unrealizedPnl)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AddOptionLegForm groupId={group.id} />
        <AddOptionExecutionForm groupId={group.id} legs={legOptions} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Legs and snapshots</h3>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2">Leg</th>
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
                    <td className="px-2 py-2">{leg.side + " " + leg.optionType + " " + leg.strike}</td>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Execution ledger</h3>
        <div className="mt-4 space-y-3">
          {group.legs.map((leg: (typeof group.legs)[number]) => (
            <div key={leg.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">
                {leg.side} {leg.optionType} {leg.strike}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Time</th>
                      <th className="px-2 py-1">Price</th>
                      <th className="px-2 py-1">Qty</th>
                      <th className="px-2 py-1">Underlying LTP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leg.executions.map((execution: (typeof leg.executions)[number]) => (
                      <tr key={execution.id} className="border-b border-slate-100">
                        <td className="px-2 py-1">{execution.kind}</td>
                        <td className="px-2 py-1">{format(execution.executedAt, "dd MMM HH:mm")}</td>
                        <td className="px-2 py-1">{execution.optionPrice.toFixed(2)}</td>
                        <td className="px-2 py-1">{execution.quantity}</td>
                        <td className="px-2 py-1">{execution.underlyingLtp.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
