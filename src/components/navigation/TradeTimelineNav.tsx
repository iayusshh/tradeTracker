import Link from "next/link";
import { formatInr, pnlColor } from "@/lib/format";
import type { NavMonth } from "@/lib/server/trade-service";

type Props = {
  basePath: string;
  months: NavMonth[];
  selectedMonth?: string;
  selectedWeek?: string;
};

function monthHref(basePath: string, monthKey: string) {
  return `${basePath}?month=${monthKey}`;
}

function weekHref(basePath: string, monthKey: string, weekKey: string) {
  return `${basePath}?month=${monthKey}&week=${weekKey}`;
}

export function TradeTimelineNav({
  basePath,
  months,
  selectedMonth,
  selectedWeek,
}: Props) {
  if (months.length === 0) {
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white/70 p-4">
        <p className="text-sm text-slate-500">No trade history yet.</p>
      </aside>
    );
  }

  const hasFilter = selectedMonth || selectedWeek;

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white/85 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">
          Timeline
        </h3>
        {hasFilter && (
          <Link
            href={basePath}
            className="text-xs font-medium text-teal-700 hover:text-teal-600"
          >
            Show all
          </Link>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {months.map((month) => {
          const monthActive = selectedMonth === month.key;

          return (
            <div key={month.key} className="rounded-xl border border-slate-100 bg-white p-3">
              <Link
                href={monthHref(basePath, month.key)}
                className={`flex items-center justify-between text-sm font-semibold ${
                  monthActive ? "text-teal-700" : "text-slate-800"
                }`}
              >
                <span>{month.label}</span>
                <span className={pnlColor(month.totalPnl)}>{formatInr(month.totalPnl)}</span>
              </Link>

              <p className="mt-1 text-xs text-slate-500">{month.count} groups/trades</p>

              <ul className="mt-3 space-y-2">
                {month.weeks.map((week) => {
                  const weekActive = selectedWeek === week.key;

                  return (
                    <li key={week.key}>
                      <Link
                        href={weekHref(basePath, month.key, week.key)}
                        className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                          weekActive
                            ? "bg-teal-50 text-teal-700"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{week.label}</span>
                        <span className={pnlColor(week.totalPnl)}>{formatInr(week.totalPnl)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
