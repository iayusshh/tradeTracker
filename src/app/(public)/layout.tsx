import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
        </div>
      </header>

      {children}
    </>
  );
}
