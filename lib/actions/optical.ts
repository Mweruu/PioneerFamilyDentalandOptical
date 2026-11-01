"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { db } from "../db";
import { getAppointment, getOpticalVisit, getPatient } from "../data/queries";
import { clinicToday, nowIso } from "../utils";
import {
  formReturnPath,
  isValidDate,
  multiText,
  optionalText,
  redirectError,
  redirectSuccess,
  text,
} from "./helpers";

function ownedOpticalVisit(id: string, doctorId: string) {
  const visit = getOpticalVisit(id);
  if (!visit) throw new Error("Optical visit not found.");
  if (visit.doctor_id !== doctorId) throw new Error("You can only edit optical records you created.");
  return visit;
}

function validAxis(value: string | null) {
  if (!value) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 180;
}

export async function startOpticalConsultationAction(formData: FormData) {
  const user = await requireStaffApi("eye_doctor");
  const appointmentId = text(formData, "appointmentId", 60);
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/optometrist", "Appointment not found.");
  if (appointment.department !== "optical") return redirectError("/staff/optometrist", "That appointment is not an optical visit.");
  if (appointment.doctor_id !== user.id) return redirectError("/staff/optometrist", "That appointment is assigned to another eye doctor.");
  if (["Cancelled", "No Show", "Completed"].includes(appointment.status)) {
    return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "This appointment can no longer be started.");
  }
  if (!appointment.patient_id) {
    return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "Reception must link this booking to a patient record first.");
  }

  const now = nowIso();
  let visit = db
    .prepare("SELECT id, started_at FROM visits WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(appointmentId) as { id: string; started_at: string | null } | undefined;

  const existingOptical = visit
    ? (db.prepare("SELECT id FROM optical_visits WHERE visit_id = ?").get(visit.id) as { id: string } | undefined)
    : undefined;
  if (existingOptical) {
    return redirectSuccess(`/staff/optometrist/consultations/${existingOptical.id}`, "Consultation already in progress.");
  }

  const opticalVisitId = `ov_${crypto.randomUUID()}`;

  db.transaction(() => {
    if (!visit) {
      visit = { id: `vis_${crypto.randomUUID()}`, started_at: now };
      db.prepare(`
        INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
        VALUES (?, ?, ?, 'optical', ?, 'In Consultation', ?, ?)
      `).run(visit.id, appointment.patient_id, appointmentId, user.id, now, now);
    } else {
      db.prepare("UPDATE visits SET status = 'In Consultation', doctor_id = ?, started_at = COALESCE(started_at, ?) WHERE id = ?").run(
        user.id,
        now,
        visit.id,
      );
    }

    db.prepare(`
      INSERT INTO optical_visits (id, patient_id, visit_id, doctor_id, visit_date, presenting_complaint, symptoms,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(opticalVisitId, appointment.patient_id, visit.id, user.id, clinicToday(), appointment.reason, now, now);

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
    action: "optical.consultation_start",
    entityType: "optical_record",
    entityId: opticalVisitId,
    patientId: appointment.patient_id,
    details: `Started optical consultation for ${appointment.reference}.`,
  });

  redirectSuccess(`/staff/optometrist/consultations/${opticalVisitId}`, "Eye examination started.");
}

export async function saveOpticalVisitAction(formData: FormData) {
  const user = await requireStaffApi("eye_doctor");
  const opticalVisitId = text(formData, "opticalVisitId", 60);
  const visit = ownedOpticalVisit(opticalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/optometrist/consultations/${opticalVisitId}`);
  const followUpDate = optionalText(formData, "followUpDate", 10);
  if (followUpDate && !isValidDate(followUpDate)) return redirectError(returnTo, "Enter a valid follow-up date.");

  const symptoms = multiText(formData, "symptoms", 80);
  const iopOd = optionalText(formData, "iopOd", 20);
  const iopOs = optionalText(formData, "iopOs", 20);
  if (iopOd && !/^\d{1,2}(\.\d{1,2})?$/.test(iopOd)) return redirectError(returnTo, "Enter a valid right-eye IOP.");
  if (iopOs && !/^\d{1,2}(\.\d{1,2})?$/.test(iopOs)) return redirectError(returnTo, "Enter a valid left-eye IOP.");

  db.prepare(`
    UPDATE optical_visits SET presenting_complaint = ?, symptoms = ?, unaided_va_od = ?, unaided_va_os = ?,
      pinhole_va_od = ?, pinhole_va_os = ?, corrected_va_od = ?, corrected_va_os = ?, external_examination = ?,
      anterior_segment = ?, posterior_segment = ?, iop_od = ?, iop_os = ?, colour_vision = ?, diagnosis = ?,
      management_plan = ?, referral = ?, follow_up_date = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    optionalText(formData, "presentingComplaint", 2000),
    symptoms.length ? JSON.stringify(symptoms) : null,
    optionalText(formData, "unaidedVaOd", 20),
    optionalText(formData, "unaidedVaOs", 20),
    optionalText(formData, "pinholeVaOd", 20),
    optionalText(formData, "pinholeVaOs", 20),
    optionalText(formData, "correctedVaOd", 20),
    optionalText(formData, "correctedVaOs", 20),
    optionalText(formData, "externalExamination", 2000),
    optionalText(formData, "anteriorSegment", 2000),
    optionalText(formData, "posteriorSegment", 2000),
    iopOd,
    iopOs,
    optionalText(formData, "colourVision", 200),
    optionalText(formData, "diagnosis", 2000),
    optionalText(formData, "managementPlan", 3000),
    optionalText(formData, "referral", 1000),
    followUpDate,
    optionalText(formData, "notes", 2000),
    nowIso(),
    opticalVisitId,
  );

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "optical.exam_update",
    entityType: "optical_record",
    entityId: opticalVisitId,
    patientId: visit.patient_id,
    details: "Updated optical examination record.",
  });

  redirectSuccess(returnTo, "Eye examination saved.");
}

export async function savePrescriptionAction(formData: FormData) {
  const user = await requireStaffApi("eye_doctor");
  const opticalVisitId = text(formData, "opticalVisitId", 60);
  const visit = ownedOpticalVisit(opticalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/optometrist/consultations/${opticalVisitId}`);

  const odAxis = optionalText(formData, "odAxis", 10);
  const osAxis = optionalText(formData, "osAxis", 10);
  if (!validAxis(odAxis)) return redirectError(returnTo, "Right-eye axis must be between 0 and 180.");
  if (!validAxis(osAxis)) return redirectError(returnTo, "Left-eye axis must be between 0 and 180.");

  const odSph = optionalText(formData, "odSph", 20);
  const osSph = optionalText(formData, "osSph", 20);
  if (!odSph && !osSph) return redirectError(returnTo, "Enter at least one spherical value for the prescription.");

  db.prepare(`
    INSERT INTO optical_prescriptions (id, patient_id, optical_visit_id, doctor_id, od_sph, od_cyl, od_axis,
      od_add, od_prism, od_base, os_sph, os_cyl, os_axis, os_add, os_prism, os_base, pd, pd_od, pd_os,
      lens_type, lens_recommendation, frame_recommendation, notes, prescribed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `rx_${crypto.randomUUID()}`,
    visit.patient_id,
    opticalVisitId,
    user.id,
    odSph,
    optionalText(formData, "odCyl", 20),
    odAxis,
    optionalText(formData, "odAdd", 20),
    optionalText(formData, "odPrism", 20),
    optionalText(formData, "odBase", 20),
    osSph,
    optionalText(formData, "osCyl", 20),
    osAxis,
    optionalText(formData, "osAdd", 20),
    optionalText(formData, "osPrism", 20),
    optionalText(formData, "osBase", 20),
    optionalText(formData, "pd", 20),
    optionalText(formData, "pdOd", 20),
    optionalText(formData, "pdOs", 20),
    optionalText(formData, "lensType", 100),
    optionalText(formData, "lensRecommendation", 1000),
    optionalText(formData, "frameRecommendation", 1000),
    optionalText(formData, "notes", 1000),
    nowIso(),
    nowIso(),
  );

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "optical.prescription_create",
    entityType: "optical_record",
    entityId: opticalVisitId,
    patientId: visit.patient_id,
    details: "Issued a spectacle prescription.",
  });

  redirectSuccess(returnTo, "Spectacle prescription issued.");
}

export async function completeOpticalConsultationAction(formData: FormData) {
  const user = await requireStaffApi("eye_doctor");
  const opticalVisitId = text(formData, "opticalVisitId", 60);
  const visit = ownedOpticalVisit(opticalVisitId, user.id);
  const returnTo = `/staff/optometrist/patients/${visit.patient_id}`;
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
    action: "optical.consultation_complete",
    entityType: "optical_record",
    entityId: opticalVisitId,
    patientId: visit.patient_id,
    details: "Completed optical consultation.",
  });

  redirectSuccess(returnTo, "Optical consultation completed.");
}

export async function startOpticalForPatientAction(formData: FormData) {
  const user = await requireStaffApi("eye_doctor");
  const patientId = text(formData, "patientId", 60);
  const patient = getPatient(patientId);
  if (!patient) return redirectError("/staff/optometrist/patients", "Patient not found.");

  const existing = db
    .prepare(`
      SELECT ov.id
      FROM optical_visits ov
      JOIN visits v ON v.id = ov.visit_id
      WHERE ov.patient_id = ? AND ov.doctor_id = ? AND v.appointment_id IS NULL
        AND v.status = 'In Consultation' AND ov.created_at >= ?
      ORDER BY ov.created_at DESC LIMIT 1
    `)
    .get(patientId, user.id, `${clinicToday()}T00:00:00`) as { id: string } | undefined;
  if (existing) return redirectSuccess(`/staff/optometrist/consultations/${existing.id}`, "Continuing today's optical record.");

  const now = nowIso();
  const visitId = `vis_${crypto.randomUUID()}`;
  const opticalVisitId = `ov_${crypto.randomUUID()}`;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
      VALUES (?, ?, NULL, 'optical', ?, 'In Consultation', ?, ?)
    `).run(visitId, patientId, user.id, now, now);
    db.prepare(`
      INSERT INTO optical_visits (id, patient_id, visit_id, doctor_id, visit_date, presenting_complaint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(opticalVisitId, patientId, visitId, user.id, clinicToday(), now, now);
  })();

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "optical.consultation_start_walk_in",
    entityType: "optical_record",
    entityId: opticalVisitId,
    patientId,
    details: `Started unscheduled optical consultation for ${patient.patient_number}.`,
  });
  redirectSuccess(`/staff/optometrist/consultations/${opticalVisitId}`, "Optical record started.");
}
