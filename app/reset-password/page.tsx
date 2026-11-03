import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a New Password",
  description: "Set a new password for your Pioneer Clinic staff account.",
};

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a strong password that you have not used for this account before."
      footer="Never share your password. Clinic administrators will never ask for it."
    >
      {user ? (
        <ResetPasswordForm />
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
