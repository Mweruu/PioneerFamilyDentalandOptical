"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  touchStaffLogin,
  verifyPassword,
} from "../auth";
import { logAudit } from "../audit";
import { queuePasswordResetNotification } from "../notifications";
import type { Role } from "../types";
import { ROLE_HOME } from "../types";
import { nowIso } from "../utils";

export type AuthState = { error?: string; success?: string } | null;

const loginSchema = z.object({
  role: z.enum(["dentist", "receptionist", "eye_doctor", "admin"]),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    role: formData.get("role"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the login details." };
  }

  const staff = db
    .prepare("SELECT * FROM staff WHERE email = ? COLLATE NOCASE")
    .get(parsed.data.email.trim()) as
    | {
        id: string;
        name: string;
        email: string;
        password_hash: string;
        role: Role;
        active: number;
      }
    | undefined;

  if (!staff || !verifyPassword(parsed.data.password, staff.password_hash)) {
    await logAudit({
      action: "auth.login_failed",
      details: `Failed login attempt for ${parsed.data.email}.`,
    });
    return { error: "Incorrect email or password." };
  }

  if (!staff.active) {
    await logAudit({
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      action: "auth.login_deactivated",
      details: "Deactivated account attempted to sign in.",
    });
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
    return {
      error: `The selected role does not match this account. This account is assigned the ${staff.role.replaceAll("_", " ")} role.`,
    };
  }

  await createSession(staff.id, staff.role);
  touchStaffLogin(staff.id);
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
  await destroySession();
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

  const staff = db
    .prepare("SELECT id, name, email, role, active FROM staff WHERE email = ? COLLATE NOCASE")
    .get(parsed.data.email.trim()) as
    | { id: string; name: string; email: string; role: Role; active: number }
    | undefined;

  if (staff?.active) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO password_reset_tokens (id, staff_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), staff.id, tokenHash, expiresAt, nowIso());

    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "http";
    const host = h.get("host") || "localhost:3000";
    const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
    const resetUrl = `${base}/reset-password?token=${token}`;
    await queuePasswordResetNotification(staff.email, staff.name, resetUrl);
    await logAudit({
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      action: "auth.password_reset_requested",
      details: "Password reset requested.",
    });
  }

  return {
    success:
      "If that email belongs to an active staff account, a reset link has been queued. Contact the clinic administrator if it does not arrive.",
  };
}

const resetSchema = z
  .object({
    token: z.string().min(20, "This reset link is invalid."),
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
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const record = db
    .prepare(`
      SELECT prt.id, prt.staff_id, prt.expires_at, prt.used_at, s.name, s.role, s.active
      FROM password_reset_tokens prt JOIN staff s ON s.id = prt.staff_id
      WHERE prt.token_hash = ?
    `)
    .get(tokenHash) as
    | {
        id: string;
        staff_id: string;
        expires_at: string;
        used_at: string | null;
        name: string;
        role: Role;
        active: number;
      }
    | undefined;

  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now() || !record.active) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const now = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE staff SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      hashPassword(parsed.data.password),
      now,
      record.staff_id,
    );
    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").run(now, record.id);
  })();

  await logAudit({
    actorId: record.staff_id,
    actorName: record.name,
    actorRole: record.role,
    action: "auth.password_reset_completed",
    details: "Password reset completed.",
  });

  redirect("/login?reset=1");
}
