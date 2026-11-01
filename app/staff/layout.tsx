import { requireUser } from "@/lib/auth";
import { StaffShell } from "@/components/staff/staff-shell";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <StaffShell user={user}>{children}</StaffShell>;
}
