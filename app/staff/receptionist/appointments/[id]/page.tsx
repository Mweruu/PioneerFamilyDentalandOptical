import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Link2,
  Mail,
  MessageSquare,
  Phone,
  UserPlus,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { ConfirmSubmit } from "@/components/staff/confirm-submit";
import { RescheduleForm } from "@/components/staff/reschedule-form";
import { requireRole } from "@/lib/auth";
import {
  getAppointment,
  getAuditForEntity,
  getNotificationsForAppointment,
  getPatient,
} from "@/lib/data/queries";
import {
  cancelAppointmentAction,
  checkInAppointmentAction,
  linkExistingPatientToAppointmentAction,
  markConfirmedAction,
  markNoShowAction,
  markReminderSentAction,
  markWaitingAction,
} from "@/lib/actions/reception";
import { DEPARTMENTS } from "@/lib/types";
import { clinicToday, formatDate, formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Appointment Detail" };

export default async function ReceptionAppointmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole("receptionist");
  const { id } = await params;
  const flash = await searchParams;
  const appointment = getAppointment(id);
  if (!appointment) notFound();

  const patient = appointment.patient_id ? getPatient(appointment.patient_id) : undefined;
  const notifications = getNotificationsForAppointment(appointment.id);
  const audit = getAuditForEntity("appointment", appointment.id, 12);
  const returnTo = `/staff/receptionist/appointments/${appointment.id}`;
  const active = !["Completed", "Cancelled", "No Show", "In Consultation"].includes(appointment.status);
  const registerHref = `/staff/receptionist/patients/new?appointmentId=${encodeURIComponent(appointment.id)}&fullName=${encodeURIComponent(appointment.full_name)}&phone=${encodeURIComponent(appointment.phone)}${appointment.email ? `&email=${encodeURIComponent(appointment.email)}` : ""}${appointment.date_of_birth ? `&dateOfBirth=${encodeURIComponent(appointment.date_of_birth)}` : ""}${appointment.gender ? `&gender=${encodeURIComponent(appointment.gender)}` : ""}`;

  return (
    <div>
      <PageHeader
        eyebrow={`${DEPARTMENTS[appointment.department]} appointment`}
        title={appointment.full_name}
        description={`Reference ${appointment.reference}`}
        breadcrumbs={[
          { label: "Appointments", href: "/staff/receptionist/appointments" },
          { label: appointment.reference },
        ]}
        actions={
          <Link href="/staff/receptionist/appointments" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to schedule
          </Link>
        }
      />
      <Flash error={flash.error} success={flash.success} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Appointment summary">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Status</dt>
                <dd className="mt-1"><StatusBadge status={appointment.status} /></dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Reference</dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-navy-900">{appointment.reference}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Date</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                  <CalendarClock className="h-4 w-4 text-teal-600" aria-hidden />
                  {formatDate(appointment.appointment_date, { weekday: "long" })}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Time</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-navy-900">
                  <Clock className="h-4 w-4 text-teal-600" aria-hidden />
                  {formatTime(appointment.appointment_time)} · {appointment.duration_minutes} min
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Clinician</dt>
                <dd className="mt-1 text-sm font-semibold text-navy-900">{appointment.doctor_name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Service</dt>
                <dd className="mt-1 text-sm font-semibold text-navy-900">{appointment.service_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Contact</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-700">
                  <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-navy-400" aria-hidden />{appointment.phone}</span>
                  {appointment.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-navy-400" aria-hidden />{appointment.email}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Source</dt>
                <dd className="mt-1 text-sm capitalize text-navy-700">{appointment.source.replaceAll("_", " ")} · {appointment.patient_type} patient</dd>
              </div>
            </dl>
            <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Reason for visit</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-navy-700">{appointment.reason}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Internal notes</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-navy-600">{appointment.notes || "No notes recorded."}</p>
              </div>
            </div>
          </Section>

          {patient ? (
            <Section
              title="Linked patient record"
              description="The appointment is matched to a shared master patient record."
              action={<Link href={`/staff/receptionist/patients/${patient.id}`} className="text-xs font-bold text-teal-700 hover:text-teal-900">Open patient →</Link>}
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Patient number</dt>
                  <dd className="mt-1 text-sm font-semibold text-navy-900">{patient.patient_number}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Full name</dt>
                  <dd className="mt-1 text-sm font-semibold text-navy-900">{patient.full_name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Phone</dt>
                  <dd className="mt-1 text-sm text-navy-700">{patient.phone}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Allergies</dt>
                  <dd className="mt-1 text-sm text-navy-700">{patient.allergies || "None recorded"}</dd>
                </div>
              </dl>
            </Section>
          ) : (
            <Section title="No patient record linked" description="Match this booking before check-in so the clinical team has a record to work from.">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-start gap-2 text-xs leading-5 text-amber-900">
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  We do not merge online bookings by phone number automatically. Confirm the patient&apos;s identity first.
                </p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-line p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><UserPlus className="h-4 w-4 text-teal-600" aria-hidden />Register as a new patient</p>
                  <p className="mt-1 text-xs leading-5 text-navy-500">The booking details will be pre-filled. Review them before saving.</p>
                  <Link href={registerHref} className="btn-primary mt-3 w-full">Register patient</Link>
                </div>
                <form action={linkExistingPatientToAppointmentAction} className="rounded-xl border border-line p-4">
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><Link2 className="h-4 w-4 text-sky-600" aria-hidden />Link an existing patient</p>
                  <p className="mt-1 text-xs leading-5 text-navy-500">Only links when exactly one patient matches the phone number.</p>
                  <label htmlFor="linkPhone" className="label mt-3">Patient phone number</label>
                  <input id="linkPhone" name="phone" className="input" placeholder="07xx xxx xxx" required />
                  <button type="submit" className="btn-secondary mt-2 w-full">Match and link</button>
                </form>
              </div>
            </Section>
          )}

          <Section title="Notification history" description="Messages queued for this appointment." bodyClassName="p-0">
            {notifications.length === 0 ? (
              <p className="px-5 py-6 text-xs text-navy-500">No notifications have been queued for this appointment.</p>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((notification) => (
                  <li key={notification.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {notification.channel === "email" ? <Mail className="h-4 w-4 text-sky-600" aria-hidden /> : <MessageSquare className="h-4 w-4 text-teal-600" aria-hidden />}
                      <div>
                        <p className="text-xs font-semibold capitalize text-navy-900">{notification.template.replaceAll("_", " ")} · {notification.channel}</p>
                        <p className="text-[10px] text-navy-400">{notification.recipient} · {formatDateTime(notification.created_at)}</p>
                        {notification.error && <p className="text-[10px] text-red-600">{notification.error}</p>}
                      </div>
                    </div>
                    <StatusBadge status={notification.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Audit trail" description="Accountability record for this appointment." bodyClassName="p-0">
            {audit.length === 0 ? (
              <p className="px-5 py-6 text-xs text-navy-500">No audit entries yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {audit.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <p className="text-xs font-semibold text-navy-800">{entry.action.replaceAll(".", " · ")}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-navy-500">{entry.details}</p>
                    <p className="mt-1 text-[10px] text-navy-400">{entry.actor_name || "Public"} · {formatDateTime(entry.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Update status" description="Front-desk actions are logged.">
            <div className="space-y-2">
              {appointment.status === "Booked" && (
                <form action={markConfirmedAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className="btn-secondary w-full"><CheckCircle2 className="h-4 w-4" aria-hidden /> Confirm appointment</button>
                </form>
              )}
              {["Booked", "Confirmed"].includes(appointment.status) && (
                <form action={checkInAppointmentAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className="btn-primary w-full"><CheckCircle2 className="h-4 w-4" aria-hidden /> Check in patient</button>
                </form>
              )}
              {appointment.status === "Checked In" && (
                <form action={markWaitingAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit" className="btn-teal w-full"><Clock className="h-4 w-4" aria-hidden /> Send to waiting queue</button>
                </form>
              )}
              {active && (
                <form action={markNoShowAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <ConfirmSubmit message="Mark this appointment as a no-show?" className="w-full">Mark no-show</ConfirmSubmit>
                </form>
              )}
              {active && (
                <form action={cancelAppointmentAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <ConfirmSubmit message="Cancel this appointment? The slot will be released." className="w-full !border-red-200 !text-red-700 hover:!bg-red-50" pendingText="Cancelling…">
                    <XCircle className="h-4 w-4" aria-hidden /> Cancel appointment
                  </ConfirmSubmit>
                </form>
              )}
              {!active && (
                <p className="rounded-xl border border-line bg-mist p-3 text-xs leading-5 text-navy-500">
                  This appointment is {appointment.status.toLowerCase()} and no longer accepts front-desk status changes.
                </p>
              )}
            </div>
          </Section>

          {active && (
            <Section title="Reschedule" description="Only available slots are shown.">
              <RescheduleForm appointment={appointment} today={clinicToday()} />
            </Section>
          )}

          <Section title="Communication">
            <form action={markReminderSentAction}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <button type="submit" className="btn-secondary w-full">
                <BellRing className="h-4 w-4" aria-hidden /> Queue SMS/email reminder
              </button>
            </form>
            <p className="mt-2 text-[11px] leading-5 text-navy-400">
              Messages are recorded even when a provider is not configured, so delivery can be audited and retried.
            </p>
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p><strong className="text-navy-700">Created:</strong> {formatDateTime(appointment.created_at)}</p>
            <p className="mt-1"><strong className="text-navy-700">Last updated:</strong> {formatDateTime(appointment.updated_at)}</p>
            {appointment.checked_in_at && <p className="mt-1"><strong className="text-navy-700">Checked in:</strong> {formatDateTime(appointment.checked_in_at)}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
