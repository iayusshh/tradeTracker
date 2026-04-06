import Link from "next/link";
import { getTotalNetPnl } from "@/lib/server/trade-service";
import { formatInr, pnlColor } from "@/lib/format";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const netPnl = await getTotalNetPnl();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 md:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
              Trade Journal
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/positional"
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
            >
              Positional Options
            </Link>
            <Link
              href="/commodities"
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-amber-50 hover:text-amber-800"
            >
              Commodities
            </Link>
          </nav>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Net P&amp;L
            </p>
            <p className={`text-sm font-bold ${pnlColor(netPnl)}`}>
              {formatInr(netPnl)}
            </p>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
