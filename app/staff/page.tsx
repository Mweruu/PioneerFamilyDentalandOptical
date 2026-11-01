import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const user = await requireUser();
  redirect(ROLE_HOME[user.role]);
}
