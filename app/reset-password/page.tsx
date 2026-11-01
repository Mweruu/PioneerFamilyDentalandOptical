import Link from "next/link";
import { createHash } from "node:crypto";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a New Password",
  description: "Set a new password for your Pioneer Clinic staff account.",
};

function tokenIsValid(token: string) {
  if (!token) return false;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = db
    .prepare(`
      SELECT prt.expires_at, prt.used_at, s.active
      FROM password_reset_tokens prt JOIN staff s ON s.id = prt.staff_id
      WHERE prt.token_hash = ?
    `)
    .get(tokenHash) as { expires_at: string; used_at: string | null; active: number } | undefined;
  return Boolean(record && !record.used_at && record.active && new Date(record.expires_at).getTime() >= Date.now());
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = tokenIsValid(token);

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a strong password that you have not used for this account before."
      footer="Never share your password. Clinic administrators will never ask for it."
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs leading-5 text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This reset link is invalid, has expired, or has already been used. Request a new link to continue.
          </div>
          <Link href="/forgot-password" className="btn-primary w-full">Request a new link</Link>
          <Link href="/login" className="btn-secondary w-full">Back to sign in</Link>
        </div>
      )}
    </AuthShell>
  );
}
