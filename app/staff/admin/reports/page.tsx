import Link from "next/link";
import { BarChart3, CalendarDays, Clock, Filter, TrendingUp, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireRole } from "@/lib/auth";
import { getAppointmentTrend, getDashboardCounts, getFollowUpsDue, getReports } from "@/lib/data/queries";
import { clinicToday, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clinic Reports" };

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; success?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : clinicToday();
  const reports = await getReports(date);
  const counts = await getDashboardCounts(date);
  const trend = await getAppointmentTrend(14);
  const followUps = await getFollowUpsDue();
  const totalAppointments = reports.daily.reduce((sum, row) => sum + row.count, 0);
  const completed = reports.daily.filter((row) => row.status === "Completed").reduce((sum, row) => sum + row.count, 0);
  const completionRate = totalAppointments ? Math.round((completed / totalAppointments) * 100) : 0;
  const maxTrend = Math.max(1, ...trend.map((day) => day.count));

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Clinic reports"
        description="Daily activity, patient flow and follow-up workload. Reports use the clinic's Africa/Nairobi date."
        actions={<Link href="/staff/admin/audit" className="btn-secondary"><BarChart3 className="h-4 w-4" aria-hidden /> Audit trail</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <form className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label htmlFor="reportDate" className="label">Report date</label>
          <input id="reportDate" name="date" type="date" defaultValue={date} className="input" />
        </div>
        <button type="submit" className="btn-primary"><Filter className="h-4 w-4" aria-hidden /> Run report</button>
        <Link href="/staff/admin/reports" className="btn-secondary">Today</Link>
        <p className="ml-auto self-center text-xs text-navy-500">{formatDate(date, { weekday: "long" })}</p>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Appointments" value={totalAppointments} hint={`${counts.checkedIn + counts.waiting} checked in · ${counts.noShow} no-show`} icon={CalendarDays} tone="navy" />
        <StatCard label="Completed" value={completed} hint={`${completionRate}% completion rate`} icon={TrendingUp} tone="emerald" />
        <StatCard label="New patients" value={reports.registrations} hint={`${reports.registrationsMonth} this month`} icon={UserPlus} tone="sky" />
        <StatCard label="Follow-ups due" value={reports.followUpsDue} hint={`${followUps.length} across departments`} icon={Clock} tone="amber" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Appointments by department and status" description="Every appointment recorded on the selected date." bodyClassName="p-0">
            {reports.daily.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No appointments recorded on this date.</p>
            ) : (
              <div className="table-wrap !rounded-none !border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Appointments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.daily.map((row) => (
                      <tr key={`${row.department}-${row.status}`}>
                        <td className="text-xs font-semibold capitalize text-navy-800">{row.department}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td className="text-sm font-semibold text-navy-900">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="14-day appointment trend" description="Booked volume with completed appointments highlighted.">
            {trend.length === 0 ? (
              <p className="text-xs text-navy-500">No appointment activity in the last 14 days.</p>
            ) : (
              <>
                <div className="flex h-44 items-end gap-1.5">
                  {trend.map((day) => (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-32 w-full items-end justify-center gap-0.5">
                        <div className="w-full max-w-4 rounded-t bg-navy-200" style={{ height: `${Math.max(4, (day.count / maxTrend) * 100)}%` }} title={`${day.count} appointments`} />
                        <div className="w-full max-w-4 rounded-t bg-teal-500" style={{ height: `${Math.max(2, (day.completed / maxTrend) * 100)}%` }} title={`${day.completed} completed`} />
                      </div>
                      <span className="text-[9px] text-navy-400">{day.date.slice(8)}/{day.date.slice(5, 7)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-navy-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-navy-200" aria-hidden /> Booked</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" aria-hidden /> Completed</span>
                </div>
              </>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Clinical output" description="Completed visits on the selected date.">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5">
                <span className="text-xs font-semibold text-navy-700">Dental visits completed</span>
                <span className="text-lg font-semibold text-navy-900">{reports.dentalCompleted}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5">
                <span className="text-xs font-semibold text-navy-700">Optical visits completed</span>
                <span className="text-lg font-semibold text-navy-900">{reports.opticalCompleted}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5">
                <span className="text-xs font-semibold text-navy-700">Average wait to clinician</span>
                <span className="text-lg font-semibold text-navy-900">{reports.averageWaitMinutes === null ? "—" : `${reports.averageWaitMinutes} min`}</span>
              </div>
            </div>
          </Section>

          <Section title="Cancellations and no-shows">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">Cancelled</p>
                <p className="mt-1 text-2xl font-semibold text-slate-700">{reports.cancellations}</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">No-show</p>
                <p className="mt-1 text-2xl font-semibold text-rose-700">{reports.noShows}</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-navy-400">
              Follow-up counts include dental treatment plans with a review date due and optical visits with a follow-up date due.
            </p>
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="flex items-center gap-2 font-semibold text-navy-800"><BarChart3 className="h-4 w-4 text-teal-600" aria-hidden /> Reporting notes</p>
            <p className="mt-2">Reports are operational only. Financial reconciliation, insurance claims and statutory returns should be produced from the accounting system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
