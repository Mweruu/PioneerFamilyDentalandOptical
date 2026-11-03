"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { getCurrentUser, getStaffProfile, touchStaffLogin } from "../auth";
import { logAudit } from "../audit";
import type { Role } from "../types";
import { ROLE_HOME } from "../types";

export type AuthState = { error?: string; success?: string } | null;

const loginSchema = z.object({
  role: z.enum(["dentist", "receptionist", "eye_doctor", "admin"]),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

async function appBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("host") || "localhost:3000";
  return process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    role: formData.get("role"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the login details." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await logAudit({
      publicEvent: true,
      action: "auth.login_failed",
      details: `Failed login attempt for ${email}.`,
    });
    return { error: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("staff")
    .select("id, name, email, role, title, active, created_at")
    .eq("id", data.user.id)
    .maybeSingle();

  const staff = profile as
    | {
        id: string;
        name: string;
        email: string;
        role: Role;
        title: string | null;
        active: boolean;
        created_at: string;
      }
    | null;

  if (!staff) {
    await supabase.auth.signOut();
    await logAudit({
      publicEvent: true,
      action: "auth.login_unprovisioned",
      details: `Authenticated user ${email} has no clinic staff profile.`,
    });
    return { error: "This account is not linked to a clinic staff profile. Contact the clinic administrator." };
  }

  if (!staff.active) {
    await logAudit({
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      action: "auth.login_deactivated",
      details: "Deactivated account attempted to sign in.",
    });
    await supabase.auth.signOut();
    return { error: "This staff account is deactivated. Contact the clinic administrator." };
  }

  if (staff.role !== parsed.data.role) {
    await logAudit({
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      action: "auth.role_mismatch",
      details: `Account attempted to sign in as ${parsed.data.role} but is assigned ${staff.role}.`,
    });
    await supabase.auth.signOut();
    return {
      error: `The selected role does not match this account. This account is assigned the ${staff.role.replaceAll("_", " ")} role.`,
    };
  }

  await touchStaffLogin(staff.id);
  await logAudit({
    actorId: staff.id,
    actorName: staff.name,
    actorRole: staff.role,
    action: "auth.login",
    details: "Staff signed in.",
  });

  redirect(ROLE_HOME[staff.role]);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "auth.logout",
      details: "Staff signed out.",
    });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const resetRequestSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };

  const email = parsed.data.email.trim().toLowerCase();
  const supabase = await createClient();
  const base = await appBaseUrl();

  // Supabase always responds successfully for unknown addresses, which avoids
  // leaking whether a staff account exists.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/confirm?next=/reset-password`,
  });

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, role, active")
    .eq("email", email)
    .maybeSingle();

  if (staff?.active) {
    await logAudit({
      publicEvent: true,
      action: "auth.password_reset_requested",
      entityType: "staff",
      entityId: staff.id,
      details: `Password reset requested for ${staff.name}.`,
    });
  }

  return {
    success:
      "If that email belongs to an active staff account, a reset link has been sent. Contact the clinic administrator if it does not arrive.",
  };
}

const resetSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const staff = await getStaffProfile(user.id);
  if (!staff || !staff.active) {
    await supabase.auth.signOut();
    return { error: "This staff account is not active. Contact the clinic administrator." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  await logAudit({
    actorId: staff.id,
    actorName: staff.name,
    actorRole: staff.role,
    action: "auth.password_reset_completed",
    details: "Password reset completed.",
  });

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
