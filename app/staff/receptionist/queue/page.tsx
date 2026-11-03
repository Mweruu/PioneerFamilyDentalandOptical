import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  ListOrdered,
  Plus,
  Search,
  Stethoscope,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/staff/confirm-submit";
import { requireRole } from "@/lib/auth";
import {
  getDoctors,
  getInConsultation,
  getPatient,
  getWaitingPatients,
  listPatients,
  searchPatients,
} from "@/lib/data/queries";
import {
  cancelAppointmentAction,
  createWalkInAction,
  markNoShowAction,
  markWaitingAction,
} from "@/lib/actions/reception";
import { DEPARTMENTS, type Department } from "@/lib/types";
import { clinicToday, formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Today's Queue" };

type QueueAppointment = Awaited<ReturnType<typeof getWaitingPatients>>[number];

function QueueCard({
  appointment,
  department,
}: {
  appointment: QueueAppointment;
  department: Department;
}) {
  return (
    <li className="rounded-xl border border-line p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/staff/receptionist/appointments/${appointment.id}`}
            className="block truncate text-sm font-semibold text-navy-900 hover:text-teal-700"
          >
            {appointment.full_name}
          </Link>
          <p className="mt-0.5 text-[11px] text-navy-400">
            {appointment.patient_number || "No patient record"} · {formatTime(appointment.appointment_time)}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-navy-500">
        {department === "dental" ? <Stethoscope className="h-3.5 w-3.5 text-teal-600" aria-hidden /> : <Activity className="h-3.5 w-3.5 text-sky-600" aria-hidden />}
        {appointment.doctor_name}
        {appointment.checked_in_at ? ` · checked in ${formatTime(appointment.checked_in_at.slice(11, 16))}` : ""}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-navy-500">{appointment.reason}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {appointment.status === "Checked In" && (
          <form action={markWaitingAction}>
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <input type="hidden" name="returnTo" value="/staff/receptionist/queue" />
            <button type="submit" className="btn-teal !min-h-8 !px-2.5 !text-[11px]">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Send to queue
            </button>
          </form>
        )}
        {appointment.patient_id && (
          <Link href={`/staff/receptionist/patients/${appointment.patient_id}`} className="btn-secondary !min-h-8 !px-2.5 !text-[11px]">
            Patient record
          </Link>
        )}
        <form action={markNoShowAction}>
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <input type="hidden" name="returnTo" value="/staff/receptionist/queue" />
          <ConfirmSubmit message="Mark this patient as a no-show?" className="!min-h-8 !px-2.5 !text-[11px]">
            No-show
          </ConfirmSubmit>
        </form>
        <form action={cancelAppointmentAction}>
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <input type="hidden" name="returnTo" value="/staff/receptionist/queue" />
          <ConfirmSubmit message="Cancel this appointment? The slot will be released." className="!min-h-8 !border-red-200 !px-2.5 !text-[11px] !text-red-700 hover:!bg-red-50">
            Cancel
          </ConfirmSubmit>
        </form>
      </div>
    </li>
  );
}

