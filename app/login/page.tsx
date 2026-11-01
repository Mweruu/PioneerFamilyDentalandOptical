import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Staff Sign In",
  description: "Secure staff sign in for Pioneer Family Dental and Optical Clinic.",
};

const demoAccounts = [
  ["Administrator", "admin@pioneerclinic.co.ke", "Admin@12345"],
  ["Receptionist", "reception@pioneerclinic.co.ke", "Reception@123"],
  ["Dentist", "dentist@pioneerclinic.co.ke", "Dentist@123"],
  ["Eye Doctor", "optometrist@pioneerclinic.co.ke", "Optical@123"],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; denied?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);

  const params = await searchParams;
  const sessionError =
    params.error === "session"
      ? "Your session has expired or is invalid. Please sign in again."
      : params.denied === "1"
        ? "You do not have permission to open that area with your assigned role."
        : null;

  return (
    <AuthShell
      title="Sign in to the clinic workspace"
      description="Use your assigned staff account. Choose the role that matches your account — access is verified on the server."
      footer={
        <details className="mx-auto max-w-md rounded-xl border border-line bg-white p-3 text-left">
          <summary className="cursor-pointer text-[11px] font-semibold text-navy-500">Demo accounts for evaluation</summary>
          <div className="mt-2 space-y-1.5">
            {demoAccounts.map(([label, email, password]) => (
              <p key={email} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] text-navy-500">
                <span className="font-semibold text-navy-700">{label}</span>
                <span className="font-mono text-[10px]">{email} · {password}</span>
              </p>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-navy-400">Demo data only. Remove these accounts before production use.</p>
        </details>
      }
    >
      {sessionError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800">
          {sessionError}
        </div>
      )}
      <LoginForm resetSuccess={params.reset === "1"} />
    </AuthShell>
  );
}
