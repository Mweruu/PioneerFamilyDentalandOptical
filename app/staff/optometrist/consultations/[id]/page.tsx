import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Eye,
  Glasses,
  HeartPulse,
  Save,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { PrescriptionTable } from "@/components/staff/prescription-table";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/staff/confirm-submit";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getAppointmentForVisit,
  getLatestVitals,
  getOpticalPrescriptions,
  getOpticalVisit,
  getPatient,
  getVisit,
} from "@/lib/data/queries";
import {
  completeOpticalConsultationAction,
  saveOpticalVisitAction,
  savePrescriptionAction,
} from "@/lib/actions/optical";
import { formatDate, formatDateTime, formatTime, safeJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Optical Examination" };

const COMMON_SYMPTOMS = [
  "Blurred distance vision",
  "Blurred near vision",
  "Headaches",
  "Eye strain",
  "Redness",
  "Watering",
  "Discharge",
  "Flashes or floaters",
  "Double vision",
  "Eye pain",
  "Itching",
  "Sensitivity to light",
];

const LENS_TYPES = [
  "Single vision",
  "Bifocal",
  "Progressive / varifocal",
  "Reading glasses",
  "Photochromic",
  "Blue-light filter",
  "Contact lens",
  "Not required",
];

export default async function OpticalConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("eye_doctor");
  const { id } = await params;
  const flash = await searchParams;
  const opticalVisit = getOpticalVisit(id);
  if (!opticalVisit) notFound();
  if (opticalVisit.doctor_id !== user.id) {
    redirect(`/staff/optometrist/patients/${opticalVisit.patient_id}?error=${encodeURIComponent("You can only edit optical records you created.")}`);
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.view",
    entityType: "optical_record",
    entityId: opticalVisit.id,
    patientId: opticalVisit.patient_id,
    details: "Opened optical examination record.",
  });

  const patient = getPatient(opticalVisit.patient_id);
  if (!patient) notFound();
  const visit = opticalVisit.visit_id ? getVisit(opticalVisit.visit_id) : undefined;
  const appointment = opticalVisit.visit_id ? getAppointmentForVisit(opticalVisit.visit_id) : undefined;
  const vitals = getLatestVitals(patient.id);
  const prescriptions = getOpticalPrescriptions(patient.id);
  const visitPrescriptions = prescriptions.filter((rx) => rx.optical_visit_id === opticalVisit.id);
  const previousPrescription = prescriptions.find((rx) => rx.optical_visit_id !== opticalVisit.id);
  const symptoms = safeJson<string[]>(opticalVisit.symptoms, []);
  const returnTo = `/staff/optometrist/consultations/${opticalVisit.id}`;
  const completed = visit?.status === "Completed";

  return (
    <div>
      <PageHeader
        eyebrow="Optical consultation"
        title={patient.full_name}
        description={`Visit ${formatDate(opticalVisit.visit_date)} · ${opticalVisit.doctor_name || user.name}`}
        breadcrumbs={[
          { label: "Optical patients", href: "/staff/optometrist/patients" },
          { label: patient.full_name, href: `/staff/optometrist/patients/${patient.id}` },
          { label: "Examination" },
        ]}
        actions={
          <>
            <Link href={`/staff/optometrist/patients/${patient.id}`} className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Patient card</Link>
            {!completed && (
              <form action={completeOpticalConsultationAction}>
                <input type="hidden" name="opticalVisitId" value={opticalVisit.id} />
                <ConfirmSubmit message="Complete this optical consultation? The appointment will be marked completed and the record will remain editable by you." pendingText="Completing…">
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
        <span className="text-xs text-navy-500">Started {formatDateTime(visit?.started_at || opticalVisit.created_at)}</span>
        {appointment && (
          <span className="text-xs text-navy-500">
            · {appointment.reference} · {formatTime(appointment.appointment_time)} · {appointment.service_name || "Eye examination"}
          </span>
        )}
        {completed && <span className="ml-auto text-[11px] font-semibold text-emerald-700">Completed {formatDateTime(visit?.completed_at)}</span>}
      </div>

      <div className="mb-5">
        <PatientBanner patient={patient} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Eye examination" description="Record history, visual acuity, anterior and posterior findings.">
            <form action={saveOpticalVisitAction} className="space-y-4">
              <input type="hidden" name="opticalVisitId" value={opticalVisit.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div>
                <label htmlFor="presentingComplaint" className="label">Presenting complaint</label>
                <textarea id="presentingComplaint" name="presentingComplaint" className="textarea !min-h-20" defaultValue={opticalVisit.presenting_complaint ?? ""} />
              </div>
              <fieldset>
                <legend className="label">Symptoms</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {COMMON_SYMPTOMS.map((symptom) => (
                    <label key={symptom} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-xs text-navy-700">
                      <input type="checkbox" name="symptoms" value={symptom} defaultChecked={symptoms.includes(symptom)} className="h-3.5 w-3.5 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                      {symptom}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="unaidedVaOd" className="label">Unaided VA — right (OD)</label>
                  <input id="unaidedVaOd" name="unaidedVaOd" className="input" defaultValue={opticalVisit.unaided_va_od ?? ""} placeholder="e.g. 6/9" />
                </div>
                <div>
                  <label htmlFor="unaidedVaOs" className="label">Unaided VA — left (OS)</label>
                  <input id="unaidedVaOs" name="unaidedVaOs" className="input" defaultValue={opticalVisit.unaided_va_os ?? ""} placeholder="e.g. 6/12" />
                </div>
                <div>
                  <label htmlFor="pinholeVaOd" className="label">Pinhole VA — right (OD)</label>
                  <input id="pinholeVaOd" name="pinholeVaOd" className="input" defaultValue={opticalVisit.pinhole_va_od ?? ""} />
                </div>
                <div>
                  <label htmlFor="pinholeVaOs" className="label">Pinhole VA — left (OS)</label>
                  <input id="pinholeVaOs" name="pinholeVaOs" className="input" defaultValue={opticalVisit.pinhole_va_os ?? ""} />
                </div>
                <div>
                  <label htmlFor="correctedVaOd" className="label">Corrected VA — right (OD)</label>
                  <input id="correctedVaOd" name="correctedVaOd" className="input" defaultValue={opticalVisit.corrected_va_od ?? ""} />
                </div>
                <div>
                  <label htmlFor="correctedVaOs" className="label">Corrected VA — left (OS)</label>
                  <input id="correctedVaOs" name="correctedVaOs" className="input" defaultValue={opticalVisit.corrected_va_os ?? ""} />
                </div>
                <div>
                  <label htmlFor="iopOd" className="label">IOP — right (OD) mmHg</label>
                  <input id="iopOd" name="iopOd" inputMode="decimal" className="input" defaultValue={opticalVisit.iop_od ?? ""} placeholder="e.g. 16" />
                </div>
                <div>
                  <label htmlFor="iopOs" className="label">IOP — left (OS) mmHg</label>
                  <input id="iopOs" name="iopOs" inputMode="decimal" className="input" defaultValue={opticalVisit.iop_os ?? ""} placeholder="e.g. 15" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="colourVision" className="label">Colour vision</label>
                  <input id="colourVision" name="colourVision" className="input" defaultValue={opticalVisit.colour_vision ?? ""} placeholder="e.g. Normal Ishihara, 12/12" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="externalExamination" className="label">External examination</label>
                  <textarea id="externalExamination" name="externalExamination" className="textarea" defaultValue={opticalVisit.external_examination ?? ""} />
                </div>
                <div>
                  <label htmlFor="anteriorSegment" className="label">Anterior segment</label>
                  <textarea id="anteriorSegment" name="anteriorSegment" className="textarea" defaultValue={opticalVisit.anterior_segment ?? ""} />
                </div>
                <div>
                  <label htmlFor="posteriorSegment" className="label">Posterior segment</label>
                  <textarea id="posteriorSegment" name="posteriorSegment" className="textarea" defaultValue={opticalVisit.posterior_segment ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="diagnosis" className="label">Diagnosis</label>
                  <textarea id="diagnosis" name="diagnosis" className="textarea" defaultValue={opticalVisit.diagnosis ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="managementPlan" className="label">Management plan</label>
                  <textarea id="managementPlan" name="managementPlan" className="textarea" defaultValue={opticalVisit.management_plan ?? ""} />
                </div>
                <div>
                  <label htmlFor="referral" className="label">Referral</label>
                  <input id="referral" name="referral" className="input" defaultValue={opticalVisit.referral ?? ""} placeholder="e.g. Ophthalmology review" />
                </div>
                <div>
                  <label htmlFor="followUpDate" className="label">Follow-up date</label>
                  <input id="followUpDate" name="followUpDate" type="date" className="input" defaultValue={opticalVisit.follow_up_date ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="examNotes" className="label">Internal notes</label>
                  <textarea id="examNotes" name="notes" className="textarea" defaultValue={opticalVisit.notes ?? ""} />
                </div>
              </div>
              <SubmitButton pendingText="Saving examination…"><Save className="h-4 w-4" aria-hidden /> Save examination</SubmitButton>
            </form>
          </Section>

          <Section title="Issue spectacle prescription" description="Record the final refraction and lens recommendation.">
            <form action={savePrescriptionAction} className="space-y-4">
              <input type="hidden" name="opticalVisitId" value={opticalVisit.id} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-mist p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-navy-500">Right eye (OD)</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="odSph" className="label !text-[11px]">SPH</label>
                      <input id="odSph" name="odSph" className="input !px-2 !text-sm" placeholder="-1.25" />
                    </div>
                    <div>
                      <label htmlFor="odCyl" className="label !text-[11px]">CYL</label>
                      <input id="odCyl" name="odCyl" className="input !px-2 !text-sm" placeholder="-0.50" />
                    </div>
                    <div>
                      <label htmlFor="odAxis" className="label !text-[11px]">Axis</label>
                      <input id="odAxis" name="odAxis" inputMode="numeric" className="input !px-2 !text-sm" placeholder="180" />
                    </div>
                    <div>
                      <label htmlFor="odAdd" className="label !text-[11px]">Add</label>
                      <input id="odAdd" name="odAdd" className="input !px-2 !text-sm" placeholder="+2.00" />
                    </div>
                    <div>
                      <label htmlFor="odPrism" className="label !text-[11px]">Prism</label>
                      <input id="odPrism" name="odPrism" className="input !px-2 !text-sm" />
                    </div>
                    <div>
                      <label htmlFor="odBase" className="label !text-[11px]">Base</label>
                      <input id="odBase" name="odBase" className="input !px-2 !text-sm" placeholder="IN" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-mist p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-navy-500">Left eye (OS)</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="osSph" className="label !text-[11px]">SPH</label>
                      <input id="osSph" name="osSph" className="input !px-2 !text-sm" placeholder="-1.50" />
                    </div>
                    <div>
                      <label htmlFor="osCyl" className="label !text-[11px]">CYL</label>
                      <input id="osCyl" name="osCyl" className="input !px-2 !text-sm" placeholder="-0.75" />
                    </div>
                    <div>
                      <label htmlFor="osAxis" className="label !text-[11px]">Axis</label>
                      <input id="osAxis" name="osAxis" inputMode="numeric" className="input !px-2 !text-sm" placeholder="175" />
                    </div>
                    <div>
                      <label htmlFor="osAdd" className="label !text-[11px]">Add</label>
                      <input id="osAdd" name="osAdd" className="input !px-2 !text-sm" placeholder="+2.00" />
                    </div>
                    <div>
                      <label htmlFor="osPrism" className="label !text-[11px]">Prism</label>
                      <input id="osPrism" name="osPrism" className="input !px-2 !text-sm" />
                    </div>
                    <div>
                      <label htmlFor="osBase" className="label !text-[11px]">Base</label>
                      <input id="osBase" name="osBase" className="input !px-2 !text-sm" placeholder="IN" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="pd" className="label">PD (mm)</label>
                  <input id="pd" name="pd" className="input" placeholder="e.g. 63" />
                </div>
                <div>
                  <label htmlFor="pdOd" className="label">PD right (OD)</label>
                  <input id="pdOd" name="pdOd" className="input" placeholder="e.g. 31.5" />
                </div>
                <div>
                  <label htmlFor="pdOs" className="label">PD left (OS)</label>
                  <input id="pdOs" name="pdOs" className="input" placeholder="e.g. 31.5" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="lensType" className="label">Lens type</label>
                  <select id="lensType" name="lensType" className="select" defaultValue="">
                    <option value="">Select lens type</option>
                    {LENS_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="frameRecommendation" className="label">Frame recommendation</label>
                  <input id="frameRecommendation" name="frameRecommendation" className="input" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="lensRecommendation" className="label">Lens recommendation</label>
                  <textarea id="lensRecommendation" name="lensRecommendation" className="textarea !min-h-20" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="rxNotes" className="label">Notes</label>
                  <textarea id="rxNotes" name="notes" className="textarea !min-h-20" />
                </div>
              </div>

              <SubmitButton pendingText="Issuing prescription…"><Glasses className="h-4 w-4" aria-hidden /> Issue prescription</SubmitButton>
            </form>
          </Section>

          <Section title="Prescriptions issued during this visit" bodyClassName="p-0">
            <PrescriptionTable prescriptions={visitPrescriptions} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Previous prescription" description="Most recent refraction before this visit.">
            {previousPrescription ? (
              <div className="space-y-2 text-[11px] leading-5 text-navy-600">
                <p className="text-navy-400">Issued {formatDate(previousPrescription.prescribed_at)} by {previousPrescription.doctor_name || "clinician"}</p>
                <p><strong className="text-navy-800">OD:</strong> {previousPrescription.od_sph || "—"} / {previousPrescription.od_cyl || "—"} × {previousPrescription.od_axis || "—"}</p>
                <p><strong className="text-navy-800">OS:</strong> {previousPrescription.os_sph || "—"} / {previousPrescription.os_cyl || "—"} × {previousPrescription.os_axis || "—"}</p>
                <p><strong className="text-navy-800">Add:</strong> OD {previousPrescription.od_add || "—"} · OS {previousPrescription.os_add || "—"}</p>
                <p><strong className="text-navy-800">PD:</strong> {previousPrescription.pd || "—"}</p>
              </div>
            ) : (
              <p className="text-xs text-navy-500">No previous prescription on record.</p>
            )}
            <Link href={`/staff/optometrist/patients/${patient.id}`} className="btn-secondary mt-3 w-full"><Eye className="h-4 w-4" aria-hidden /> Full prescription history</Link>
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

          <Section title="Medical safety" description="Check before prescribing or referral.">
            <div className="space-y-2 text-[11px] leading-5 text-navy-600">
              <p><strong className="text-navy-800">Allergies:</strong> {patient.allergies || "None recorded"}</p>
              <p><strong className="text-navy-800">Conditions:</strong> {patient.conditions || "None recorded"}</p>
              <p><strong className="text-navy-800">Medications:</strong> {patient.medications || "None recorded"}</p>
              <p><strong className="text-navy-800">History:</strong> {patient.medical_history || "None recorded"}</p>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-navy-400">
              <HeartPulse className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" aria-hidden />
              Consider diabetic retinopathy and hypertension risk before finalising a management plan.
            </p>
          </Section>

          {appointment && (
            <Section title="Appointment">
              <p className="text-xs text-navy-600">{appointment.reference}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-500"><CalendarDays className="h-3.5 w-3.5 text-navy-400" aria-hidden /> {formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-500"><UserRound className="h-3.5 w-3.5 text-navy-400" aria-hidden /> {appointment.doctor_name}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
