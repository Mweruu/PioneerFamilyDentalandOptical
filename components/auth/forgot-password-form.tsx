"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { requestPasswordResetAction, type AuthState } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordResetAction, null);

  return (
    <form action={action} className="space-y-5">
      {state?.success && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-5 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.success}
        </div>
      )}
      {state?.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs leading-5 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="label">Work email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="username" placeholder="you@pioneerclinic.co.ke" required />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
        {pending ? "Sending request…" : "Request a reset link"}
      </button>

      <p className="text-center text-xs text-navy-400">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-900">Back to sign in</Link>
      </p>
    </form>
  );
}
