import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Role, StaffUser } from "./types";
import { ROLE_HOME } from "./types";
import { nowIso } from "./utils";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  active: boolean;
  created_at: string;
};

function mapStaff(row: StaffRow): StaffUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    title: row.title,
    active: row.active ? 1 : 0,
    created_at: row.created_at,
  };
}

/** Load the clinic authorisation profile for a Supabase Auth user id. */
export async function getStaffProfile(userId: string): Promise<StaffUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, email, role, title, active, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapStaff(data as StaffRow);
}

/**
 * Resolve the signed-in staff member from the Supabase session. Roles are
 * always read from public.staff; a role supplied by the browser is never used.
 */
export const getCurrentUser = cache(async (): Promise<StaffUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const staff = await getStaffProfile(user.id);
  if (!staff || !staff.active) return null;
  return staff;
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

export async function touchStaffLogin(staffId: string) {
  const supabase = await createClient();
  await supabase.from("staff").update({ updated_at: nowIso() }).eq("id", staffId);
}
