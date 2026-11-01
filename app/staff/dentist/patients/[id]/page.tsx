import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  FileText,
  HeartPulse,
  Play,
  Plus,
  Smile,
  Stethoscope,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { ToothChartGrid, ToothLegend } from "@/components/staff/tooth-chart-grid";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getActiveVisit,
  getDentalVisits,
  getLatestVitals,
  getPatient,
  getToothFindings,
  getTreatmentPlans,
  getUpcomingAppointmentsForPatient,
} from "@/lib/data/queries";
import { saveTreatmentPlanAction, startDentalForPatientAction, updateTreatmentPlanStatusAction } from "@/lib/actions/dental";
import type { ToothFinding } from "@/lib/types";
import { formatKes } from "@/lib/format";
import { clinicToday, formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dental Patient Card" };

export default async function DentistPatientCard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("dentist");
  const { id } = await params;
  const flash = await searchParams;
  const patient = getPatient(id);
  if (!patient) notFound();

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.view",
    entityType: "dental_record",
    entityId: patient.id,
    patientId: patient.id,
    details: `Viewed dental patient card for ${patient.patient_number}.`,
  });

  const dentalVisits = getDentalVisits(patient.id);
  const toothFindings = getToothFindings(patient.id);
  const treatmentPlans = getTreatmentPlans(patient.id);
  const upcoming = getUpcomingAppointmentsForPatient(patient.id).filter((appointment) => appointment.department === "dental");
  const vitals = getLatestVitals(patient.id);
  const activeVisit = getActiveVisit(patient.id, "dental");
  const activeDentalVisit = activeVisit ? dentalVisits.find((visit) => visit.visit_id === activeVisit.id) : undefined;

  const latestByTooth = new Map<string, ToothFinding>();
  for (const finding of [...toothFindings].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const key = `${finding.dentition}:${finding.tooth_number}`;
    if (!latestByTooth.has(key)) latestByTooth.set(key, finding);
  }
  const chartFindings = [...latestByTooth.values()];
  const permanentFindings = chartFindings.filter((finding) => finding.dentition === "permanent");
  const primaryFindings = chartFindings.filter((finding) => finding.dentition === "primary");
  const openPlans = treatmentPlans.filter((plan) => plan.status === "Planned" || plan.status === "In Progress");

  return (
    <div>
      <PageHeader
        eyebrow="Dental patient card"
        title={patient.full_name}
        description={`${patient.patient_number} · dental record and treatment history`}
        breadcrumbs={[
          { label: "Dental patients", href: "/staff/dentist/patients" },
          { label: patient.full_name },
        ]}
        actions={
          <>
            <Link href="/staff/dentist/patients" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to patients</Link>
            {activeDentalVisit ? (
              <Link href={`/staff/dentist/consultations/${activeDentalVisit.id}`} className="btn-primary"><Stethoscope className="h-4 w-4" aria-hidden /> Continue consultation</Link>
            ) : (
              <form action={startDentalForPatientAction}>
                <input type="hidden" name="patientId" value={patient.id} />
                <input type="hidden" name="returnTo" value={`/staff/dentist/patients/${patient.id}`} />
                <SubmitButton pendingText="Starting…"><Play className="h-4 w-4" aria-hidden /> Start dental record</SubmitButton>
              </form>
            )}
          </>
        }
      />
      <Flash error={flash.error} success={flash.success} />

      <PatientBanner patient={patient} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section
            title="FDI tooth chart"
            description="Latest recorded finding for each tooth across all dental visits."
            action={<Link href="/staff/dentist/chart" className="text-xs font-bold text-teal-700 hover:text-teal-900">Chart guide →</Link>}
          >
            <div className="space-y-4">
              <ToothChartGrid findings={permanentFindings} dentition="permanent" />
              <ToothChartGrid findings={primaryFindings} dentition="primary" />
              <ToothLegend />
            </div>
          </Section>

          <Section title="Treatment plans" description="Planned and completed procedures for this patient." bodyClassName="p-0">
            {treatmentPlans.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No treatment plans have been recorded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {treatmentPlans.map((plan) => (
                  <li key={plan.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-900">{plan.procedure}</p>
                        <p className="mt-0.5 text-[11px] text-navy-400">
                          Tooth {plan.tooth_numbers || "—"} · {plan.diagnosis} · {formatKes(plan.estimated_cost)}
                        </p>
                        <p className="mt-1 text-[11px] text-navy-500">
                          Review {formatDate(plan.next_review_date)} · created {formatDate(plan.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={plan.priority} />
                        <StatusBadge status={plan.status} />
                      </div>
                    </div>
                    {plan.notes && <p className="mt-2 text-[11px] leading-5 text-navy-500">{plan.notes}</p>}
                    {plan.created_by === user.id && plan.status !== "Completed" && plan.status !== "Cancelled" && (
                      <form action={updateTreatmentPlanStatusAction} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="planId" value={plan.id} />
                        <div>
                          <label htmlFor={`planStatus-${plan.id}`} className="label !mb-1 !text-[10px]">Update status</label>
                          <select id={`planStatus-${plan.id}`} name="status" className="select !py-1.5 !text-xs" defaultValue={plan.status}>
                            <option value="Planned">Planned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                        <button type="submit" className="btn-secondary !min-h-8 !px-2.5 !text-[11px]">Save status</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Dental visit history" description="Clinical notes from previous dental consultations." bodyClassName="p-0">
            {dentalVisits.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No dental consultations recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {dentalVisits.map((visit) => (
                  <li key={visit.id} className="px-5 py-4">
                    <details>
                      <summary className="cursor-pointer">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="block text-sm font-semibold text-navy-900">{formatDate(visit.visit_date)}</span>
                            <span className="block text-[11px] text-navy-400">{visit.doctor_name || "Clinician"} · {visit.diagnosis || "No diagnosis recorded"}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <StatusBadge status={visit.visit_id ? "Completed" : "In Progress"} />
                            <FileText className="h-4 w-4 text-navy-300" aria-hidden />
                          </span>
                        </span>
                      </summary>
                      <div className="mt-3 grid gap-3 rounded-xl bg-mist p-3 text-[11px] leading-5 text-navy-600 sm:grid-cols-2">
                        <p><strong className="text-navy-800">Complaint:</strong> {visit.presenting_complaint || "—"}</p>
                        <p><strong className="text-navy-800">Examination:</strong> {visit.examination_findings || "—"}</p>
                        <p><strong className="text-navy-800">Treatment:</strong> {visit.treatment_performed || "—"}</p>
                        <p><strong className="text-navy-800">Medication:</strong> {visit.medications || "—"}</p>
                        <p className="sm:col-span-2"><strong className="text-navy-800">Advice:</strong> {visit.advice || "—"}</p>
                        <p className="sm:col-span-2"><strong className="text-navy-800">Follow-up:</strong> {visit.follow_up || "—"}</p>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Tooth findings" description="Detailed record of every tooth finding." bodyClassName="p-0">
            {toothFindings.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No tooth findings recorded.</p>
            ) : (
              <div className="table-wrap !rounded-none !border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tooth</th>
                      <th>Condition</th>
                      <th>Status</th>
                      <th>Planned / performed</th>
                      <th>Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toothFindings.map((finding) => (
                      <tr key={finding.id}>
                        <td className="font-mono text-xs font-semibold">{finding.tooth_number}</td>
                        <td className="text-xs">{finding.condition}</td>
                        <td><StatusBadge status={finding.status} /></td>
                        <td className="max-w-[220px] whitespace-normal text-xs">
                          {finding.planned_treatment || "—"}
                          {finding.treatment_performed ? ` · ${finding.treatment_performed}` : ""}
                        </td>
                        <td className="text-[11px] text-navy-400">{formatDate(finding.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="New treatment plan" description="Add a plan for this patient.">
            <form action={saveTreatmentPlanAction} className="space-y-3">
              <input type="hidden" name="patientId" value={patient.id} />
              <div>
                <label htmlFor="planVisit" className="label">Linked visit</label>
                <select id="planVisit" name="dentalVisitId" className="select" defaultValue={activeDentalVisit?.id ?? ""}>
                  <option value="">Standalone plan</option>
                  {dentalVisits.map((visit) => (
                    <option key={visit.id} value={visit.id}>{formatDate(visit.visit_date)} · {visit.diagnosis || "Dental visit"}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="planTeeth" className="label">Tooth numbers</label>
                  <input id="planTeeth" name="toothNumbers" className="input" placeholder="e.g. 36, 46" />
                </div>
                <div>
                  <label htmlFor="planPriority" className="label">Priority</label>
                  <select id="planPriority" name="priority" className="select" defaultValue="Medium">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="planDiagnosis" className="label">Diagnosis *</label>
                <input id="planDiagnosis" name="diagnosis" className="input" required />
              </div>
              <div>
                <label htmlFor="planProcedure" className="label">Procedure *</label>
                <input id="planProcedure" name="procedure" className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="planCost" className="label">Estimated cost (KES)</label>
                  <input id="planCost" name="estimatedCost" type="number" min={0} step="1" className="input" />
                </div>
                <div>
                  <label htmlFor="planReview" className="label">Review date</label>
                  <input id="planReview" name="nextReviewDate" type="date" min={clinicToday()} className="input" />
                </div>
              </div>
              <div>
                <label htmlFor="planStatus" className="label">Status</label>
                <select id="planStatus" name="status" className="select" defaultValue="Planned">
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label htmlFor="planNotes" className="label">Notes</label>
                <textarea id="planNotes" name="notes" className="textarea !min-h-20" />
              </div>
              <SubmitButton className="w-full" pendingText="Saving plan…"><Plus className="h-4 w-4" aria-hidden /> Add treatment plan</SubmitButton>
            </form>
          </Section>

          <Section title="Latest vitals" description="Front-desk triage before the visit.">
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
              <p className="text-xs text-navy-500">No vitals recorded.</p>
            )}
          </Section>

          <Section title="Upcoming dental appointments">
            {upcoming.length === 0 ? (
              <p className="text-xs text-navy-500">No upcoming dental appointments.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{formatDate(appointment.appointment_date)} · {appointment.appointment_time}</p>
                      <p className="truncate text-[10px] text-navy-400">{appointment.service_name || "Dental visit"} · {appointment.doctor_name}</p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Medical safety" description="Shared master record.">
            <dl className="space-y-2 text-[11px] leading-5 text-navy-600">
              <div><dt className="inline font-bold text-navy-800">Allergies: </dt><dd className="inline">{patient.allergies || "None recorded"}</dd></div>
              <div><dt className="inline font-bold text-navy-800">Conditions: </dt><dd className="inline">{patient.conditions || "None recorded"}</dd></div>
              <div><dt className="inline font-bold text-navy-800">Medications: </dt><dd className="inline">{patient.medications || "None recorded"}</dd></div>
              <div><dt className="inline font-bold text-navy-800">History: </dt><dd className="inline">{patient.medical_history || "None recorded"}</dd></div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-navy-400">
              <HeartPulse className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" aria-hidden />
              Confirm allergy and medication details before prescribing or performing treatment.
            </p>
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="flex items-center gap-2"><Smile className="h-4 w-4 text-teal-600" aria-hidden /> {openPlans.length} open treatment plan(s)</p>
            <p className="mt-1 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-navy-400" aria-hidden /> {dentalVisits.length} dental visit(s)</p>
            <p className="mt-1 flex items-center gap-2"><CalendarPlus className="h-4 w-4 text-navy-400" aria-hidden /> {upcoming.length} upcoming appointment(s)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
