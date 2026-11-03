"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { createClient } from "../supabase/server";
import {
  getAppointment,
  getDentalVisit,
  getPatient,
  getToothFinding,
  getTreatmentPlan,
} from "../data/queries";
import type { TreatmentPlan } from "../types";
import { PERMANENT_TEETH, PRIMARY_TEETH, TOOTH_CONDITIONS, TOOTH_STATUSES } from "../types";
import { clinicToday, nowIso } from "../utils";
import {
  formReturnPath,
  isValidDate,
  multiText,
  numberOrNull,
  optionalText,
  redirectError,
  redirectSuccess,
  text,
} from "./helpers";

const VALID_TEETH = new Set([...Object.values(PERMANENT_TEETH).flat(), ...Object.values(PRIMARY_TEETH).flat()]);

async function ownedDentalVisit(id: string, doctorId: string) {
  const visit = await getDentalVisit(id);
  if (!visit) throw new Error("Dental visit not found.");
  if (visit.doctor_id !== doctorId) throw new Error("You can only edit dental records you created.");
  return visit;
}

export async function startDentalConsultationAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const appointmentId = text(formData, "appointmentId", 60);
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/dentist", "Appointment not found.");
  if (appointment.department !== "dental") return redirectError("/staff/dentist", "That appointment is not a dental visit.");
  if (appointment.doctor_id !== user.id) return redirectError("/staff/dentist", "That appointment is assigned to another dentist.");
  if (["Cancelled", "No Show", "Completed"].includes(appointment.status)) {
    return redirectError(`/staff/dentist/appointments/${appointmentId}`, "This appointment can no longer be started.");
  }
  if (!appointment.patient_id) {
    return redirectError(`/staff/dentist/appointments/${appointmentId}`, "Reception must link this booking to a patient record first.");
  }

  const supabase = await createClient();
  const now = nowIso();
  const { data: visit } = await supabase
    .from("visits")
    .select("id, started_at")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (visit) {
    const { data: existingDental } = await supabase
      .from("dental_visits")
      .select("id")
      .eq("visit_id", visit.id)
      .maybeSingle();
    if (existingDental) {
      return redirectSuccess(`/staff/dentist/consultations/${existingDental.id}`, "Consultation already in progress.");
    }
  }

  const dentalVisitId = crypto.randomUUID();
  let visitId = visit?.id ?? null;

  if (visitId) {
    const { error } = await supabase
      .from("visits")
      .update({ status: "In Consultation", doctor_id: user.id, started_at: visit?.started_at ?? now })
      .eq("id", visitId);
    if (error) return redirectError(`/staff/dentist/appointments/${appointmentId}`, "The consultation could not be started.");
  } else {
    visitId = crypto.randomUUID();
    const { error } = await supabase.from("visits").insert({
      id: visitId,
      patient_id: appointment.patient_id,
      appointment_id: appointmentId,
      department: "dental",
      doctor_id: user.id,
      status: "In Consultation",
      started_at: now,
      created_at: now,
    });
    if (error) return redirectError(`/staff/dentist/appointments/${appointmentId}`, "The consultation could not be started.");
  }

  const { error: dentalError } = await supabase.from("dental_visits").insert({
    id: dentalVisitId,
    patient_id: appointment.patient_id,
    visit_id: visitId,
    doctor_id: user.id,
    visit_date: clinicToday(),
    presenting_complaint: appointment.reason,
    history: null,
    examination_findings: null,
    diagnosis: null,
    treatment_performed: null,
    medications: null,
    advice: null,
    follow_up: null,
    notes: null,
    created_at: now,
    updated_at: now,
  });
  if (dentalError) return redirectError(`/staff/dentist/appointments/${appointmentId}`, "The dental record could not be created.");

  await supabase
    .from("appointments")
    .update({ status: "In Consultation", checked_in_at: appointment.checked_in_at ?? now, updated_at: now })
    .eq("id", appointmentId);

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.consultation_start",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId: appointment.patient_id,
    details: `Started dental consultation for ${appointment.reference}.`,
  });

  redirectSuccess(`/staff/dentist/consultations/${dentalVisitId}`, "Consultation started.");
}

