import Link from "next/link";
import { format } from "date-fns";
import { TradeTimelineNav } from "@/components/navigation/TradeTimelineNav";
import { formatInr, pnlColor, statusBadgeClass } from "@/lib/format";
import { getPositionalOverview } from "@/lib/server/trade-service";
import { monthKeyFromDate, weekKeyFromDate } from "@/lib/server/timeline";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    month?: string;
    week?: string;
  }>;
};

export default async function PositionalPage({ searchParams }: Props) {
  const filters = await searchParams;
  const selectedMonth = filters.month;
  const selectedWeek = filters.week;

  const overview = await getPositionalOverview();
  const filtered = overview.items.filter((item) => {
    const monthMatch = selectedMonth ? monthKeyFromDate(item.startedAt) === selectedMonth : true;
    const weekMatch = selectedWeek ? weekKeyFromDate(item.startedAt) === selectedWeek : true;

    return monthMatch && weekMatch;
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">
      <header className="surface-card rounded-3xl px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Public view</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Positional option groups</h1>
        <p className="mt-2 text-sm text-slate-600">
          Groups are bucketed by month and week of the first execution date.
        </p>
      </header>

      <section className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <TradeTimelineNav
          basePath="/positional"
          months={overview.nav}
          selectedMonth={selectedMonth}
          selectedWeek={selectedWeek}
        />

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
              No positional groups available for this filter yet.
            </div>
          ) : (
            filtered.map((group) => (
              <Link
                key={group.id}
                href={`/positional/${group.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>Started {format(group.startedAt, "dd MMM yyyy")}</span>
                      <span className={statusBadgeClass(group.status)}>{group.status}</span>
                    </p>
                  </div>
                  <div className={`text-right text-lg font-bold ${pnlColor(group.totalPnl)}`}>
                    {formatInr(group.totalPnl)}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
