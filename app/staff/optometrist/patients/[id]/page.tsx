import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  Eye,
  FileText,
  Glasses,
  HeartPulse,
  Play,
  Stethoscope,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientBanner } from "@/components/staff/patient-banner";
import { PrescriptionTable } from "@/components/staff/prescription-table";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getActiveVisit,
  getLatestVitals,
  getOpticalPrescriptions,
  getOpticalVisits,
  getPatient,
  getUpcomingAppointmentsForPatient,
} from "@/lib/data/queries";
import { startOpticalForPatientAction } from "@/lib/actions/optical";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Optical Patient Card" };

export default async function OptometristPatientCard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("eye_doctor");
  const { id } = await params;
  const flash = await searchParams;
  const patient = await getPatient(id);
  if (!patient) notFound();

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.view",
    entityType: "optical_record",
    entityId: patient.id,
    patientId: patient.id,
    details: `Viewed optical patient card for ${patient.patient_number}.`,
  });

  const opticalVisits = await getOpticalVisits(patient.id);
  const prescriptions = await getOpticalPrescriptions(patient.id);
  const upcoming = (await getUpcomingAppointmentsForPatient(patient.id)).filter((appointment) => appointment.department === "optical");
  const vitals = await getLatestVitals(patient.id);
  const activeVisit = await getActiveVisit(patient.id, "optical");
  const activeOpticalVisit = activeVisit ? opticalVisits.find((visit) => visit.visit_id === activeVisit.id) : undefined;
  const latestPrescription = prescriptions[0];

  return (
    <div>
      <PageHeader
        eyebrow="Optical patient card"
        title={patient.full_name}
        description={`${patient.patient_number} · eye examinations, refraction and spectacle prescriptions`}
        breadcrumbs={[
          { label: "Optical patients", href: "/staff/optometrist/patients" },
          { label: patient.full_name },
        ]}
        actions={
          <>
            <Link href="/staff/optometrist/patients" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to patients</Link>
            {activeOpticalVisit ? (
              <Link href={`/staff/optometrist/consultations/${activeOpticalVisit.id}`} className="btn-primary"><Eye className="h-4 w-4" aria-hidden /> Continue examination</Link>
            ) : (
              <form action={startOpticalForPatientAction}>
                <input type="hidden" name="patientId" value={patient.id} />
                <SubmitButton pendingText="Starting…"><Play className="h-4 w-4" aria-hidden /> Start eye examination</SubmitButton>
              </form>
            )}
          </>
        }
      />
      <Flash error={flash.error} success={flash.success} />

      <PatientBanner patient={patient} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Latest spectacle prescription" description="Most recent refraction issued to this patient.">
            {latestPrescription ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-mist p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy-400">Right eye (OD)</p>
                    <p className="mt-1 font-mono text-sm text-navy-900">
                      SPH {latestPrescription.od_sph || "—"} · CYL {latestPrescription.od_cyl || "—"} · Axis {latestPrescription.od_axis || "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-navy-500">Add {latestPrescription.od_add || "—"} · Prism {latestPrescription.od_prism || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-mist p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-navy-400">Left eye (OS)</p>
                    <p className="mt-1 font-mono text-sm text-navy-900">
                      SPH {latestPrescription.os_sph || "—"} · CYL {latestPrescription.os_cyl || "—"} · Axis {latestPrescription.os_axis || "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-navy-500">Add {latestPrescription.os_add || "—"} · Prism {latestPrescription.os_prism || "—"}</p>
                  </div>
                </div>
                <p className="text-[11px] leading-5 text-navy-500">
                  PD {latestPrescription.pd || latestPrescription.pd_od || "—"} · {latestPrescription.lens_type || "Lens type not recorded"} · issued {formatDate(latestPrescription.prescribed_at)} by {latestPrescription.doctor_name || "clinician"}
                </p>
                {latestPrescription.notes && <p className="rounded-xl bg-mist p-3 text-[11px] leading-5 text-navy-600">{latestPrescription.notes}</p>}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-8 text-center text-xs text-navy-500">
                No spectacle prescription has been issued. Start an eye examination to record refraction.
              </p>
            )}
          </Section>

          <Section title="Eye examination history" description="Clinical findings from previous optical consultations." bodyClassName="p-0">
            {opticalVisits.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No optical examinations recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {opticalVisits.map((visit) => (
                  <li key={visit.id} className="px-5 py-4">
                    <details>
                      <summary className="cursor-pointer">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="block text-sm font-semibold text-navy-900">{formatDate(visit.visit_date)}</span>
                            <span className="block text-[11px] text-navy-400">{visit.doctor_name || "Clinician"} · {visit.diagnosis || "No diagnosis recorded"}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            {visit.follow_up_date && <StatusBadge status="Monitoring" />}
                            <FileText className="h-4 w-4 text-navy-300" aria-hidden />
                          </span>
                        </span>
                      </summary>
                      <div className="mt-3 grid gap-3 rounded-xl bg-mist p-3 text-[11px] leading-5 text-navy-600 sm:grid-cols-2">
                        <p><strong className="text-navy-800">Complaint:</strong> {visit.presenting_complaint || "—"}</p>
                        <p><strong className="text-navy-800">Unaided VA:</strong> OD {visit.unaided_va_od || "—"} · OS {visit.unaided_va_os || "—"}</p>
                        <p><strong className="text-navy-800">Pinhole VA:</strong> OD {visit.pinhole_va_od || "—"} · OS {visit.pinhole_va_os || "—"}</p>
                        <p><strong className="text-navy-800">Corrected VA:</strong> OD {visit.corrected_va_od || "—"} · OS {visit.corrected_va_os || "—"}</p>
                        <p><strong className="text-navy-800">IOP:</strong> OD {visit.iop_od || "—"} · OS {visit.iop_os || "—"}</p>
                        <p><strong className="text-navy-800">Colour vision:</strong> {visit.colour_vision || "—"}</p>
                        <p className="sm:col-span-2"><strong className="text-navy-800">Anterior segment:</strong> {visit.anterior_segment || "—"}</p>
                        <p className="sm:col-span-2"><strong className="text-navy-800">Posterior segment:</strong> {visit.posterior_segment || "—"}</p>
                        <p className="sm:col-span-2"><strong className="text-navy-800">Management:</strong> {visit.management_plan || "—"}</p>
                        <p><strong className="text-navy-800">Referral:</strong> {visit.referral || "—"}</p>
                        <p><strong className="text-navy-800">Follow-up:</strong> {formatDate(visit.follow_up_date)}</p>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Prescription history" description="All spectacle prescriptions issued to this patient." bodyClassName="p-0">
            <PrescriptionTable prescriptions={prescriptions} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Visit summary">
            <dl className="space-y-2 text-[11px] leading-5 text-navy-600">
              <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-teal-600" aria-hidden /> Eye examinations</dt><dd className="font-semibold text-navy-800">{opticalVisits.length}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5"><Glasses className="h-3.5 w-3.5 text-sky-600" aria-hidden /> Prescriptions</dt><dd className="font-semibold text-navy-800">{prescriptions.length}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5"><CalendarPlus className="h-3.5 w-3.5 text-navy-400" aria-hidden /> Upcoming appointments</dt><dd className="font-semibold text-navy-800">{upcoming.length}</dd></div>
            </dl>
            {latestPrescription && (
              <p className="mt-3 rounded-xl bg-teal-50 p-3 text-[11px] leading-5 text-teal-900">
                Last refraction recorded {formatDate(latestPrescription.prescribed_at)}.
              </p>
            )}
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

          <Section title="Upcoming optical appointments">
            {upcoming.length === 0 ? (
              <p className="text-xs text-navy-500">No upcoming optical appointments.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{formatDate(appointment.appointment_date)} · {appointment.appointment_time}</p>
                      <p className="truncate text-[10px] text-navy-400">{appointment.service_name || "Eye examination"} · {appointment.doctor_name}</p>
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
              Check systemic conditions such as diabetes before refraction or referral.
            </p>
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-teal-600" aria-hidden /> {opticalVisits.length} eye examination(s)</p>
            <p className="mt-1 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-navy-400" aria-hidden /> {prescriptions.length} prescription(s)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
