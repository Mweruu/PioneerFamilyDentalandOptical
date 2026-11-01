import Link from "next/link";
import { KeyRound, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/staff/confirm-submit";
import { requireRole } from "@/lib/auth";
import { getStaffList } from "@/lib/data/queries";
import { createStaffAction, resetStaffPasswordAction, updateStaffAction } from "@/lib/actions/admin";
import { ROLE_LABELS, type Role } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Staff Accounts" };

const ROLES: Role[] = ["dentist", "receptionist", "eye_doctor", "admin"];

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string; success?: string }>;
}) {
  const user = await requireRole("admin");
  const params = await searchParams;
  const roleFilter = ROLES.includes(params.role as Role) ? (params.role as Role) : undefined;
  const staff = getStaffList();
  const filtered = roleFilter ? staff.filter((member) => member.role === roleFilter) : staff;
  const counts = Object.fromEntries(ROLES.map((role) => [role, staff.filter((member) => member.role === role).length])) as Record<Role, number>;

  return (
    <div>
      <PageHeader
        eyebrow="Access control"
        title="Staff accounts"
        description="Create accounts, assign roles and deactivate access. Role changes take effect on the next request."
        actions={<Link href="/staff/admin/audit" className="btn-secondary"><ShieldCheck className="h-4 w-4" aria-hidden /> Audit log</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/staff/admin/staff" className={roleFilter ? "btn-secondary !min-h-9 !text-xs" : "btn-primary !min-h-9 !text-xs"}>
          All staff ({staff.length})
        </Link>
        {ROLES.map((role) => (
          <Link key={role} href={`/staff/admin/staff?role=${role}`} className={roleFilter === role ? "btn-primary !min-h-9 !text-xs" : "btn-secondary !min-h-9 !text-xs"}>
            {ROLE_LABELS[role]} ({counts[role]})
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-3">
          {filtered.map((member) => (
            <div key={member.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">{member.name}</p>
                    {member.id === user.id && <span className="badge bg-teal-50 text-teal-700 ring-teal-200">You</span>}
                    <span className={member.active ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-slate-100 text-slate-600 ring-slate-200"}>
                      {member.active ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-navy-500"><Mail className="h-3 w-3 text-navy-400" aria-hidden /> {member.email}</p>
                  <p className="mt-1 text-[11px] text-navy-400">{ROLE_LABELS[member.role]}{member.title ? ` · ${member.title}` : ""} · joined {formatDate(member.created_at)}</p>
                </div>
                <span className="badge bg-navy-50 text-navy-700 ring-navy-200">{ROLE_LABELS[member.role]}</span>
              </div>

              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-xs font-bold text-teal-700">Edit account and reset password</summary>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <form action={updateStaffAction} className="space-y-3">
                    <input type="hidden" name="staffId" value={member.id} />
                    <input type="hidden" name="returnTo" value={roleFilter ? `/staff/admin/staff?role=${roleFilter}` : "/staff/admin/staff"} />
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-navy-400">Account details</p>
                    <div>
                      <label htmlFor={`name-${member.id}`} className="label !text-[11px]">Full name</label>
                      <input id={`name-${member.id}`} name="name" className="input !py-2 !text-sm" defaultValue={member.name} required />
                    </div>
                    <div>
                      <label htmlFor={`title-${member.id}`} className="label !text-[11px]">Title</label>
                      <input id={`title-${member.id}`} name="title" className="input !py-2 !text-sm" defaultValue={member.title ?? ""} placeholder="e.g. Dental Surgeon" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`role-${member.id}`} className="label !text-[11px]">Role</label>
                        <select id={`role-${member.id}`} name="role" className="select !py-2 !text-sm" defaultValue={member.role}>
                          {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                        </select>
                      </div>
                      <label className="mt-6 flex items-center gap-2 text-xs text-navy-700">
                        <input type="checkbox" name="active" defaultChecked={member.active === 1} className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                        Account active
                      </label>
                    </div>
                    <SubmitButton className="!min-h-9 !text-xs" pendingText="Saving…">Save account</SubmitButton>
                  </form>

                  <form action={resetStaffPasswordAction} className="space-y-3 rounded-xl bg-mist p-3">
                    <input type="hidden" name="staffId" value={member.id} />
                    <input type="hidden" name="returnTo" value={roleFilter ? `/staff/admin/staff?role=${roleFilter}` : "/staff/admin/staff"} />
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-navy-400"><KeyRound className="h-3 w-3" aria-hidden /> Reset password</p>
                    <div>
                      <label htmlFor={`password-${member.id}`} className="label !text-[11px]">New temporary password</label>
                      <input id={`password-${member.id}`} name="password" type="password" minLength={10} className="input !py-2 !text-sm" placeholder="Min 10 chars, upper, lower, number" required />
                    </div>
                    <ConfirmSubmit message={`Reset the password for ${member.name}? Existing sessions remain valid until they expire.`} className="btn-secondary !min-h-9 !text-xs" pendingText="Resetting…">
                      Reset password
                    </ConfirmSubmit>
                    <p className="text-[10px] leading-5 text-navy-400">Share the temporary password securely and ask the staff member to change it.</p>
                  </form>
                </div>
              </details>
            </div>
          ))}
          {!filtered.length && (
            <div className="card px-6 py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-navy-800">No staff accounts in this role</p>
            </div>
          )}
        </div>

        <Section title="Add a staff account" description="Create a new account with a temporary password.">
          <form action={createStaffAction} className="space-y-3">
            <input type="hidden" name="returnTo" value="/staff/admin/staff" />
            <div>
              <label htmlFor="newStaffName" className="label">Full name *</label>
              <input id="newStaffName" name="name" className="input" required />
            </div>
            <div>
              <label htmlFor="newStaffEmail" className="label">Work email *</label>
              <input id="newStaffEmail" name="email" type="email" className="input" required />
            </div>
            <div>
              <label htmlFor="newStaffTitle" className="label">Title</label>
              <input id="newStaffTitle" name="title" className="input" placeholder="e.g. Dental Surgeon" />
            </div>
            <div>
              <label htmlFor="newStaffRole" className="label">Role *</label>
              <select id="newStaffRole" name="role" className="select" defaultValue="receptionist">
                {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="newStaffPassword" className="label">Temporary password *</label>
              <input id="newStaffPassword" name="password" type="password" minLength={10} className="input" placeholder="Min 10 chars, upper, lower, number" required />
            </div>
            <SubmitButton className="w-full" pendingText="Creating…"><UserPlus className="h-4 w-4" aria-hidden /> Create account</SubmitButton>
            <p className="text-[10px] leading-5 text-navy-400">
              New accounts are active immediately. Role selection alone never grants access — the server checks the assigned role on every request.
            </p>
          </form>
        </Section>
      </div>
    </div>
  );
}