function QueueColumn({
  department,
  waiting,
  inConsultation,
}: {
  department: Department;
  waiting: QueueAppointment[];
  inConsultation: Awaited<ReturnType<typeof getInConsultation>>;
}) {
  return (
    <Section
      title={`${DEPARTMENTS[department]} queue`}
      description={`${waiting.length} waiting · ${inConsultation.length} in consultation`}
      action={
        <Link href={`/staff/receptionist/queue?walkIn=${department}`} className="text-xs font-bold text-teal-700 hover:text-teal-900">
          Add walk-in →
        </Link>
      }
    >
      {waiting.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-7 text-center text-xs text-navy-500">
          Nobody is waiting for {department === "dental" ? "dental" : "optical"} care.
        </p>
      ) : (
        <ul className="space-y-3">
          {waiting.map((appointment) => (
            <QueueCard key={appointment.id} appointment={appointment} department={department} />
          ))}
        </ul>
      )}

      {inConsultation.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-navy-400">In consultation</p>
          <ul className="space-y-2">
            {inConsultation.map((appointment) => (
              <li key={appointment.id} className="flex items-center justify-between gap-2 rounded-lg bg-violet-50 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-navy-900">{appointment.full_name}</span>
                  <span className="block text-[10px] text-navy-500">{appointment.doctor_name}</span>
                </span>
                <StatusBadge status={appointment.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

export default async function ReceptionQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    walkIn?: string;
    patientId?: string;
    q?: string;
    error?: string;
    success?: string;
  }>;
}) {
  await requireRole("receptionist");
  const params = await searchParams;
  const today = clinicToday();
  const department: Department = params.walkIn === "optical" ? "optical" : "dental";
  const walkInOpen = params.walkIn === "dental" || params.walkIn === "optical";
  const selectedPatient = params.patientId ? await getPatient(params.patientId) : undefined;
  const search = params.q?.trim() ?? "";
  const patientResults = walkInOpen && !selectedPatient
    ? search
      ? await searchPatients(search)
      : await listPatients(8)
    : [];

  const dentalWaiting = await getWaitingPatients("dental");
  const opticalWaiting = await getWaitingPatients("optical");
  const dentalInConsultation = await getInConsultation("dental");
  const opticalInConsultation = await getInConsultation("optical");
  const doctors = await getDoctors();
  const departmentDoctors = doctors.filter((doctor) =>
    department === "dental" ? doctor.role === "dentist" : doctor.role === "eye_doctor",
  );

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(today, { weekday: "long" })}
        title="Today's queue"
        description="Check patients in, keep both clinical queues moving and add walk-in visits."
        actions={
          <>
            <Link href="/staff/receptionist/appointments" className="btn-secondary">
              <ListOrdered className="h-4 w-4" aria-hidden /> Today&apos;s schedule
            </Link>
            <Link href="/staff/receptionist/queue?walkIn=dental" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> Add walk-in
            </Link>
          </>
        }
      />
      <Flash error={params.error} success={params.success} />

      {walkInOpen && (
        <div className="mb-5 space-y-4">
          {!selectedPatient ? (
            <Section
              title={`Add a ${DEPARTMENTS[department].toLowerCase()} walk-in`}
              description="Search for a registered patient first. Register new patients from the patients page."
              action={<Link href="/staff/receptionist/queue" className="text-xs font-bold text-navy-500 hover:text-navy-800">Close</Link>}
            >
              <div className="mb-4 flex gap-2">
                {(["dental", "optical"] as Department[]).map((value) => (
                  <Link
                    key={value}
                    href={`/staff/receptionist/queue?walkIn=${value}`}
                    className={
                      value === department
                        ? "badge bg-navy-900 text-white ring-navy-900"
                        : "badge bg-white text-navy-600 ring-line"
                    }
                  >
                    {DEPARTMENTS[value]}
                  </Link>
                ))}
              </div>
              <form action="/staff/receptionist/queue" className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="walkIn" value={department} />
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
                  <input
                    type="search"
                    name="q"
                    defaultValue={search}
                    className="input !pl-9"
                    placeholder="Search by name, phone or patient number"
                    aria-label="Search patients for walk-in"
                  />
                </div>
                <button type="submit" className="btn-primary">
                  <Search className="h-4 w-4" aria-hidden /> Search
                </button>
              </form>

              <ul className="mt-4 divide-y divide-line">
                {patientResults.map((patient) => (
                  <li key={patient.id}>
                    <Link
                      href={`/staff/receptionist/queue?walkIn=${department}&patientId=${patient.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-navy-50/60"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-500">
                          <Users className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-navy-900">{patient.full_name}</span>
                          <span className="block text-[11px] text-navy-400">{patient.patient_number} · {patient.phone}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-teal-700">Select →</span>
                    </Link>
                  </li>
                ))}
                {!patientResults.length && (
                  <li className="py-8 text-center text-xs text-navy-500">
                    No patients match that search.{" "}
                    <Link href="/staff/receptionist/patients/new" className="font-bold text-teal-700">Register a new patient</Link>.
                  </li>
                )}
              </ul>
            </Section>
          ) : (
            <>
              <PatientBanner
                patient={selectedPatient}
                actions={<Link href={`/staff/receptionist/queue?walkIn=${department}`} className="btn-secondary">Change patient</Link>}
              />
              <Section
                title={`Add ${selectedPatient.full_name} to the ${department} queue`}
                description="Walk-ins are checked in immediately and sent to the clinician's waiting list."
              >
                <form action={createWalkInAction} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="patientId" value={selectedPatient.id} />
                  <input type="hidden" name="department" value={department} />
                  <input type="hidden" name="returnTo" value="/staff/receptionist/queue" />
                  <div className="sm:col-span-2">
                    <label htmlFor="walkInDoctor" className="label">Clinician *</label>
                    <select id="walkInDoctor" name="doctorId" className="select" required>
                      <option value="">Select a clinician</option>
                      {departmentDoctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-navy-400">Only clinicians scheduled for today are accepted.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="walkInReason" className="label">Reason for visit *</label>
                    <input id="walkInReason" name="reason" className="input" placeholder="e.g. Severe toothache on the lower left side" required />
                  </div>
                  <div className="sm:col-span-2">
                    <SubmitButton pendingText="Adding to queue…">
                      <UserPlus className="h-4 w-4" aria-hidden /> Add to {department} queue
                    </SubmitButton>
                  </div>
                </form>
              </Section>
            </>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <QueueColumn department="dental" waiting={dentalWaiting} inConsultation={dentalInConsultation} />
        <QueueColumn department="optical" waiting={opticalWaiting} inConsultation={opticalInConsultation} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock className="h-5 w-5" aria-hidden /></span>
          <span>
            <span className="block text-sm font-semibold text-navy-900">{dentalWaiting.length + opticalWaiting.length} waiting</span>
            <span className="block text-[11px] text-navy-400">Across both departments</span>
          </span>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Activity className="h-5 w-5" aria-hidden /></span>
          <span>
            <span className="block text-sm font-semibold text-navy-900">{dentalInConsultation.length + opticalInConsultation.length} in consultation</span>
            <span className="block text-[11px] text-navy-400">Currently with a clinician</span>
          </span>
        </div>
        <Link href="/staff/receptionist/appointments" className="card flex items-center gap-3 p-4 transition hover:border-navy-200 hover:shadow-lift">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><CheckCircle2 className="h-5 w-5" aria-hidden /></span>
          <span>
            <span className="block text-sm font-semibold text-navy-900">Check in appointments</span>
            <span className="block text-[11px] text-navy-400">Open today&apos;s schedule</span>
          </span>
          <ArrowRight className="ml-auto h-4 w-4 text-navy-300" aria-hidden />
        </Link>
      </div>

      <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-navy-400">
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-300" aria-hidden />
        Cancelling or marking a no-show releases the appointment slot. All queue actions are written to the audit log.
      </p>
    </div>
  );
}
