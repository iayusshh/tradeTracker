import Link from "next/link";
import { format } from "date-fns";
import { formatInr, pnlColor } from "@/lib/format";
import { getCommodityOverview, getPositionalOverview } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [positional, commodities] = await Promise.all([
    getPositionalOverview(),
    getCommodityOverview(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Positional groups</h2>
          <Link href="/admin/positional/new" className="text-sm font-semibold text-teal-700">
            + Create
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {positional.items.length === 0 ? (
            <p className="text-sm text-slate-500">No positional groups yet.</p>
          ) : (
            positional.items.map((group) => (
              <Link
                key={group.id}
                href={`/admin/positional/${group.id}`}
                className="block rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{group.title}</p>
                    <p className="text-xs text-slate-500">{format(group.startedAt, "dd MMM yyyy")}</p>
                  </div>
                  <p className={`font-semibold ${pnlColor(group.totalPnl)}`}>{formatInr(group.totalPnl)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Commodity trades</h2>
          <Link href="/admin/commodities/new" className="text-sm font-semibold text-amber-700">
            + Create
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {commodities.items.length === 0 ? (
            <p className="text-sm text-slate-500">No commodity trades yet.</p>
          ) : (
            commodities.items.map((trade) => (
              <Link
                key={trade.id}
                href={`/admin/commodities/${trade.id}`}
                className="block rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{trade.title}</p>
                    <p className="text-xs text-slate-500">{format(trade.startedAt, "dd MMM yyyy")}</p>
                  </div>
                  <p className={`font-semibold ${pnlColor(trade.totalPnl)}`}>{formatInr(trade.totalPnl)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
