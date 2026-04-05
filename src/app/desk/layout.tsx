import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 md:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Admin</p>
          <h1 className="text-xl font-bold text-slate-900">Trade Console</h1>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Link href="/" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
            Public home
          </Link>
          <Link href="/desk" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
            Dashboard
          </Link>
          <Link
            href="/desk/positional/new"
            className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
          >
            New positional
          </Link>
          <Link
            href="/desk/commodities/new"
            className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
          >
            New commodity
          </Link>
          <LogoutButton />
        </nav>
      </header>

      {children}
    </main>
  );
}
