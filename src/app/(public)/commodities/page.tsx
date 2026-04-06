import Link from "next/link";
import { format } from "date-fns";
import { TradeTimelineNav } from "@/components/navigation/TradeTimelineNav";
import { formatInr, pnlColor, statusBadgeClass } from "@/lib/format";
import { getCommodityOverview } from "@/lib/server/trade-service";
import { monthKeyFromDate, weekKeyFromDate } from "@/lib/server/timeline";
import { StatusDot } from "@/components/StatusDot";
import { TagBadge } from "@/components/TagBadge";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    month?: string;
    week?: string;
  }>;
};

export default async function CommoditiesPage({ searchParams }: Props) {
  const filters = await searchParams;
  const selectedMonth = filters.month;
  const selectedWeek = filters.week;

  const overview = await getCommodityOverview();
  const filtered = overview.items.filter((item) => {
    const monthMatch = selectedMonth ? monthKeyFromDate(item.startedAt) === selectedMonth : true;
    const weekMatch = selectedWeek ? weekKeyFromDate(item.startedAt) === selectedWeek : true;
    return monthMatch && weekMatch;
  });

  // Group by bundle — bundled items first (sorted by bundle name), then ungrouped
  const bundleMap = new Map<string, { name: string; items: typeof filtered }>();
  const ungrouped: typeof filtered = [];

  for (const item of filtered) {
    if (item.bundleId && item.bundleName) {
      const existing = bundleMap.get(item.bundleId);
      if (existing) {
        existing.items.push(item);
      } else {
        bundleMap.set(item.bundleId, { name: item.bundleName, items: [item] });
      }
    } else {
      ungrouped.push(item);
    }
  }

  const bundles = [...bundleMap.entries()].sort(([, a], [, b]) =>
    a.name.localeCompare(b.name)
  );

  function TradeCard({ trade }: { trade: (typeof filtered)[number] }) {
    return (
      <Link
        href={`/commodities/${trade.id}`}
        className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={trade.status} />
              <h2 className="text-lg font-semibold text-slate-900 truncate">{trade.title}</h2>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Started {format(trade.startedAt, "dd MMM yyyy")}</span>
              <span className={statusBadgeClass(trade.status)}>{trade.status}</span>
            </p>
            {trade.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {trade.tags.map((tag) => (
                  <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                ))}
              </div>
            )}
          </div>
          <div className={`text-right text-lg font-bold ${pnlColor(trade.totalPnl)}`}>
            {formatInr(trade.totalPnl)}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">
      <header className="surface-card rounded-3xl px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Public view</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Commodities trades</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trades are listed individually with week and month rollups on the left timeline.
        </p>
      </header>

      <section className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <TradeTimelineNav
          basePath="/commodities"
          months={overview.nav}
          selectedMonth={selectedMonth}
          selectedWeek={selectedWeek}
        />

        <div className="space-y-6">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
              No commodity trades available for this filter yet.
            </div>
          ) : (
            <>
              {bundles.map(([bundleId, bundle]) => {
                const bundlePnl = bundle.items.reduce((sum, i) => sum + i.totalPnl, 0);
                return (
                  <div key={bundleId} className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
                        </svg>
                        <span className="text-sm font-semibold text-slate-700">{bundle.name}</span>
                        <span className="text-xs text-slate-400">{bundle.items.length} trade{bundle.items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <span className={`text-sm font-bold ${pnlColor(bundlePnl)}`}>
                        {formatInr(bundlePnl)}
                      </span>
                    </div>
                    <div className="space-y-3 pl-2">
                      {bundle.items.map((trade) => (
                        <TradeCard key={trade.id} trade={trade} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {ungrouped.length > 0 && (
                <div className="space-y-3">
                  {bundles.length > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                      Ungrouped
                    </p>
                  )}
                  {ungrouped.map((trade) => (
                    <TradeCard key={trade.id} trade={trade} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
