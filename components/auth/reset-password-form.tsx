"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { resetPasswordAction, type AuthState } from "@/lib/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, null);

  if (!token) {
    return (
      <div className="space-y-4">
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs leading-5 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          This reset link is missing its token. Request a new link.
        </div>
        <Link href="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs leading-5 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
        <p className="mt-1.5 text-[11px] leading-4 text-navy-400">
          At least 10 characters with an uppercase letter, lowercase letter and number.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
        {pending ? "Updating password…" : "Set new password"}
      </button>

      <p className="text-center text-xs text-navy-400">
        <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-900">Back to sign in</Link>
      </p>
    </form>
  );
}
