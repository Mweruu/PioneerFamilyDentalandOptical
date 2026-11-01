import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Role, StaffUser } from "./types";
import { ROLE_HOME } from "./types";
import { nowIso } from "./utils";

const COOKIE_NAME = "pioneer_session";
const SESSION_HOURS = 8;

function secret() {
  const configured = process.env.SESSION_SECRET;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set before running the clinic in production.");
  }
  const value = configured || "pioneer-clinic-development-secret-change-before-production";
  return new TextEncoder().encode(value);
}

export async function createSession(staffId: string, role: Role) {
  const token = await new SignJWT({ sub: staffId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const getCurrentUser = cache(async (): Promise<StaffUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = db
      .prepare(
        "SELECT id, name, email, role, title, active, created_at FROM staff WHERE id = ? AND active = 1",
      )
      .get(payload.sub) as StaffUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=session");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(`${ROLE_HOME[user.role]}?denied=1`);
  }
  return user;
}

export async function requireStaffApi(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");
  if (roles.length && !roles.includes(user.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

export function verifyPassword(password: string, hash: string) {
  return bcryptCompare(password, hash);
}

function bcryptCompare(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function touchStaffLogin(staffId: string) {
  db.prepare("UPDATE staff SET updated_at = ? WHERE id = ?").run(nowIso(), staffId);
}
