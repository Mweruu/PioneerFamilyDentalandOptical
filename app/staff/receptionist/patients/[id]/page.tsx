import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  HeartPulse,
  Pencil,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { AppointmentTable } from "@/components/staff/appointment-table";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import {
  getActiveVisit,
  getAppointmentsForPatient,
  getPatient,
  getVitalsForPatient,
  getVisitsForPatient,
} from "@/lib/data/queries";
import { addPatientNoteAction, recordVitalsAction, updatePatientAction } from "@/lib/actions/reception";
import { ageFromDob, formatDate, formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Patient Record" };

export default async function ReceptionPatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole("receptionist");
  const { id } = await params;
  const flash = await searchParams;
  const patient = getPatient(id);
  if (!patient) notFound();

  const appointments = getAppointmentsForPatient(patient.id);
  const vitals = getVitalsForPatient(patient.id);
  const visits = getVisitsForPatient(patient.id);
  const activeVisits = [
    { department: "dental" as const, visit: getActiveVisit(patient.id, "dental") },
    { department: "optical" as const, visit: getActiveVisit(patient.id, "optical") },
  ].filter((entry) => entry.visit);
  const activeVisitIds = new Set(activeVisits.map((entry) => entry.visit?.id));
  const recentVisits = visits.slice(0, 8);
  const age = ageFromDob(patient.date_of_birth);
  const returnTo = `/staff/receptionist/patients/${patient.id}`;

  return (
    <div>
      <PageHeader
        eyebrow="Master patient record"
        title={patient.full_name}
        description={`${patient.patient_number} · registered ${formatDate(patient.created_at)}`}
        breadcrumbs={[
          { label: "Patients", href: "/staff/receptionist/patients" },
          { label: patient.full_name },
        ]}
        actions={
          <>
            <Link href="/staff/receptionist/patients" className="btn-secondary">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to patients
            </Link>
            <Link href={`/staff/receptionist/appointments/new?patientId=${patient.id}`} className="btn-primary">
              <CalendarPlus className="h-4 w-4" aria-hidden /> Book appointment
            </Link>
          </>
        }
      />
      <Flash error={flash.error} success={flash.success} />

      <PatientBanner
        patient={patient}
        actions={
          <Link href={`/staff/receptionist/appointments/new?patientId=${patient.id}`} className="btn-teal">
            <CalendarPlus className="h-4 w-4" aria-hidden /> New appointment
          </Link>
        }
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section
            title="Appointment history"
            description="All dental and optical bookings linked to this patient."
            action={<Link href={`/staff/receptionist/appointments/new?patientId=${patient.id}`} className="text-xs font-bold text-teal-700 hover:text-teal-900">Book new →</Link>}
            bodyClassName="p-0"
          >
            <AppointmentTable
              appointments={appointments.slice(0, 20)}
              basePath="/staff/receptionist/appointments"
              showDate
              emptyMessage="No appointments have been booked for this patient yet."
            />
          </Section>

          <Section
            title="Vitals history"
            description="Recorded at the front desk and shared with the clinical team."
            bodyClassName="p-0"
          >
            {vitals.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No vitals have been recorded for this patient.</p>
            ) : (
              <div className="table-wrap !rounded-none !border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Recorded</th>
                      <th>BP</th>
                      <th>Pulse</th>
                      <th>Temp</th>
                      <th>SpO₂</th>
                      <th>Weight / BMI</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.slice(0, 12).map((vital) => (
                      <tr key={vital.id}>
                        <td className="text-xs">{formatDateTime(vital.recorded_at)}</td>
                        <td className="text-xs">{vital.bp_systolic && vital.bp_diastolic ? `${vital.bp_systolic}/${vital.bp_diastolic}` : "—"}</td>
                        <td className="text-xs">{vital.pulse ?? "—"}</td>
                        <td className="text-xs">{vital.temperature_c ? `${vital.temperature_c} °C` : "—"}</td>
                        <td className="text-xs">{vital.spo2 ? `${vital.spo2}%` : "—"}</td>
                        <td className="text-xs">
                          {vital.weight_kg ? `${vital.weight_kg} kg` : "—"}
                          {vital.bmi ? ` · BMI ${vital.bmi}` : ""}
                        </td>
                        <td className="text-xs">{vital.recorded_by_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {vitals[0]?.observations && (
              <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-navy-500">
                <strong className="text-navy-700">Latest observation:</strong> {vitals[0].observations}
              </p>
            )}
          </Section>

          <Section title="Master record details" description="Shared by dental and optical teams. Update only verified information.">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Phone</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm text-navy-800"><Phone className="h-3.5 w-3.5 text-navy-400" aria-hidden />{patient.phone}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Email</dt>
                <dd className="mt-1 text-sm text-navy-800">{patient.email || "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Date of birth / age</dt>
                <dd className="mt-1 text-sm text-navy-800">{formatDate(patient.date_of_birth)}{age !== null ? ` · ${age} years` : ""}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Gender</dt>
                <dd className="mt-1 text-sm text-navy-800">{patient.gender || "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Address</dt>
                <dd className="mt-1 text-sm text-navy-800">{patient.address || "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Emergency contact</dt>
                <dd className="mt-1 text-sm text-navy-800">
                  {patient.emergency_contact_name || "Not recorded"}
                  {patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Medical safety information</dt>
                <dd className="mt-1 grid gap-2 text-xs leading-5 text-navy-700 sm:grid-cols-2">
                  <p><strong className="text-navy-900">Allergies:</strong> {patient.allergies || "None recorded"}</p>
                  <p><strong className="text-navy-900">Conditions:</strong> {patient.conditions || "None recorded"}</p>
                  <p><strong className="text-navy-900">Medications:</strong> {patient.medications || "None recorded"}</p>
                  <p><strong className="text-navy-900">History:</strong> {patient.medical_history || "None recorded"}</p>
                </dd>
              </div>
            </dl>

            <details className="mt-5 rounded-xl border border-line bg-mist p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-navy-800">
                <Pencil className="h-3.5 w-3.5 text-teal-600" aria-hidden /> Edit master record
              </summary>
              <form action={updatePatientAction} className="mt-4 space-y-4">
                <input type="hidden" name="patientId" value={patient.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="editFullName" className="label">Full name *</label>
                    <input id="editFullName" name="fullName" className="input" defaultValue={patient.full_name} required />
                  </div>
                  <div>
                    <label htmlFor="editPhone" className="label">Phone number *</label>
                    <input id="editPhone" name="phone" type="tel" className="input" defaultValue={patient.phone} required />
                  </div>
                    <div>
                    <label htmlFor="editEmail" className="label">Email address</label>
                    <input id="editEmail" name="email" type="email" className="input" defaultValue={patient.email ?? ""} />
                  </div>
                  <div>
                    <label htmlFor="editDob" className="label">Date of birth</label>
                    <input id="editDob" name="dateOfBirth" type="date" className="input" defaultValue={patient.date_of_birth ?? ""} />
                  </div>
                  <div>
                    <label htmlFor="editGender" className="label">Gender</label>
                    <select id="editGender" name="gender" className="select" defaultValue={patient.gender ?? ""}>
                      <option value="">Not recorded</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Intersex</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="editAddress" className="label">Home address</label>
                    <input id="editAddress" name="address" className="input" defaultValue={patient.address ?? ""} />
                  </div>
                  <div>
                    <label htmlFor="editEmergencyName" className="label">Emergency contact name</label>
                    <input id="editEmergencyName" name="emergencyContactName" className="input" defaultValue={patient.emergency_contact_name ?? ""} />
                  </div>
                  <div>
                    <label htmlFor="editEmergencyPhone" className="label">Emergency contact phone</label>
                    <input id="editEmergencyPhone" name="emergencyContactPhone" type="tel" className="input" defaultValue={patient.emergency_contact_phone ?? ""} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="editAllergies" className="label">Allergies</label>
                    <input id="editAllergies" name="allergies" className="input" defaultValue={patient.allergies ?? ""} />
                  </div>
                  <div>
                    <label htmlFor="editConditions" className="label">Existing conditions</label>
                    <textarea id="editConditions" name="conditions" className="textarea" defaultValue={patient.conditions ?? ""} />
                  </div>
                  <div>
                    <label htmlFor="editMedications" className="label">Current medications</label>
                    <textarea id="editMedications" name="medications" className="textarea" defaultValue={patient.medications ?? ""} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="editHistory" className="label">Relevant medical history</label>
                    <textarea id="editHistory" name="medicalHistory" className="textarea" defaultValue={patient.medical_history ?? ""} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="editNotes" className="label">Front-desk notes</label>
                    <textarea id="editNotes" name="adminNotes" className="textarea" defaultValue={patient.admin_notes ?? ""} />
                  </div>
                </div>
                <SubmitButton pendingText="Saving…">Save patient record</SubmitButton>
              </form>
            </details>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Current visits" description="Active dental or optical episodes.">
            {activeVisits.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-6 text-center text-xs text-navy-500">
                No active clinical visit. Check the patient in from an appointment or add a walk-in.
              </p>
            ) : (
              <ul className="space-y-3">
                {activeVisits.map(({ department, visit }) => (
                  <li key={department} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-xs font-bold text-navy-900">
                        {department === "dental" ? <Stethoscope className="h-4 w-4 text-teal-600" aria-hidden /> : <Activity className="h-4 w-4 text-sky-600" aria-hidden />}
                        {department === "dental" ? "Dental" : "Optical"}
                      </p>
                      <StatusBadge status={visit!.status} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-navy-500">
                      {visit!.doctor_name || "Clinician not assigned"} · started {formatDateTime(visit!.started_at || visit!.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/staff/receptionist/queue" className="btn-secondary mt-4 w-full">Open today&apos;s queue</Link>
          </Section>

          <Section title="Record vitals" description="All values are optional; BMI is calculated automatically.">
            <form action={recordVitalsAction} className="space-y-3">
              <input type="hidden" name="patientId" value={patient.id} />
              {activeVisitIds.size > 0 && (
                <div>
                  <label htmlFor="vitalsVisit" className="label">Link to active visit</label>
                  <select id="vitalsVisit" name="visitId" className="select" defaultValue="">
                    <option value="">Automatic</option>
                    {activeVisits.map(({ department, visit }) => (
                      <option key={visit!.id} value={visit!.id}>{department === "dental" ? "Dental" : "Optical"} · {visit!.doctor_name || "Clinician"}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bpSystolic" className="label">BP systolic</label>
                  <input id="bpSystolic" name="bpSystolic" type="number" min={40} max={300} className="input" placeholder="120" />
                </div>
                <div>
                  <label htmlFor="bpDiastolic" className="label">BP diastolic</label>
                  <input id="bpDiastolic" name="bpDiastolic" type="number" min={20} max={200} className="input" placeholder="80" />
                </div>
                <div>
                  <label htmlFor="pulse" className="label">Pulse (bpm)</label>
                  <input id="pulse" name="pulse" type="number" min={20} max={250} className="input" placeholder="72" />
                </div>
                <div>
                  <label htmlFor="temperatureC" className="label">Temp (°C)</label>
                  <input id="temperatureC" name="temperatureC" type="number" step="0.1" min={30} max={45} className="input" placeholder="36.6" />
                </div>
                <div>
                  <label htmlFor="respiratoryRate" className="label">Resp. rate</label>
                  <input id="respiratoryRate" name="respiratoryRate" type="number" min={5} max={80} className="input" placeholder="16" />
                </div>
                <div>
                  <label htmlFor="spo2" className="label">SpO₂ (%)</label>
                  <input id="spo2" name="spo2" type="number" min={50} max={100} className="input" placeholder="98" />
                </div>
                <div>
                  <label htmlFor="weightKg" className="label">Weight (kg)</label>
                  <input id="weightKg" name="weightKg" type="number" step="0.1" min={1} max={500} className="input" placeholder="68" />
                </div>
                <div>
                  <label htmlFor="heightCm" className="label">Height (cm)</label>
                  <input id="heightCm" name="heightCm" type="number" step="0.1" min={30} max={250} className="input" placeholder="164" />
                </div>
              </div>
              <div>
                <label htmlFor="observations" className="label">Observations</label>
                <textarea id="observations" name="observations" className="textarea !min-h-20" placeholder="Any relevant front-desk observations" />
              </div>
              <SubmitButton className="w-full" pendingText="Recording…">
                <HeartPulse className="h-4 w-4" aria-hidden /> Save vitals
              </SubmitButton>
            </form>
          </Section>

          <Section title="Front-desk note" description="Administrative note only. Clinical notes stay in the clinical record.">
            <form action={addPatientNoteAction} className="space-y-3">
              <input type="hidden" name="patientId" value={patient.id} />
              <label htmlFor="adminNote" className="sr-only">Front-desk note</label>
              <textarea
                id="adminNote"
                name="adminNotes"
                className="textarea"
                defaultValue={patient.admin_notes ?? ""}
                placeholder="Accessibility needs, preferred language, or communication notes"
              />
              <SubmitButton className="w-full" pendingText="Saving…">
                <ClipboardList className="h-4 w-4" aria-hidden /> Save front-desk note
              </SubmitButton>
            </form>
          </Section>

          <Section title="Visit history" description="Recent front-desk and clinical episodes.">
            {recentVisits.length === 0 ? (
              <p className="text-xs text-navy-500">No visits recorded yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {recentVisits.map((visit) => (
                  <li key={visit.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold capitalize text-navy-900">{visit.department}</p>
                      <p className="text-[10px] text-navy-400">{visit.doctor_name || "Unassigned"} · {formatDate(visit.created_at)} {formatTime(visit.started_at?.slice(11, 16))}</p>
                    </div>
                    <StatusBadge status={visit.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
              This master record is shared between departments. Clinical findings are only visible inside the dental and optical workspaces.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-navy-400">
              <UserRound className="h-3.5 w-3.5" aria-hidden /> Last updated {formatDateTime(patient.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
