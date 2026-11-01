import Link from "next/link";
import { CalendarCheck2, ClipboardList, Eye, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { requireRole } from "@/lib/auth";
import { getFollowUpsDue } from "@/lib/data/queries";
import { clinicToday, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Optical Follow-ups" };

type OpticalFollowUp = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  full_name: string;
  patient_number: string;
  phone: string;
  visit_date: string;
  diagnosis: string | null;
  management_plan: string | null;
  referral: string | null;
  follow_up_date: string | null;
  doctor_id: string;
};

export default async function OptometristFollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string }>;
}) {
  const user = await requireRole("eye_doctor");
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const all = (getFollowUpsDue("optical") as OpticalFollowUp[]).filter((visit) => visit.doctor_id === user.id);
  const followUps = query
    ? all.filter((visit) =>
        [visit.full_name, visit.patient_number, visit.phone, visit.diagnosis, visit.management_plan]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query)),
      )
    : all;

  const overdue = followUps.filter((visit) => visit.follow_up_date && visit.follow_up_date < clinicToday());
  const dueToday = followUps.filter((visit) => visit.follow_up_date === clinicToday());

  return (
    <div>
      <PageHeader
        eyebrow="Optical review list"
        title="Follow-ups due"
        description="Optical examinations you recorded with a follow-up date that has arrived or passed."
        actions={<Link href="/staff/optometrist/appointments" className="btn-secondary"><CalendarCheck2 className="h-4 w-4" aria-hidden /> My schedule</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Total due</p>
          <p className="mt-1 text-2xl font-semibold text-navy-900">{followUps.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Overdue</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">{overdue.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Due today</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{dueToday.length}</p>
        </div>
      </div>

      <form className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="opticalFollowUpSearch" className="label">Search reviews</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input id="opticalFollowUpSearch" name="q" defaultValue={params.q} className="input !pl-9" placeholder="Patient, number, diagnosis or plan" />
          </div>
        </div>
        <button type="submit" className="btn-primary">Search</button>
        {query && <Link href="/staff/optometrist/follow-ups" className="btn-secondary">Clear</Link>}
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Exam date</th>
              <th>Diagnosis</th>
              <th>Management / referral</th>
              <th>Follow-up</th>
              <th>Status</th>
              <th><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {followUps.map((visit) => {
              const isOverdue = Boolean(visit.follow_up_date && visit.follow_up_date < clinicToday());
              return (
                <tr key={visit.id}>
                  <td>
                    <Link href={`/staff/optometrist/patients/${visit.patient_id}`} className="font-semibold text-navy-900 hover:text-teal-700">
                      {visit.full_name}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-navy-400">{visit.patient_number} · {visit.phone}</p>
                  </td>
                  <td className="text-xs">{formatDate(visit.visit_date)}</td>
                  <td className="max-w-[220px] whitespace-normal text-xs">{visit.diagnosis || "Not recorded"}</td>
                  <td className="max-w-[240px] whitespace-normal text-[11px] text-navy-500">
                    {visit.management_plan || "—"}
                    {visit.referral ? ` · Referral: ${visit.referral}` : ""}
                  </td>
                  <td>
                    <span className={isOverdue ? "text-xs font-semibold text-rose-700" : "text-xs text-navy-700"}>{formatDate(visit.follow_up_date)}</span>
                    {isOverdue && <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-rose-500">Overdue</span>}
                  </td>
                  <td><StatusBadge status={isOverdue ? "High" : "Monitoring"} /></td>
                  <td className="text-right">
                    <Link href={`/staff/optometrist/patients/${visit.patient_id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50">
                      <Eye className="h-3.5 w-3.5" aria-hidden /> Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!followUps.length && (
          <div className="px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-navy-800">No follow-ups due</p>
            <p className="mt-1 text-xs text-navy-500">
              {query ? "No reviews match your search." : "Optical visits with a follow-up date on or before today appear here."}
            </p>
            <Link href="/staff/optometrist/patients" className="btn-secondary mt-4"><Eye className="h-4 w-4" aria-hidden /> Open a patient record</Link>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-navy-400">
        Only optical visits you recorded are shown. To bring a patient back, ask reception to book a review appointment.
      </p>
    </div>
  );
}
