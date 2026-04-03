import { LoginForm } from "@/components/admin/LoginForm";

type Props = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/admin";

  return (
    <section className="mx-auto mt-12 max-w-md rounded-3xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Private access</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">Admin sign in</h2>
      <p className="mt-2 text-sm text-slate-600">
        Use your configured admin email and password to manage entries and exits.
      </p>

      <div className="mt-6">
        <LoginForm nextPath={nextPath} />
      </div>
    </section>
  );
}
