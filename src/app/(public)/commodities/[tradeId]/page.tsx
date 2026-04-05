import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { formatInr, pnlColor, statusBadgeClass } from "@/lib/format";
import { getCommodityTradeById } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tradeId: string }>;
};

export default async function CommodityDetailPage({ params }: Props) {
  const { tradeId } = await params;
  const trade = await getCommodityTradeById(tradeId);

  if (!trade) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">
      <Link href="/commodities" className="text-sm font-medium text-amber-700 hover:text-amber-600">
        Back to commodities list
      </Link>

      <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{trade.title ?? trade.symbol}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{trade.symbol}</span>
              <span>•</span>
              <span>{trade.direction}</span>
              <span>•</span>
              <span>started {format(trade.startedAt, "dd MMM yyyy")}</span>
              <span className={statusBadgeClass(trade.status)}>{trade.status}</span>
            </p>
            {trade.notes && (
              <p className="mt-3 max-w-xl rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                {trade.notes}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total PnL</p>
            <p className={`text-2xl font-bold ${pnlColor(trade.totalPnl)}`}>{formatInr(trade.totalPnl)}</p>
            <p className="text-xs text-slate-500">
              Realized {formatInr(trade.realizedPnl)} / Unrealized {formatInr(trade.unrealizedPnl)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Execution ledger</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Quantity</th>
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
    </main>
  );
}
