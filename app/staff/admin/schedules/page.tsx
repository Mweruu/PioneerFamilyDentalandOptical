import Link from "next/link";
import { CalendarDays, CalendarPlus, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { getDoctors, getSchedules } from "@/lib/data/queries";
import { saveScheduleAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clinician Schedules" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function AdminSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; doctor?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const schedules = getSchedules();
  const doctors = getDoctors();
  const grouped = doctors.map((doctor) => ({
    doctor,
    schedules: schedules.filter((schedule) => schedule.doctor_id === doctor.id),
  }));
  const selectedDoctor = params.doctor ?? doctors[0]?.id ?? "";

  return (
    <div>
      <PageHeader
        eyebrow="Availability"
        title="Clinician schedules"
        description="Set weekly working sessions, breaks and slot lengths. Public booking only offers slots inside an active session."
        actions={<Link href="/staff/admin/services" className="btn-secondary"><CalendarDays className="h-4 w-4" aria-hidden /> Services</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          {grouped.map(({ doctor, schedules: rows }) => (
            <Section key={doctor.id} title={doctor.name} description={`${doctor.title || (doctor.role === "dentist" ? "Dentist" : "Eye doctor")} · ${rows.filter((row) => row.active).length} active day(s)`}>
              <div className="space-y-2.5">
                {rows.map((schedule) => (
                  <div key={schedule.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{WEEKDAYS[schedule.weekday]}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-navy-500">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /> {schedule.start_time}–{schedule.end_time}</span>
                          {schedule.break_start && schedule.break_end && <span>Break {schedule.break_start}–{schedule.break_end}</span>}
                          <span>{schedule.slot_minutes} min slots</span>
                        </p>
                      </div>
                      <span className={schedule.active ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-slate-100 text-slate-600 ring-slate-200"}>
                        {schedule.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <details className="mt-2.5 border-t border-line pt-2.5">
                      <summary className="cursor-pointer text-[11px] font-bold text-teal-700">Edit session</summary>
                      <form action={saveScheduleAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="doctorId" value={schedule.doctor_id} />
                        <input type="hidden" name="weekday" value={schedule.weekday} />
                        <input type="hidden" name="returnTo" value="/staff/admin/schedules" />
                        <div>
                          <label htmlFor={`start-${schedule.id}`} className="label !text-[11px]">Start time</label>
                          <input id={`start-${schedule.id}`} name="startTime" type="time" className="input !py-2 !text-sm" defaultValue={schedule.start_time} required />
                        </div>
                        <div>
                          <label htmlFor={`end-${schedule.id}`} className="label !text-[11px]">End time</label>
                          <input id={`end-${schedule.id}`} name="endTime" type="time" className="input !py-2 !text-sm" defaultValue={schedule.end_time} required />
                        </div>
                        <div>
                          <label htmlFor={`breakStart-${schedule.id}`} className="label !text-[11px]">Break start</label>
                          <input id={`breakStart-${schedule.id}`} name="breakStart" type="time" className="input !py-2 !text-sm" defaultValue={schedule.break_start ?? ""} />
                        </div>
                        <div>
                          <label htmlFor={`breakEnd-${schedule.id}`} className="label !text-[11px]">Break end</label>
                          <input id={`breakEnd-${schedule.id}`} name="breakEnd" type="time" className="input !py-2 !text-sm" defaultValue={schedule.break_end ?? ""} />
                        </div>
                        <div>
                          <label htmlFor={`slot-${schedule.id}`} className="label !text-[11px]">Slot length (min)</label>
                          <input id={`slot-${schedule.id}`} name="slotMinutes" type="number" min={10} max={120} className="input !py-2 !text-sm" defaultValue={schedule.slot_minutes} required />
                        </div>
                        <label className="mt-6 flex items-center gap-2 text-xs text-navy-700">
                          <input type="checkbox" name="active" defaultChecked={schedule.active === 1} className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                          Session active
                        </label>
                        <div className="flex justify-end sm:col-span-2">
                          <SubmitButton className="!min-h-9 !text-xs" pendingText="Saving…">Save session</SubmitButton>
                        </div>
                      </form>
                    </details>
                  </div>
                ))}
                {!rows.length && <p className="text-xs text-navy-500">No sessions configured for this clinician.</p>}
              </div>
            </Section>
          ))}
          {!grouped.length && (
            <div className="card px-6 py-12 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-navy-800">No clinicians found</p>
              <p className="mt-1 text-xs text-navy-500">Add a dentist or eye doctor account before configuring schedules.</p>
            </div>
          )}
        </div>

        <Section title="Add or replace a session" description="Saving the same clinician and weekday replaces the existing session.">
          <form action={saveScheduleAction} className="space-y-3">
            <input type="hidden" name="returnTo" value="/staff/admin/schedules" />
            <div>
              <label htmlFor="scheduleDoctor" className="label">Clinician *</label>
              <select id="scheduleDoctor" name="doctorId" className="select" defaultValue={selectedDoctor} required>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.role === "dentist" ? "Dentist" : "Eye doctor"}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="scheduleWeekday" className="label">Day of week *</label>
              <select id="scheduleWeekday" name="weekday" className="select" defaultValue="1" required>
                {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="scheduleStart" className="label">Start time *</label>
                <input id="scheduleStart" name="startTime" type="time" className="input" defaultValue="08:00" required />
              </div>
              <div>
                <label htmlFor="scheduleEnd" className="label">End time *</label>
                <input id="scheduleEnd" name="endTime" type="time" className="input" defaultValue="17:00" required />
              </div>
              <div>
                <label htmlFor="scheduleBreakStart" className="label">Break start</label>
                <input id="scheduleBreakStart" name="breakStart" type="time" className="input" defaultValue="13:00" />
              </div>
              <div>
                <label htmlFor="scheduleBreakEnd" className="label">Break end</label>
                <input id="scheduleBreakEnd" name="breakEnd" type="time" className="input" defaultValue="14:00" />
              </div>
            </div>
            <div>
              <label htmlFor="scheduleSlot" className="label">Slot length (minutes) *</label>
              <input id="scheduleSlot" name="slotMinutes" type="number" min={10} max={120} className="input" defaultValue={30} required />
            </div>
            <label className="flex items-center gap-2 text-xs text-navy-700">
              <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
              Session active
            </label>
            <SubmitButton className="w-full" pendingText="Saving session…"><CalendarPlus className="h-4 w-4" aria-hidden /> Save session</SubmitButton>
          </form>
          <p className="mt-3 text-[10px] leading-5 text-navy-400">
            Slots are generated from the session start time in increments of the slot length. Appointments that overlap a break or blocked period are not offered publicly.
          </p>
        </Section>
      </div>
    </div>
  );
}