export async function saveDentalVisitAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const dentalVisitId = text(formData, "dentalVisitId", 60);
  const visit = await ownedDentalVisit(dentalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/dentist/consultations/${dentalVisitId}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("dental_visits")
    .update({
      presenting_complaint: optionalText(formData, "presentingComplaint", 2000),
      history: optionalText(formData, "history", 4000),
      examination_findings: optionalText(formData, "examinationFindings", 4000),
      diagnosis: optionalText(formData, "diagnosis", 2000),
      treatment_performed: optionalText(formData, "treatmentPerformed", 4000),
      medications: optionalText(formData, "medications", 2000),
      advice: optionalText(formData, "advice", 2000),
      follow_up: optionalText(formData, "followUp", 2000),
      notes: optionalText(formData, "notes", 2000),
      updated_at: nowIso(),
    })
    .eq("id", dentalVisitId);

  if (error) return redirectError(returnTo, "The clinical notes could not be saved. Please try again.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.notes_update",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId: visit.patient_id,
    details: "Updated dental clinical notes.",
  });

  redirectSuccess(returnTo, "Clinical notes saved.");
}

export async function saveToothFindingAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const dentalVisitId = text(formData, "dentalVisitId", 60);
  const visit = await ownedDentalVisit(dentalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/dentist/consultations/${dentalVisitId}`);

  const toothNumber = text(formData, "toothNumber", 4);
  const dentition = text(formData, "dentition", 20) === "primary" ? "primary" : "permanent";
  const condition = text(formData, "condition", 80);
  const status = text(formData, "status", 30);
  const treatmentDate = optionalText(formData, "treatmentDate", 10);
  const surfaces = multiText(formData, "surfaces", 40);

  if (!VALID_TEETH.has(toothNumber)) return redirectError(returnTo, "Select a valid FDI tooth number.");
  if (!(TOOTH_CONDITIONS as readonly string[]).includes(condition)) return redirectError(returnTo, "Select a valid tooth condition.");
  if (!(TOOTH_STATUSES as readonly string[]).includes(status)) return redirectError(returnTo, "Select a valid tooth status.");
  if (treatmentDate && !isValidDate(treatmentDate)) return redirectError(returnTo, "Enter a valid treatment date.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("tooth_findings")
    .select("id")
    .eq("dental_visit_id", dentalVisitId)
    .eq("tooth_number", toothNumber)
    .maybeSingle();

  const now = nowIso();
  const payload = {
    dentition,
    condition,
    surfaces: surfaces.length ? surfaces : null,
    diagnosis: optionalText(formData, "diagnosis", 1000),
    planned_treatment: optionalText(formData, "plannedTreatment", 1000),
    treatment_performed: optionalText(formData, "treatmentPerformed", 1000),
    treatment_date: treatmentDate,
    notes: optionalText(formData, "notes", 1000),
    status,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabase.from("tooth_findings").update(payload).eq("id", existing.id);
    if (error) return redirectError(returnTo, "The tooth finding could not be saved. Please try again.");
  } else {
    const { error } = await supabase.from("tooth_findings").insert({
      id: crypto.randomUUID(),
      patient_id: visit.patient_id,
      dental_visit_id: dentalVisitId,
      tooth_number: toothNumber,
      ...payload,
      created_at: now,
    });
    if (error) return redirectError(returnTo, "The tooth finding could not be saved. Please try again.");
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: existing ? "dental.tooth_update" : "dental.tooth_add",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId: visit.patient_id,
    details: `Recorded ${condition} on tooth ${toothNumber} (${status}).`,
  });

  redirectSuccess(returnTo, `Tooth ${toothNumber} saved.`);
}

export async function deleteToothFindingAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const findingId = text(formData, "findingId", 60);
  const finding = await getToothFinding(findingId);
  if (!finding) return redirectError("/staff/dentist", "Tooth finding not found.");
  const visit = await ownedDentalVisit(finding.dental_visit_id, user.id);
  const returnTo = formReturnPath(formData, `/staff/dentist/consultations/${finding.dental_visit_id}`);

  const supabase = await createClient();
  const { error } = await supabase.from("tooth_findings").delete().eq("id", findingId);
  if (error) return redirectError(returnTo, "The finding could not be removed.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.tooth_delete",
    entityType: "dental_record",
    entityId: finding.dental_visit_id,
    patientId: visit.patient_id,
    details: `Deleted finding for tooth ${finding.tooth_number}.`,
  });
  redirectSuccess(returnTo, `Finding for tooth ${finding.tooth_number} removed.`);
}

export async function saveTreatmentPlanAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const planId = optionalText(formData, "planId", 60);
  const patientId = text(formData, "patientId", 60);
  const dentalVisitId = optionalText(formData, "dentalVisitId", 60);
  const returnTo = formReturnPath(formData, `/staff/dentist/patients/${patientId}`);
  const patient = await getPatient(patientId);
  if (!patient) return redirectError(returnTo, "Patient not found.");

  const diagnosis = text(formData, "diagnosis", 1000);
  const procedure = text(formData, "procedure", 1000);
  const toothNumbers = text(formData, "toothNumbers", 200);
  const priority = text(formData, "priority", 20);
  const status = text(formData, "status", 30);
  const nextReview = optionalText(formData, "nextReviewDate", 10);
  const estimatedCost = numberOrNull(formData, "estimatedCost");

  if (diagnosis.length < 2) return redirectError(returnTo, "Enter a diagnosis.");
  if (procedure.length < 2) return redirectError(returnTo, "Enter the planned procedure.");
  if (!["Low", "Medium", "High"].includes(priority)) return redirectError(returnTo, "Select a valid priority.");
  if (!["Planned", "In Progress", "Completed", "Cancelled"].includes(status)) return redirectError(returnTo, "Select a valid plan status.");
  if (nextReview && !isValidDate(nextReview)) return redirectError(returnTo, "Enter a valid review date.");
  if (estimatedCost !== null && (estimatedCost < 0 || estimatedCost > 10_000_000)) return redirectError(returnTo, "Enter a valid estimated cost.");

  if (dentalVisitId) {
    const visit = await ownedDentalVisit(dentalVisitId, user.id);
    if (visit.patient_id !== patientId) return redirectError(returnTo, "The dental visit does not belong to this patient.");
  }

  const supabase = await createClient();
  const now = nowIso();
  if (planId) {
    const plan = await getTreatmentPlan(planId);
    if (!plan || plan.created_by !== user.id || plan.patient_id !== patientId) {
      return redirectError(returnTo, "You can only edit treatment plans you created for this patient.");
    }
    const { error } = await supabase
      .from("treatment_plans")
      .update({
        dental_visit_id: dentalVisitId,
        tooth_numbers: toothNumbers,
        diagnosis,
        procedure,
        priority,
        estimated_cost: estimatedCost,
        status,
        notes: optionalText(formData, "notes", 2000),
        next_review_date: nextReview,
        updated_at: now,
      })
      .eq("id", planId);
    if (error) return redirectError(returnTo, "The treatment plan could not be updated.");
  } else {
    const { error } = await supabase.from("treatment_plans").insert({
      id: crypto.randomUUID(),
      patient_id: patientId,
      dental_visit_id: dentalVisitId,
      tooth_numbers: toothNumbers,
      diagnosis,
      procedure,
      priority,
      estimated_cost: estimatedCost,
      status,
      notes: optionalText(formData, "notes", 2000),
      next_review_date: nextReview,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    });
    if (error) return redirectError(returnTo, "The treatment plan could not be saved.");
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: planId ? "dental.plan_update" : "dental.plan_add",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId,
    details: `${planId ? "Updated" : "Created"} treatment plan: ${procedure}.`,
  });

  redirectSuccess(returnTo, planId ? "Treatment plan updated." : "Treatment plan added.");
}

export async function updateTreatmentPlanStatusAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const planId = text(formData, "planId", 60);
  const status = text(formData, "status", 30) as TreatmentPlan["status"];
  const plan = await getTreatmentPlan(planId);
  if (!plan) return redirectError("/staff/dentist", "Treatment plan not found.");
  if (plan.created_by !== user.id) return redirectError(`/staff/dentist/patients/${plan.patient_id}`, "Only the dentist who created this plan can update it.");
  if (!["Planned", "In Progress", "Completed", "Cancelled"].includes(status)) {
    return redirectError(`/staff/dentist/patients/${plan.patient_id}`, "Select a valid plan status.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("treatment_plans")
    .update({ status, updated_at: nowIso() })
    .eq("id", planId);
  if (error) return redirectError(`/staff/dentist/patients/${plan.patient_id}`, "The plan status could not be updated.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.plan_status",
    entityType: "dental_record",
    entityId: plan.dental_visit_id,
    patientId: plan.patient_id,
    details: `Treatment plan status set to ${status}.`,
  });
  redirectSuccess(`/staff/dentist/patients/${plan.patient_id}`, `Treatment plan marked ${status.toLowerCase()}.`);
}

export async function completeDentalConsultationAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const dentalVisitId = text(formData, "dentalVisitId", 60);
  const visit = await ownedDentalVisit(dentalVisitId, user.id);
  const returnTo = `/staff/dentist/patients/${visit.patient_id}`;
  const now = nowIso();

  const supabase = await createClient();
  if (visit.visit_id) {
    await supabase
      .from("visits")
      .update({ status: "Completed", completed_at: now })
      .eq("id", visit.visit_id);

    const { data: linked } = await supabase
      .from("visits")
      .select("appointment_id")
      .eq("id", visit.visit_id)
      .maybeSingle();

    if (linked?.appointment_id) {
      await supabase
        .from("appointments")
        .update({ status: "Completed", updated_at: now })
        .eq("id", linked.appointment_id);
    }
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.consultation_complete",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId: visit.patient_id,
    details: "Completed dental consultation.",
  });

  redirectSuccess(returnTo, "Dental consultation completed.");
}

export async function quickToothUpdateAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const dentalVisitId = text(formData, "dentalVisitId", 60);
  const visit = await ownedDentalVisit(dentalVisitId, user.id);
  const toothNumber = text(formData, "toothNumber", 4);
  const condition = text(formData, "condition", 80);
  if (!VALID_TEETH.has(toothNumber) || !(TOOTH_CONDITIONS as readonly string[]).includes(condition)) {
    return redirectError(`/staff/dentist/consultations/${dentalVisitId}`, "Select a valid tooth and condition.");
  }

  const supabase = await createClient();
  const now = nowIso();
  const { error } = await supabase.from("tooth_findings").upsert(
    {
      id: crypto.randomUUID(),
      patient_id: visit.patient_id,
      dental_visit_id: dentalVisitId,
      tooth_number: toothNumber,
      dentition: Number(toothNumber[0]) >= 5 && Number(toothNumber[0]) <= 8 ? "primary" : "permanent",
      condition,
      status: "Planned",
      created_at: now,
      updated_at: now,
    },
    { onConflict: "dental_visit_id,tooth_number" },
  );

  if (error) return redirectError(`/staff/dentist/consultations/${dentalVisitId}`, "The tooth finding could not be updated.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.tooth_quick_update",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId: visit.patient_id,
    details: `Quick-updated tooth ${toothNumber} to ${condition}.`,
  });
  redirectSuccess(`/staff/dentist/consultations/${dentalVisitId}`, `Tooth ${toothNumber} updated.`);
}

export async function startDentalForPatientAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const patientId = text(formData, "patientId", 60);
  const patient = await getPatient(patientId);
  if (!patient) return redirectError("/staff/dentist/patients", "Patient not found.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("dental_visits")
    .select("id, visits!inner(appointment_id, status)")
    .eq("patient_id", patientId)
    .eq("doctor_id", user.id)
    .is("visits.appointment_id", null)
    .eq("visits.status", "In Consultation")
    .gte("created_at", `${clinicToday()}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return redirectSuccess(`/staff/dentist/consultations/${existing.id}`, "Continuing today's dental record.");

  const now = nowIso();
  const visitId = crypto.randomUUID();
  const dentalVisitId = crypto.randomUUID();

  const { error: visitError } = await supabase.from("visits").insert({
    id: visitId,
    patient_id: patientId,
    appointment_id: null,
    department: "dental",
    doctor_id: user.id,
    status: "In Consultation",
    started_at: now,
    created_at: now,
  });
  if (visitError) return redirectError("/staff/dentist/patients", "The dental record could not be started.");

  const { error: dentalError } = await supabase.from("dental_visits").insert({
    id: dentalVisitId,
    patient_id: patientId,
    visit_id: visitId,
    doctor_id: user.id,
    visit_date: clinicToday(),
    presenting_complaint: null,
    created_at: now,
    updated_at: now,
  });
  if (dentalError) return redirectError("/staff/dentist/patients", "The dental record could not be started.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "dental.consultation_start_walk_in",
    entityType: "dental_record",
    entityId: dentalVisitId,
    patientId,
    details: `Started unscheduled dental consultation for ${patient.patient_number}.`,
  });
  redirectSuccess(`/staff/dentist/consultations/${dentalVisitId}`, "Dental record started.");
}
