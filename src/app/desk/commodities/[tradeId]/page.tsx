import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AddCommodityExecutionForm } from "@/components/admin/AddCommodityExecutionForm";
import { ToggleStatusButton } from "@/components/admin/ToggleStatusButton";
import { formatInr, pnlColor } from "@/lib/format";
import { getCommodityTradeById } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tradeId: string }>;
};

export default async function AdminCommodityDetailPage({ params }: Props) {
  const { tradeId } = await params;
  const trade = await getCommodityTradeById(tradeId);

  if (!trade) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{trade.title ?? trade.symbol}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {trade.symbol} • {trade.direction} • started {format(trade.startedAt, "dd MMM yyyy")} •
              {" "}
              {trade.status}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total PnL</p>
              <p className={`text-xl font-bold ${pnlColor(trade.totalPnl)}`}>{formatInr(trade.totalPnl)}</p>
              <p className="text-xs text-slate-500">
                R: {formatInr(trade.realizedPnl)} | U: {formatInr(trade.unrealizedPnl)}
              </p>
            </div>
            <ToggleStatusButton
              id={trade.id}
              currentStatus={trade.status}
              patchUrl={`/api/admin/commodities/${trade.id}`}
            />
          </div>
        </div>
      </section>

      <AddCommodityExecutionForm tradeId={trade.id} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Execution ledger</h3>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Underlying LTP</th>
                <th className="px-2 py-2">Fees</th>
              </tr>
            </thead>
            <tbody>
              {trade.executions.map((execution: (typeof trade.executions)[number]) => (
                <tr key={execution.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{execution.kind}</td>
                  <td className="px-2 py-2">{format(execution.executedAt, "dd MMM yyyy HH:mm")}</td>
                  <td className="px-2 py-2">{execution.price.toFixed(2)}</td>
                  <td className="px-2 py-2">{execution.quantity}</td>
                  <td className="px-2 py-2">{execution.underlyingLtp.toFixed(2)}</td>
                  <td className="px-2 py-2">{execution.fees.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
