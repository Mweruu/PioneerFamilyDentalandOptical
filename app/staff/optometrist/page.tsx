import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Glasses,
  Play,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { AppointmentTable } from "@/components/staff/appointment-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import {
  getAppointments,
  getDashboardCounts,
  getFollowUpsDue,
  getInConsultation,
  getRecentPatients,
  getWaitingPatients,
} from "@/lib/data/queries";
import { startOpticalConsultationAction } from "@/lib/actions/optical";
import { clinicToday, formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Optical Dashboard" };

type OpticalFollowUp = {
  id: string;
  patient_id: string;
  full_name: string;
  patient_number: string;
  phone: string;
  diagnosis: string | null;
  management_plan: string | null;
  follow_up_date: string | null;
  doctor_id: string;
};

export default async function OptometristDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; denied?: string }>;
}) {
  const user = await requireRole("eye_doctor");
  const params = await searchParams;
  const today = clinicToday();
  const appointments = getAppointments({ doctorId: user.id, date: today, department: "optical" });
  const counts = getDashboardCounts(today, { doctorId: user.id, department: "optical" });
  const waiting = getWaitingPatients("optical", user.id);
  const inConsultation = getInConsultation("optical", user.id);
  const followUps = (getFollowUpsDue("optical") as OpticalFollowUp[]).filter((visit) => visit.doctor_id === user.id);
  const recentPatients = getRecentPatients(user.id, "optical", 5);
  const nextAppointments = appointments.filter((appointment) =>
    ["Booked", "Confirmed", "Checked In", "Waiting for Doctor"].includes(appointment.status),
  );

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(today, { weekday: "long" })}
        title={`Good day, ${user.name.replace(/^Dr\.?\s*/i, "").split(" ")[0]}.`}
        description="Your optical list, waiting patients and review appointments for today."
        actions={
          <>
            <Link href="/staff/optometrist/patients" className="btn-secondary">
              <Users className="h-4 w-4" aria-hidden /> Find a patient
            </Link>
            <Link href="/staff/optometrist/appointments" className="btn-primary">
              <CalendarDays className="h-4 w-4" aria-hidden /> My appointments
            </Link>
          </>
        }
      />
      <Flash error={params.error} success={params.success} />
      {params.denied && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          You do not have permission to open that area. You were returned to your optical workspace.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's list" value={counts.total} hint={`${counts.checkedIn + counts.waiting} waiting to be seen`} icon={CalendarDays} tone="navy" />
        <StatCard label="In the queue" value={waiting.length} hint={`${inConsultation.length} in consultation`} icon={Clock} tone="amber" />
        <StatCard label="Completed today" value={counts.completed} hint={`${counts.noShow} no-show · ${counts.cancelled} cancelled`} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Reviews due" value={followUps.length} hint="Optical follow-up reviews" icon={ClipboardList} tone="teal" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section
            title="Waiting room"
            description="Patients checked in and ready for an eye examination."
            action={<Link href="/staff/optometrist/appointments" className="text-xs font-bold text-teal-700 hover:text-teal-900">Full schedule →</Link>}
          >
            {waiting.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-8 text-center text-xs text-navy-500">
                Nobody is waiting right now. New check-ins appear here automatically.
              </p>
            ) : (
              <ul className="space-y-3">
                {waiting.map((appointment) => (
                  <li key={appointment.id} className="flex flex-col gap-3 rounded-xl border border-line p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-navy-900">{appointment.full_name}</p>
                        <StatusBadge status={appointment.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-navy-400">
                        {formatTime(appointment.appointment_time)} · {appointment.reference} · {appointment.patient_number || "No patient record"}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-navy-500">{appointment.reason}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {appointment.patient_id && (
                        <Link href={`/staff/optometrist/patients/${appointment.patient_id}`} className="btn-secondary !min-h-9 !px-3 !text-xs">
                          Open record
                        </Link>
                      )}
                      <form action={startOpticalConsultationAction}>
                        <input type="hidden" name="appointmentId" value={appointment.id} />
                        <SubmitButton className="!min-h-9 !px-3 !text-xs" pendingText="Starting…">
                          <Play className="h-3.5 w-3.5" aria-hidden /> Start examination
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Today's optical appointments"
            description="Bookings assigned to you."
            action={<Link href="/staff/optometrist/appointments" className="text-xs font-bold text-teal-700 hover:text-teal-900">View all →</Link>}
            bodyClassName="p-0"
          >
            <AppointmentTable
              appointments={appointments.slice(0, 10)}
              basePath="/staff/optometrist/appointments"
              showClinician={false}
              emptyMessage="You have no optical appointments booked for today."
            />
          </Section>

          <Section
            title="Reviews due"
            description="Optical visits you recorded with a follow-up date that has arrived."
            action={<Link href="/staff/optometrist/follow-ups" className="text-xs font-bold text-teal-700 hover:text-teal-900">View all →</Link>}
          >
            {followUps.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-7 text-center text-xs text-navy-500">
                No optical follow-ups are due.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {followUps.slice(0, 5).map((visit) => (
                  <li key={visit.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/staff/optometrist/patients/${visit.patient_id}`} className="block truncate text-xs font-semibold text-navy-900 hover:text-teal-700">
                        {visit.full_name} · {visit.patient_number}
                      </Link>
                      <p className="truncate text-[10px] text-navy-400">{visit.diagnosis || "Optical review"} · {formatDate(visit.follow_up_date)}</p>
                    </div>
                    <Eye className="h-4 w-4 shrink-0 text-navy-300" aria-hidden />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="In consultation" description="Currently open optical records.">
            {inConsultation.length === 0 ? (
              <p className="text-xs text-navy-500">No examinations in progress.</p>
            ) : (
              <ul className="space-y-2.5">
                {inConsultation.map((appointment) => (
                  <li key={appointment.id} className="rounded-xl border border-line px-3 py-2.5">
                    <p className="text-xs font-semibold text-navy-900">{appointment.full_name}</p>
                    <p className="text-[10px] text-navy-400">{formatTime(appointment.appointment_time)} · {appointment.reference}</p>
                    {appointment.patient_id && (
                      <Link href={`/staff/optometrist/patients/${appointment.patient_id}`} className="mt-2 inline-flex text-[11px] font-bold text-teal-700 hover:text-teal-900">
                        Open optical record →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recently viewed" description="Your recent optical patient records.">
            {recentPatients.length === 0 ? (
              <p className="text-xs text-navy-500">Patient records you open will appear here.</p>
            ) : (
              <ul className="space-y-2.5">
                {recentPatients.map((patient) => (
                  <li key={patient.id}>
                    <Link href={`/staff/optometrist/patients/${patient.id}`} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1.5 hover:bg-navy-50">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-navy-900">{patient.full_name}</p>
                        <p className="text-[10px] text-navy-400">{patient.patient_number} · {patient.phone}</p>
                      </div>
                      <Eye className="h-3.5 w-3.5 shrink-0 text-navy-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Next up" description="Your upcoming optical appointments.">
            {nextAppointments.length === 0 ? (
              <p className="text-xs text-navy-500">No further appointments on today&apos;s list.</p>
            ) : (
              <ul className="space-y-2.5">
                {nextAppointments.slice(0, 6).map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{appointment.full_name}</p>
                      <p className="text-[10px] text-navy-400">{formatTime(appointment.appointment_time)} · {appointment.service_name || "Eye examination"}</p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Glasses className="h-4 w-4 text-teal-600" aria-hidden /> Quick actions
            </p>
            <div className="mt-3 space-y-2">
              <Link href="/staff/optometrist/patients" className="btn-secondary w-full">Find or start a patient record</Link>
              <Link href="/staff/optometrist/follow-ups" className="btn-ghost w-full">Review follow-ups</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
