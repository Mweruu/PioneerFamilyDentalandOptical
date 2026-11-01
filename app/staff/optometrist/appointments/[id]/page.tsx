import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Clock, Eye, Play, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import {
  getAppointment,
  getLatestVitals,
  getOpticalVisitForAppointment,
  getPatient,
} from "@/lib/data/queries";
import { startOpticalConsultationAction } from "@/lib/actions/optical";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Optical Appointment" };

export default async function OptometristAppointmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("eye_doctor");
  const { id } = await params;
  const flash = await searchParams;
  const appointment = getAppointment(id);
  if (!appointment) notFound();
  if (appointment.department !== "optical" || appointment.doctor_id !== user.id) {
    redirect(`/staff/optometrist/appointments?error=${encodeURIComponent("That appointment is not assigned to you.")}`);
  }

  const patient = appointment.patient_id ? getPatient(appointment.patient_id) : undefined;
  const opticalVisit = getOpticalVisitForAppointment(appointment.id);
  const vitals = patient ? getLatestVitals(patient.id) : undefined;
  const active = !["Completed", "Cancelled", "No Show"].includes(appointment.status);

  return (
    <div>
      <PageHeader
        eyebrow="Optical appointment"
        title={appointment.full_name}
        description={`${appointment.reference} · ${formatDate(appointment.appointment_date, { weekday: "long" })} at ${formatTime(appointment.appointment_time)}`}
        breadcrumbs={[
          { label: "My appointments", href: "/staff/optometrist/appointments" },
          { label: appointment.reference },
        ]}
        actions={<Link href="/staff/optometrist/appointments" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to schedule</Link>}
      />
      <Flash error={flash.error} success={flash.success} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          {patient ? (
            <PatientBanner
              patient={patient}
              actions={<Link href={`/staff/optometrist/patients/${patient.id}`} className="btn-secondary"><Eye className="h-4 w-4" aria-hidden /> Optical record</Link>}
            />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <p className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                Reception has not linked this booking to a patient record yet. Ask the front desk to match the booking before starting the examination.
              </p>
            </div>
          )}

          <Section title="Appointment details">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Status</dt>
                <dd className="mt-1"><StatusBadge status={appointment.status} /></dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Service</dt>
                <dd className="mt-1 text-sm font-semibold text-navy-900">{appointment.service_name || "Eye examination"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Date</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm text-navy-800"><CalendarClock className="h-4 w-4 text-teal-600" aria-hidden />{formatDate(appointment.appointment_date, { weekday: "long" })}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Time</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm text-navy-800"><Clock className="h-4 w-4 text-teal-600" aria-hidden />{formatTime(appointment.appointment_time)} · {appointment.duration_minutes} min</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Reason for visit</dt>
                <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-navy-700">{appointment.reason}</dd>
              </div>
              {appointment.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Front-desk notes</dt>
                  <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-navy-600">{appointment.notes}</dd>
                </div>
              )}
            </dl>
          </Section>

          {patient && (
            <Section title="Latest vitals" description="Recorded by the front desk before the visit.">
              {vitals ? (
                <div className="grid gap-3 text-xs text-navy-700 sm:grid-cols-3">
                  <p><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">Blood pressure</span>{vitals.bp_systolic && vitals.bp_diastolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg` : "—"}</p>
                  <p><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">Pulse</span>{vitals.pulse ? `${vitals.pulse} bpm` : "—"}</p>
                  <p><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">Temperature</span>{vitals.temperature_c ? `${vitals.temperature_c} °C` : "—"}</p>
                  <p><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">Weight / BMI</span>{vitals.weight_kg ? `${vitals.weight_kg} kg` : "—"}{vitals.bmi ? ` · BMI ${vitals.bmi}` : ""}</p>
                  <p><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">SpO₂</span>{vitals.spo2 ? `${vitals.spo2}%` : "—"}</p>
                  <p><span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-400">Recorded</span>{formatDateTime(vitals.recorded_at)}</p>
                </div>
              ) : (
                <p className="text-xs text-navy-500">No vitals recorded for this patient yet.</p>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Eye examination" description="Open or continue the optical record for this visit.">
            {opticalVisit ? (
              <div className="space-y-3">
                <p className="flex items-start gap-2 text-xs leading-5 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  An optical examination already exists for this appointment.
                </p>
                <Link href={`/staff/optometrist/consultations/${opticalVisit.id}`} className="btn-primary w-full">
                  <Eye className="h-4 w-4" aria-hidden /> Open examination
                </Link>
              </div>
            ) : active && patient ? (
              <form action={startOpticalConsultationAction}>
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <SubmitButton className="w-full" pendingText="Starting…">
                  <Play className="h-4 w-4" aria-hidden /> Start eye examination
                </SubmitButton>
              </form>
            ) : (
              <p className="rounded-xl border border-line bg-mist p-3 text-xs leading-5 text-navy-500">
                {!patient
                  ? "Link a patient record before starting the examination."
                  : `This appointment is ${appointment.status.toLowerCase()} and cannot be started.`}
              </p>
            )}
            {patient && (
              <Link href={`/staff/optometrist/patients/${patient.id}`} className="btn-secondary mt-3 w-full">
                <UserRound className="h-4 w-4" aria-hidden /> View optical patient card
              </Link>
            )}
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p><strong className="text-navy-700">Booked:</strong> {formatDateTime(appointment.created_at)}</p>
            {appointment.checked_in_at && <p className="mt-1"><strong className="text-navy-700">Checked in:</strong> {formatDateTime(appointment.checked_in_at)}</p>}
            <p className="mt-1"><strong className="text-navy-700">Source:</strong> {appointment.source.replaceAll("_", " ")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
