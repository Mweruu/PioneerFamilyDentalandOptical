"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { db } from "../db";
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

function ownedDentalVisit(id: string, doctorId: string) {
  const visit = getDentalVisit(id);
  if (!visit) throw new Error("Dental visit not found.");
  if (visit.doctor_id !== doctorId) throw new Error("You can only edit dental records you created.");
  return visit;
}

export async function startDentalConsultationAction(formData: FormData) {
  const user = await requireStaffApi("dentist");
  const appointmentId = text(formData, "appointmentId", 60);
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/dentist", "Appointment not found.");
  if (appointment.department !== "dental") return redirectError("/staff/dentist", "That appointment is not a dental visit.");
  if (appointment.doctor_id !== user.id) return redirectError("/staff/dentist", "That appointment is assigned to another dentist.");
  if (["Cancelled", "No Show", "Completed"].includes(appointment.status)) {
    return redirectError(`/staff/dentist/appointments/${appointmentId}`, "This appointment can no longer be started.");
  }
  if (!appointment.patient_id) {
    return redirectError(`/staff/dentist/appointments/${appointmentId}`, "Reception must link this booking to a patient record first.");
  }

  const now = nowIso();
  let visit = db
    .prepare("SELECT id, started_at FROM visits WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(appointmentId) as { id: string; started_at: string | null } | undefined;

  const existingDental = visit
    ? (db.prepare("SELECT id FROM dental_visits WHERE visit_id = ?").get(visit.id) as { id: string } | undefined)
    : undefined;
  if (existingDental) {
    return redirectSuccess(`/staff/dentist/consultations/${existingDental.id}`, "Consultation already in progress.");
  }

  const dentalVisitId = `dv_${crypto.randomUUID()}`;

  db.transaction(() => {
    if (!visit) {
      visit = { id: `vis_${crypto.randomUUID()}`, started_at: now };
      db.prepare(`
        INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
        VALUES (?, ?, ?, 'dental', ?, 'In Consultation', ?, ?)
      `).run(visit.id, appointment.patient_id, appointmentId, user.id, now, now);
    } else {
      db.prepare("UPDATE visits SET status = 'In Consultation', doctor_id = ?, started_at = COALESCE(started_at, ?) WHERE id = ?").run(
        user.id,
        now,
        visit.id,
      );
    }

    db.prepare(`
      INSERT INTO dental_visits (id, patient_id, visit_id, doctor_id, visit_date, presenting_complaint,
        history, examination_findings, diagnosis, treatment_performed, medications, advice, follow_up, notes,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
    `).run(
      dentalVisitId,
      appointment.patient_id,
      visit.id,
      user.id,
      clinicToday(),
      appointment.reason,
      now,
      now,
    );

    db.prepare("UPDATE appointments SET status = 'In Consultation', checked_in_at = COALESCE(checked_in_at, ?), updated_at = ? WHERE id = ?").run(
      now,
      now,
      appointmentId,
    );
  })();

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
  const visit = ownedDentalVisit(dentalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/dentist/consultations/${dentalVisitId}`);

  db.prepare(`
    UPDATE dental_visits SET presenting_complaint = ?, history = ?, examination_findings = ?, diagnosis = ?,
      treatment_performed = ?, medications = ?, advice = ?, follow_up = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    optionalText(formData, "presentingComplaint", 2000),
    optionalText(formData, "history", 4000),
    optionalText(formData, "examinationFindings", 4000),
    optionalText(formData, "diagnosis", 2000),
    optionalText(formData, "treatmentPerformed", 4000),
    optionalText(formData, "medications", 2000),
    optionalText(formData, "advice", 2000),
    optionalText(formData, "followUp", 2000),
    optionalText(formData, "notes", 2000),
    nowIso(),
    dentalVisitId,
  );

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
  const visit = ownedDentalVisit(dentalVisitId, user.id);
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

  const existing = db
    .prepare("SELECT id FROM tooth_findings WHERE dental_visit_id = ? AND tooth_number = ?")
    .get(dentalVisitId, toothNumber) as { id: string } | undefined;

  const now = nowIso();
  if (existing) {
    db.prepare(`
      UPDATE tooth_findings SET dentition = ?, condition = ?, surfaces = ?, diagnosis = ?, planned_treatment = ?,
        treatment_performed = ?, treatment_date = ?, notes = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dentition,
      condition,
      surfaces.length ? JSON.stringify(surfaces) : null,
      optionalText(formData, "diagnosis", 1000),
      optionalText(formData, "plannedTreatment", 1000),
      optionalText(formData, "treatmentPerformed", 1000),
      treatmentDate,
      optionalText(formData, "notes", 1000),
      status,
      now,
      existing.id,
    );
  } else {
    db.prepare(`
      INSERT INTO tooth_findings (id, patient_id, dental_visit_id, tooth_number, dentition, condition, surfaces,
        diagnosis, planned_treatment, treatment_performed, treatment_date, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tf_${crypto.randomUUID()}`,
      visit.patient_id,
      dentalVisitId,
      toothNumber,
      dentition,
      condition,
      surfaces.length ? JSON.stringify(surfaces) : null,
      optionalText(formData, "diagnosis", 1000),
      optionalText(formData, "plannedTreatment", 1000),
      optionalText(formData, "treatmentPerformed", 1000),
      treatmentDate,
      optionalText(formData, "notes", 1000),
      status,
      now,
      now,
    );
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
  const finding = getToothFinding(findingId);
  if (!finding) return redirectError("/staff/dentist", "Tooth finding not found.");
  const visit = ownedDentalVisit(finding.dental_visit_id, user.id);
  const returnTo = formReturnPath(formData, `/staff/dentist/consultations/${finding.dental_visit_id}`);

  db.prepare("DELETE FROM tooth_findings WHERE id = ?").run(findingId);
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
  const patient = getPatient(patientId);
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
    const visit = ownedDentalVisit(dentalVisitId, user.id);
    if (visit.patient_id !== patientId) return redirectError(returnTo, "The dental visit does not belong to this patient.");
  }

  const now = nowIso();
  if (planId) {
    const plan = getTreatmentPlan(planId);
    if (!plan || plan.created_by !== user.id || plan.patient_id !== patientId) {
      return redirectError(returnTo, "You can only edit treatment plans you created for this patient.");
    }
    db.prepare(`
      UPDATE treatment_plans SET dental_visit_id = ?, tooth_numbers = ?, diagnosis = ?, procedure = ?, priority = ?,
        estimated_cost = ?, status = ?, notes = ?, next_review_date = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dentalVisitId,
      toothNumbers,
      diagnosis,
      procedure,
      priority,
      estimatedCost,
      status,
      optionalText(formData, "notes", 2000),
      nextReview,
      now,
      planId,
    );
  } else {
    db.prepare(`
      INSERT INTO treatment_plans (id, patient_id, dental_visit_id, tooth_numbers, diagnosis, procedure, priority,
        estimated_cost, status, notes, next_review_date, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tp_${crypto.randomUUID()}`,
      patientId,
      dentalVisitId,
      toothNumbers,
      diagnosis,
      procedure,
      priority,
      estimatedCost,
      status,
      optionalText(formData, "notes", 2000),
      nextReview,
      user.id,
      now,
      now,
    );
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
  const plan = getTreatmentPlan(planId);
  if (!plan) return redirectError("/staff/dentist", "Treatment plan not found.");
  if (plan.created_by !== user.id) return redirectError(`/staff/dentist/patients/${plan.patient_id}`, "Only the dentist who created this plan can update it.");
  if (!["Planned", "In Progress", "Completed", "Cancelled"].includes(status)) {
    return redirectError(`/staff/dentist/patients/${plan.patient_id}`, "Select a valid plan status.");
  }
  db.prepare("UPDATE treatment_plans SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), planId);
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
  const visit = ownedDentalVisit(dentalVisitId, user.id);
  const returnTo = `/staff/dentist/patients/${visit.patient_id}`;
  const now = nowIso();

  db.transaction(() => {
    if (visit.visit_id) {
      db.prepare("UPDATE visits SET status = 'Completed', completed_at = ? WHERE id = ?").run(now, visit.visit_id);
      const linked = db.prepare("SELECT appointment_id FROM visits WHERE id = ?").get(visit.visit_id) as
        | { appointment_id: string | null }
        | undefined;
      if (linked?.appointment_id) {
        db.prepare("UPDATE appointments SET status = 'Completed', updated_at = ? WHERE id = ?").run(now, linked.appointment_id);
      }
    }
  })();

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
  const visit = ownedDentalVisit(dentalVisitId, user.id);
  const toothNumber = text(formData, "toothNumber", 4);
  const condition = text(formData, "condition", 80);
  if (!VALID_TEETH.has(toothNumber) || !(TOOTH_CONDITIONS as readonly string[]).includes(condition)) {
    return redirectError(`/staff/dentist/consultations/${dentalVisitId}`, "Select a valid tooth and condition.");
  }
  const now = nowIso();
  db.prepare(`
    INSERT INTO tooth_findings (id, patient_id, dental_visit_id, tooth_number, dentition, condition, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Planned', ?, ?)
    ON CONFLICT(dental_visit_id, tooth_number)
    DO UPDATE SET condition = excluded.condition, updated_at = excluded.updated_at
  `).run(
    `tf_${crypto.randomUUID()}`,
    visit.patient_id,
    dentalVisitId,
    toothNumber,
    Number(toothNumber[0]) >= 5 && Number(toothNumber[0]) <= 8 ? "primary" : "permanent",
    condition,
    now,
    now,
  );
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
  const patient = getPatient(patientId);
  if (!patient) return redirectError("/staff/dentist/patients", "Patient not found.");

  const existing = db
    .prepare(`
      SELECT dv.id
      FROM dental_visits dv
      JOIN visits v ON v.id = dv.visit_id
      WHERE dv.patient_id = ? AND dv.doctor_id = ? AND v.appointment_id IS NULL
        AND v.status = 'In Consultation' AND dv.created_at >= ?
      ORDER BY dv.created_at DESC LIMIT 1
    `)
    .get(patientId, user.id, `${clinicToday()}T00:00:00`) as { id: string } | undefined;
  if (existing) return redirectSuccess(`/staff/dentist/consultations/${existing.id}`, "Continuing today's dental record.");

  const now = nowIso();
  const visitId = `vis_${crypto.randomUUID()}`;
  const dentalVisitId = `dv_${crypto.randomUUID()}`;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
      VALUES (?, ?, NULL, 'dental', ?, 'In Consultation', ?, ?)
    `).run(visitId, patientId, user.id, now, now);
    db.prepare(`
      INSERT INTO dental_visits (id, patient_id, visit_id, doctor_id, visit_date, presenting_complaint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(dentalVisitId, patientId, visitId, user.id, clinicToday(), now, now);
  })();

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
