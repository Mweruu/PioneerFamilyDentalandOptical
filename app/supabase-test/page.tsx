import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Supabase connection check" };

type Check = { label: string; state: "ok" | "failed" | "skipped"; detail: string };

async function runChecks(): Promise<Check[]> {
  const supabase = await createClient();
  const checks: Check[] = [];

  const health = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
    cache: "no-store",
  }).catch(() => null);
  checks.push({
    label: "Auth service",
    state: health?.ok ? "ok" : "failed",
    detail: health?.ok ? "Reachable" : "Could not reach /auth/v1/health",
  });

  const { count, error: servicesError } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true });
  checks.push({
    label: "public.services table (anon read)",
    state: servicesError ? "failed" : "ok",
    detail: servicesError ? servicesError.message : `${count ?? 0} service rows`,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    checks.push({
      label: "public.staff table (authenticated read)",
      state: "skipped",
      detail: "Not signed in. Sign in at /login, then reload this page.",
    });
  } else {
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("name, role, active")
      .eq("id", user.id)
      .maybeSingle();
    checks.push({
      label: "public.staff table (authenticated read)",
      state: staffError || !staff ? "failed" : "ok",
      detail: staffError
        ? staffError.message
        : staff
          ? `${staff.name} · ${staff.role} · ${staff.active ? "active" : "inactive"}`
          : "Authenticated user has no staff profile",
    });
  }

  return checks;
}

export default async function Page() {
  let checks: Check[] = [];
  let fatal: string | null = null;

  try {
    checks = await runChecks();
  } catch (error) {
    fatal = error instanceof Error ? error.message : "Unknown error";
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold text-navy-900">Supabase connection check</h1>
      <p className="mt-1 text-sm text-navy-500">
        Diagnoses the project configured in <code>.env.local</code>.
      </p>

      {fatal && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {fatal}
        </p>
      )}

      <ul className="mt-5 space-y-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex items-start justify-between gap-4 rounded-lg border border-line p-3 text-sm"
          >
            <span>
              <span className="block font-medium text-navy-900">{check.label}</span>
              <span className="block text-xs text-navy-500">{check.detail}</span>
            </span>
            <span
              className={
                check.state === "ok"
                  ? "text-emerald-700"
                  : check.state === "failed"
                    ? "text-rose-700"
                    : "text-navy-400"
              }
            >
              {check.state === "ok" ? "OK" : check.state === "failed" ? "FAILED" : "SIGN IN"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
