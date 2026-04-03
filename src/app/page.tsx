import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 md:px-10">
      <header className="surface-card rounded-3xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Trade Journal
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Public trade tracker with admin-managed entries, exits, and strategy-level PnL.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Track positional option selling strategies and commodities separately. Navigate by
          month and week, review grouped outcomes, and inspect payoff behavior for each open
          or closed strategy.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/positional"
            className="rounded-2xl border border-teal-200 bg-teal-50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-teal-800">Public Section</p>
            <h2 className="mt-2 text-xl font-bold text-teal-900">Positional Options</h2>
            <p className="mt-2 text-sm text-teal-700">
              View grouped multi-leg strategies, chart payoff curves, and week/month totals.
            </p>
          </Link>

          <Link
            href="/commodities"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-amber-800">Public Section</p>
            <h2 className="mt-2 text-xl font-bold text-amber-900">Commodities</h2>
            <p className="mt-2 text-sm text-amber-700">
              Review each commodity trade with clear per-trade and time-bucketed performance.
            </p>
          </Link>

          <Link
            href="/admin"
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-600">Private Section</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Admin Console</h2>
            <p className="mt-2 text-sm text-slate-600">
              Add legs, capture LTP at entry/exit, and keep public performance pages current.
            </p>
          </Link>
        </div>
      </header>
    </main>
  );
}
