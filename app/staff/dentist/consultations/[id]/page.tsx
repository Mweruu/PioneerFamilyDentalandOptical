import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Save,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { DentalChartEditor } from "@/components/staff/dental-chart-editor";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/staff/confirm-submit";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getAppointmentForVisit,
  getDentalVisit,
  getLatestVitals,
  getPatient,
  getToothFindings,
  getTreatmentPlans,
  getVisit,
} from "@/lib/data/queries";
import { completeDentalConsultationAction, saveDentalVisitAction, saveTreatmentPlanAction } from "@/lib/actions/dental";
import { clinicToday, formatDate, formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dental Consultation" };

export default async function DentalConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("dentist");
  const { id } = await params;
  const flash = await searchParams;
  const dentalVisit = getDentalVisit(id);
  if (!dentalVisit) notFound();
  if (dentalVisit.doctor_id !== user.id) {
    redirect(`/staff/dentist/patients/${dentalVisit.patient_id}?error=${encodeURIComponent("You can only edit dental records you created.")}`);
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.view",
    entityType: "dental_record",
    entityId: dentalVisit.id,
    patientId: dentalVisit.patient_id,
    details: "Opened dental consultation record.",
  });

  const patient = getPatient(dentalVisit.patient_id);
  if (!patient) notFound();
  const visit = dentalVisit.visit_id ? getVisit(dentalVisit.visit_id) : undefined;
  const appointment = dentalVisit.visit_id ? getAppointmentForVisit(dentalVisit.visit_id) : undefined;
  const vitals = getLatestVitals(patient.id);
  const findings = getToothFindings(patient.id, dentalVisit.id);
  const plans = getTreatmentPlans(patient.id).filter((plan) => plan.dental_visit_id === dentalVisit.id);
  const returnTo = `/staff/dentist/consultations/${dentalVisit.id}`;
  const completed = visit?.status === "Completed";

  return (
    <div>
      <PageHeader
        eyebrow="Dental consultation"
        title={patient.full_name}
        description={`Visit ${formatDate(dentalVisit.visit_date)} · ${dentalVisit.doctor_name || user.name}`}
        breadcrumbs={[
          { label: "Dental patients", href: "/staff/dentist/patients" },
          { label: patient.full_name, href: `/staff/dentist/patients/${patient.id}` },
          { label: "Consultation" },
        ]}
        actions={
          <>
            <Link href={`/staff/dentist/patients/${patient.id}`} className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Patient card</Link>
            {!completed && (
              <form action={completeDentalConsultationAction}>
                <input type="hidden" name="dentalVisitId" value={dentalVisit.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmit message="Complete this consultation? The appointment will be marked completed and the record will remain editable by you." pendingText="Completing…">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Complete consultation
                </ConfirmSubmit>
              </form>
            )}
          </>
        }
      />
      <Flash error={flash.error} success={flash.success} />

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
        <StatusBadge status={completed ? "Completed" : "In Consultation"} />
        <span className="text-xs text-navy-500">Started {formatDateTime(visit?.started_at || dentalVisit.created_at)}</span>
        {appointment && (
          <span className="text-xs text-navy-500">
            · {appointment.reference} · {formatTime(appointment.appointment_time)} · {appointment.service_name || "Dental visit"}
          </span>
        )}
        {completed && <span className="ml-auto text-[11px] font-semibold text-emerald-700">Completed {formatDateTime(visit?.completed_at)}</span>}
      </div>

      <div className="mb-5">
        <PatientBanner patient={patient} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Clinical notes" description="Document history, examination, diagnosis and treatment.">
            <form action={saveDentalVisitAction} className="space-y-4">
              <input type="hidden" name="dentalVisitId" value={dentalVisit.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="presentingComplaint" className="label">Presenting complaint</label>
                  <textarea id="presentingComplaint" name="presentingComplaint" className="textarea" defaultValue={dentalVisit.presenting_complaint ?? ""} />
                </div>
                <div>
                  <label htmlFor="history" className="label">History of presenting complaint</label>
                  <textarea id="history" name="history" className="textarea" defaultValue={dentalVisit.history ?? ""} />
                </div>
                <div>
                  <label htmlFor="examinationFindings" className="label">Examination findings</label>
                  <textarea id="examinationFindings" name="examinationFindings" className="textarea" defaultValue={dentalVisit.examination_findings ?? ""} />
                </div>
                <div>
                  <label htmlFor="diagnosis" className="label">Diagnosis</label>
                  <textarea id="diagnosis" name="diagnosis" className="textarea" defaultValue={dentalVisit.diagnosis ?? ""} />
                </div>
                <div>
                  <label htmlFor="treatmentPerformed" className="label">Treatment performed</label>
                  <textarea id="treatmentPerformed" name="treatmentPerformed" className="textarea" defaultValue={dentalVisit.treatment_performed ?? ""} />
                </div>
                <div>
                  <label htmlFor="medications" className="label">Medications prescribed</label>
                  <textarea id="medications" name="medications" className="textarea" defaultValue={dentalVisit.medications ?? ""} />
                </div>
                <div>
                  <label htmlFor="advice" className="label">Advice given</label>
                  <textarea id="advice" name="advice" className="textarea" defaultValue={dentalVisit.advice ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="followUp" className="label">Follow-up instructions</label>
                  <textarea id="followUp" name="followUp" className="textarea" defaultValue={dentalVisit.follow_up ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="visitNotes" className="label">Internal notes</label>
                  <textarea id="visitNotes" name="notes" className="textarea" defaultValue={dentalVisit.notes ?? ""} />
                </div>
              </div>
              <SubmitButton pendingText="Saving notes…"><Save className="h-4 w-4" aria-hidden /> Save clinical notes</SubmitButton>
            </form>
          </Section>

          <Section title="Tooth chart and findings" description="Record findings using FDI permanent and primary tooth notation.">
            <DentalChartEditor dentalVisitId={dentalVisit.id} findings={findings} returnTo={returnTo} />
          </Section>

          <Section title="Treatment plans for this visit" description="Plans created during this consultation." bodyClassName="p-0">
            {plans.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No treatment plan recorded for this visit yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {plans.map((plan) => (
                  <li key={plan.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{plan.procedure}</p>
                        <p className="mt-0.5 text-[11px] text-navy-400">Tooth {plan.tooth_numbers || "—"} · {plan.diagnosis}</p>
                        <p className="mt-1 text-[11px] text-navy-500">Review {formatDate(plan.next_review_date)}</p>
                      </div>
                      <div className="flex gap-2"><StatusBadge status={plan.priority} /><StatusBadge status={plan.status} /></div>
                    </div>
                    {plan.notes && <p className="mt-2 text-[11px] leading-5 text-navy-500">{plan.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Add treatment plan" description="Plan follow-on dental work.">
            <form action={saveTreatmentPlanAction} className="space-y-3">
              <input type="hidden" name="patientId" value={patient.id} />
              <input type="hidden" name="dentalVisitId" value={dentalVisit.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="consultTeeth" className="label">Tooth numbers</label>
                  <input id="consultTeeth" name="toothNumbers" className="input" placeholder="36, 46" />
                </div>
                <div>
                  <label htmlFor="consultPriority" className="label">Priority</label>
                  <select id="consultPriority" name="priority" className="select" defaultValue="Medium">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="consultDiagnosis" className="label">Diagnosis *</label>
                <input id="consultDiagnosis" name="diagnosis" className="input" required />
              </div>
              <div>
                <label htmlFor="consultProcedure" className="label">Procedure *</label>
                <input id="consultProcedure" name="procedure" className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="consultCost" className="label">Cost (KES)</label>
                  <input id="consultCost" name="estimatedCost" type="number" min={0} className="input" />
                </div>
                <div>
                  <label htmlFor="consultReview" className="label">Review date</label>
                  <input id="consultReview" name="nextReviewDate" type="date" min={clinicToday()} className="input" />
                </div>
              </div>
              <div>
                <label htmlFor="consultStatus" className="label">Status</label>
                <select id="consultStatus" name="status" className="select" defaultValue="Planned">
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label htmlFor="consultNotes" className="label">Notes</label>
                <textarea id="consultNotes" name="notes" className="textarea !min-h-20" />
              </div>
              <SubmitButton className="w-full" pendingText="Saving plan…"><ClipboardList className="h-4 w-4" aria-hidden /> Add plan</SubmitButton>
            </form>
          </Section>

          <Section title="Latest vitals" description="Triage recorded by reception.">
            {vitals ? (
              <div className="space-y-1.5 text-[11px] text-navy-600">
                <p><strong className="text-navy-800">BP:</strong> {vitals.bp_systolic && vitals.bp_diastolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg` : "—"}</p>
                <p><strong className="text-navy-800">Pulse:</strong> {vitals.pulse ? `${vitals.pulse} bpm` : "—"}</p>
                <p><strong className="text-navy-800">Temp:</strong> {vitals.temperature_c ? `${vitals.temperature_c} °C` : "—"}</p>
                <p><strong className="text-navy-800">SpO₂:</strong> {vitals.spo2 ? `${vitals.spo2}%` : "—"}</p>
                <p><strong className="text-navy-800">Weight / BMI:</strong> {vitals.weight_kg ? `${vitals.weight_kg} kg` : "—"}{vitals.bmi ? ` · BMI ${vitals.bmi}` : ""}</p>
                <p className="text-navy-400">Recorded {formatDateTime(vitals.recorded_at)}</p>
              </div>
            ) : (
              <p className="text-xs text-navy-500">No vitals recorded for this patient.</p>
            )}
          </Section>

          <Section title="Medical safety" description="Check before prescribing or treatment.">
            <div className="space-y-2 text-[11px] leading-5 text-navy-600">
              <p><strong className="text-navy-800">Allergies:</strong> {patient.allergies || "None recorded"}</p>
              <p><strong className="text-navy-800">Conditions:</strong> {patient.conditions || "None recorded"}</p>
              <p><strong className="text-navy-800">Medications:</strong> {patient.medications || "None recorded"}</p>
              <p><strong className="text-navy-800">History:</strong> {patient.medical_history || "None recorded"}</p>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-navy-400">
              <HeartPulse className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" aria-hidden />
              Verify allergy status directly with the patient when prescribing.
            </p>
          </Section>

          {appointment && (
            <Section title="Appointment">
              <p className="text-xs text-navy-600">{appointment.reference}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-500"><CalendarDays className="h-3.5 w-3.5 text-navy-400" aria-hidden /> {formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-500"><UserRound className="h-3.5 w-3.5 text-navy-400" aria-hidden /> {appointment.doctor_name}</p>
              <Link href={`/staff/dentist/patients/${patient.id}`} className="btn-secondary mt-3 w-full"><Stethoscope className="h-4 w-4" aria-hidden /> Full dental history</Link>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
