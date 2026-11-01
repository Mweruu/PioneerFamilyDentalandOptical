"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { loginAction, type AuthState } from "@/lib/actions/auth";
import type { Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const roles: { value: Role; description: string }[] = [
  { value: "receptionist", description: "Front desk & triage" },
  { value: "dentist", description: "Dental clinical care" },
  { value: "eye_doctor", description: "Optical clinical care" },
  { value: "admin", description: "Clinic administration" },
];

export function LoginForm({ resetSuccess }: { resetSuccess?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, null);
  const [role, setRole] = useState<Role>("receptionist");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="role" value={role} />

      {resetSuccess && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-5 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Your password has been reset. Sign in with your new password.
        </div>
      )}

      {state?.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs leading-5 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      <div>
        <span className="label">Select your role</span>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setRole(item.value)}
              aria-pressed={role === item.value}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition",
                role === item.value
                  ? "border-navy-900 bg-navy-50 ring-2 ring-navy-900/10"
                  : "border-line bg-white hover:border-navy-200 hover:bg-navy-50/60",
              )}
            >
              <span className="block text-xs font-bold text-navy-900">{ROLE_LABELS[item.value]}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-navy-400">{item.description}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-navy-400">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Your assigned role is verified on the server. Selecting a role does not grant access to it.
        </p>
      </div>

      <div>
        <label htmlFor="email" className="label">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="username"
          placeholder="you@pioneerclinic.co.ke"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-[11px] font-semibold text-teal-700 hover:text-teal-900">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="input pr-11"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <button type="submit" className="btn-primary !min-h-11 w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="h-4 w-4" aria-hidden />}
        {pending ? "Signing in…" : "Sign in to staff workspace"}
      </button>

      <p className="text-center text-[11px] leading-5 text-navy-400">
        Staff access only. All sign-in attempts and record access are logged.
      </p>
    </form>
  );
}
