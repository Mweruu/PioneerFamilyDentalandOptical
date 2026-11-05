import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireRole } from "@/lib/auth";
import {
  getAdminOverview,
  getAppointmentTrend,
  getAppointments,
  getFollowUpsDue,
  getNotificationRows,
  getStaffList,
} from "@/lib/data/queries";
import { ROLE_LABELS, type Role } from "@/lib/types";
import { clinicToday, formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clinic Overview" };

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; denied?: string }>;
}) {
  const user = await requireRole("admin");
  const params = await searchParams;
  const today = clinicToday();
  const overview = await getAdminOverview(today);
  const trend = await getAppointmentTrend(7);
  const staff = await getStaffList();
  const followUps = await getFollowUpsDue();
  const notifications = await getNotificationRows(8);
  const upcoming = await getAppointments({ fromDate: today, limit: 8 });
  const maxTrend = Math.max(1, ...trend.map((day) => day.count));
  const failed = notifications.filter((row) => row.status === "failed").length;
  const notConfigured = notifications.filter((row) => row.status === "not_configured").length;
  const activeStaff = staff.filter((member) => member.active === 1);

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(today, { weekday: "long" })}
        title="Clinic overview"
        description={`Administration workspace for ${user.name}. Manage access, services, schedules and governance.`}
        actions={
          <>
            <Link href="/staff/admin/reports" className="btn-secondary"><BarChart3 className="h-4 w-4" aria-hidden /> Reports</Link>
            <Link href="/staff/admin/staff" className="btn-primary"><UserCog className="h-4 w-4" aria-hidden /> Manage staff</Link>
          </>
        }
      />
      <Flash error={params.error} success={params.success} />
      {params.denied && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          You do not have permission to open that area. You were returned to the administration workspace.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active staff" value={overview.staffActive} hint={`${overview.staffTotal} accounts in total`} icon={Users} tone="navy" />
        <StatCard label="Registered patients" value={overview.patients} hint={`${overview.newPatients} registered this month`} icon={Activity} tone="teal" />
        <StatCard label="Appointments today" value={overview.appointments} hint={`${followUps.length} follow-ups due`} icon={CalendarDays} tone="sky" />
        <StatCard label="Notification issues" value={failed + notConfigured} hint={`${failed} failed · ${notConfigured} not configured`} icon={Bell} tone={failed ? "rose" : "amber"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Appointment activity" description="Bookings and completions over the last seven days.">
            <div className="flex h-44 items-end gap-2">
              {trend.length === 0 ? (
                <p className="text-xs text-navy-500">No appointment activity recorded in this period.</p>
              ) : (
                trend.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-32 w-full items-end justify-center gap-0.5">
                      <div className="w-full max-w-5 rounded-t bg-navy-200" style={{ height: `${Math.max(4, (day.count / maxTrend) * 100)}%` }} title={`${day.count} appointments`} />
                      <div className="w-full max-w-5 rounded-t bg-teal-500" style={{ height: `${Math.max(2, (day.completed / maxTrend) * 100)}%` }} title={`${day.completed} completed`} />
                    </div>
                    <span className="text-[10px] text-navy-400">{formatDate(day.date, { weekday: "short", day: "numeric", month: undefined, year: undefined })}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-navy-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-navy-200" aria-hidden /> Booked</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" aria-hidden /> Completed</span>
            </div>
          </Section>

          <Section title="Staff by role" description="Active and inactive accounts by role." bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {overview.staff.map((row) => (
                <li key={row.role} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{ROLE_LABELS[row.role as Role] ?? row.role}</p>
                    <p className="text-[11px] text-navy-400">{row.active ?? 0} active of {row.count}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-navy-900">{row.count}</span>
                    <Link href={`/staff/admin/staff?role=${row.role}`} className="text-xs font-bold text-teal-700 hover:text-teal-900">Manage →</Link>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Upcoming appointments" description="Next bookings across both departments." bodyClassName="p-0">
            {upcoming.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No upcoming appointments.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((appointment) => (
                  <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900">{appointment.full_name}</p>
                      <p className="text-[11px] text-navy-400">{formatDate(appointment.appointment_date)} · {appointment.appointment_time} · {appointment.department} · {appointment.doctor_name}</p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Governance shortcuts">
            <div className="grid gap-2">
              <Link href="/staff/admin/reports" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-xs font-semibold text-navy-800 hover:bg-navy-50"><BarChart3 className="h-4 w-4 text-teal-600" aria-hidden /> Daily and monthly reports</Link>
              <Link href="/staff/admin/audit" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-xs font-semibold text-navy-800 hover:bg-navy-50"><ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden /> Audit log</Link>
              <Link href="/staff/admin/notifications" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-xs font-semibold text-navy-800 hover:bg-navy-50"><Bell className="h-4 w-4 text-teal-600" aria-hidden /> Notifications</Link>
              <Link href="/staff/admin/settings" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-xs font-semibold text-navy-800 hover:bg-navy-50"><Settings className="h-4 w-4 text-teal-600" aria-hidden /> Clinic settings</Link>
            </div>
          </Section>

          <Section title="Follow-ups due" description="Treatment plans and optical reviews across the clinic." bodyClassName="p-0">
            {followUps.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No follow-ups due.</p>
            ) : (
              <ul className="divide-y divide-line">
                {(followUps as { id: string; full_name: string; patient_number: string; next_review_date: string | null; department: string; procedure: string }[])
                  .slice(0, 6)
                  .map((row) => (
                    <li key={`${row.department}-${row.id}`} className="px-5 py-3">
                      <p className="truncate text-xs font-semibold text-navy-900">{row.full_name} · {row.patient_number}</p>
                      <p className="truncate text-[10px] text-navy-400">{row.department} · {row.procedure} · {formatDate(row.next_review_date)}</p>
                    </li>
                  ))}
              </ul>
            )}
          </Section>

          <Section title="Recent notifications" description="Delivery status from the WhatsApp, SMS and email queue." bodyClassName="p-0">
            {notifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No notifications recorded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.slice(0, 6).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{row.template} · {row.channel.toUpperCase()}</p>
                      <p className="truncate text-[10px] text-navy-400">{row.recipient} · {formatDateTime(row.created_at)}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="flex items-center gap-2 font-semibold text-navy-800"><ClipboardList className="h-4 w-4 text-teal-600" aria-hidden /> {activeStaff.length} active staff accounts</p>
            <p className="mt-2">Administrators cannot open dental or optical clinical records. Clinical privacy is enforced by role.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
