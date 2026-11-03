import Link from "next/link";
import { CalendarCheck2, ClipboardList, Clock, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { getFollowUpsDue } from "@/lib/data/queries";
import { updateTreatmentPlanStatusAction } from "@/lib/actions/dental";
import { formatKes } from "@/lib/format";
import { clinicToday, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dental Follow-ups" };

type FollowUp = {
  id: string;
  patient_id: string;
  full_name: string;
  patient_number: string;
  phone: string;
  tooth_numbers: string;
  diagnosis: string;
  procedure: string;
  priority: "Low" | "Medium" | "High";
  estimated_cost: number | null;
  status: string;
  notes: string | null;
  next_review_date: string | null;
  created_by: string;
};

export default async function DentistFollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; q?: string }>;
}) {
  const user = await requireRole("dentist");
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const all = ((await getFollowUpsDue("dental")) as FollowUp[]).filter((plan) => plan.created_by === user.id);
  const followUps = query
    ? all.filter((plan) =>
        [plan.full_name, plan.patient_number, plan.phone, plan.procedure, plan.diagnosis]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query)),
      )
    : all;

  const overdue = followUps.filter((plan) => plan.next_review_date && plan.next_review_date < clinicToday());
  const dueToday = followUps.filter((plan) => plan.next_review_date === clinicToday());

  return (
    <div>
      <PageHeader
        eyebrow="Dental treatment plans"
        title="Follow-ups due"
        description="Open treatment plans you created that have reached their review date. Update the status after reviewing the patient."
        actions={<Link href="/staff/dentist/appointments" className="btn-secondary"><CalendarCheck2 className="h-4 w-4" aria-hidden /> My schedule</Link>}
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
          <label htmlFor="followUpSearch" className="label">Search follow-ups</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input id="followUpSearch" name="q" defaultValue={params.q} className="input !pl-9" placeholder="Patient, number, procedure or diagnosis" />
          </div>
        </div>
        <button type="submit" className="btn-primary">Search</button>
        {query && <Link href="/staff/dentist/follow-ups" className="btn-secondary">Clear</Link>}
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Tooth / diagnosis</th>
              <th>Procedure</th>
              <th>Review date</th>
              <th>Priority</th>
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {followUps.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <Link href={`/staff/dentist/patients/${plan.patient_id}`} className="font-semibold text-navy-900 hover:text-teal-700">
                    {plan.full_name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-navy-400">{plan.patient_number} · {plan.phone}</p>
                </td>
                <td className="whitespace-normal">
                  <p className="text-xs font-semibold text-navy-800">Tooth {plan.tooth_numbers || "—"}</p>
                  <p className="mt-0.5 text-[11px] text-navy-400">{plan.diagnosis}</p>
                </td>
                <td className="whitespace-normal text-xs">
                  {plan.procedure}
                  {plan.estimated_cost !== null && <span className="mt-0.5 block text-[11px] text-navy-400">{formatKes(plan.estimated_cost)}</span>}
                </td>
                <td>
                  <span className={plan.next_review_date && plan.next_review_date < clinicToday() ? "text-xs font-semibold text-rose-700" : "text-xs text-navy-700"}>
                    {formatDate(plan.next_review_date)}
                  </span>
                </td>
                <td><StatusBadge status={plan.priority} /></td>
                <td><StatusBadge status={plan.status} /></td>
                <td>
                  <form action={updateTreatmentPlanStatusAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="returnTo" value="/staff/dentist/follow-ups" />
                    <select name="status" className="select !min-h-8 !w-auto !py-1 !pl-2 !pr-7 !text-[11px]" defaultValue={plan.status} aria-label={`Status for ${plan.full_name}`}>
                      <option value="Planned">Planned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <SubmitButton className="!min-h-8 !px-2 !text-[11px]" pendingText="…">Save</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!followUps.length && (
          <div className="px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-navy-800">No follow-ups due</p>
            <p className="mt-1 text-xs text-navy-500">
              {query ? "No plans match your search." : "Treatment plans with a review date on or before today appear here."}
            </p>
            <Link href="/staff/dentist/patients" className="btn-secondary mt-4"><Clock className="h-4 w-4" aria-hidden /> Open a patient record</Link>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-navy-400">
        Only treatment plans you created are shown. Other clinicians manage their own follow-up lists.
      </p>
    </div>
  );
}
