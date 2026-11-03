"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { createClient } from "../supabase/server";
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

async function ownedOpticalVisit(id: string, doctorId: string) {
  const visit = await getOpticalVisit(id);
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
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/optometrist", "Appointment not found.");
  if (appointment.department !== "optical") return redirectError("/staff/optometrist", "That appointment is not an optical visit.");
  if (appointment.doctor_id !== user.id) return redirectError("/staff/optometrist", "That appointment is assigned to another eye doctor.");
  if (["Cancelled", "No Show", "Completed"].includes(appointment.status)) {
    return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "This appointment can no longer be started.");
  }
  if (!appointment.patient_id) {
    return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "Reception must link this booking to a patient record first.");
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
    const { data: existingOptical } = await supabase
      .from("optical_visits")
      .select("id")
      .eq("visit_id", visit.id)
      .maybeSingle();
    if (existingOptical) {
      return redirectSuccess(`/staff/optometrist/consultations/${existingOptical.id}`, "Consultation already in progress.");
    }
  }

  const opticalVisitId = crypto.randomUUID();
  let visitId = visit?.id ?? null;

  if (visitId) {
    const { error } = await supabase
      .from("visits")
      .update({ status: "In Consultation", doctor_id: user.id, started_at: visit?.started_at ?? now })
      .eq("id", visitId);
    if (error) return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "The consultation could not be started.");
  } else {
    visitId = crypto.randomUUID();
    const { error } = await supabase.from("visits").insert({
      id: visitId,
      patient_id: appointment.patient_id,
      appointment_id: appointmentId,
      department: "optical",
      doctor_id: user.id,
      status: "In Consultation",
      started_at: now,
      created_at: now,
    });
    if (error) return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "The consultation could not be started.");
  }

  const { error: opticalError } = await supabase.from("optical_visits").insert({
    id: opticalVisitId,
    patient_id: appointment.patient_id,
    visit_id: visitId,
    doctor_id: user.id,
    visit_date: clinicToday(),
    presenting_complaint: appointment.reason,
    symptoms: null,
    created_at: now,
    updated_at: now,
  });
  if (opticalError) return redirectError(`/staff/optometrist/appointments/${appointmentId}`, "The optical record could not be created.");

  await supabase
    .from("appointments")
    .update({ status: "In Consultation", checked_in_at: appointment.checked_in_at ?? now, updated_at: now })
    .eq("id", appointmentId);

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
  const visit = await ownedOpticalVisit(opticalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/optometrist/consultations/${opticalVisitId}`);
  const followUpDate = optionalText(formData, "followUpDate", 10);
  if (followUpDate && !isValidDate(followUpDate)) return redirectError(returnTo, "Enter a valid follow-up date.");

  const symptoms = multiText(formData, "symptoms", 80);
  const iopOd = optionalText(formData, "iopOd", 20);
  const iopOs = optionalText(formData, "iopOs", 20);
  if (iopOd && !/^\d{1,2}(\.\d{1,2})?$/.test(iopOd)) return redirectError(returnTo, "Enter a valid right-eye IOP.");
  if (iopOs && !/^\d{1,2}(\.\d{1,2})?$/.test(iopOs)) return redirectError(returnTo, "Enter a valid left-eye IOP.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("optical_visits")
    .update({
      presenting_complaint: optionalText(formData, "presentingComplaint", 2000),
      symptoms: symptoms.length ? symptoms : null,
      unaided_va_od: optionalText(formData, "unaidedVaOd", 20),
      unaided_va_os: optionalText(formData, "unaidedVaOs", 20),
      pinhole_va_od: optionalText(formData, "pinholeVaOd", 20),
      pinhole_va_os: optionalText(formData, "pinholeVaOs", 20),
      corrected_va_od: optionalText(formData, "correctedVaOd", 20),
      corrected_va_os: optionalText(formData, "correctedVaOs", 20),
      external_examination: optionalText(formData, "externalExamination", 2000),
      anterior_segment: optionalText(formData, "anteriorSegment", 2000),
      posterior_segment: optionalText(formData, "posteriorSegment", 2000),
      iop_od: iopOd,
      iop_os: iopOs,
      colour_vision: optionalText(formData, "colourVision", 200),
      diagnosis: optionalText(formData, "diagnosis", 2000),
      management_plan: optionalText(formData, "managementPlan", 3000),
      referral: optionalText(formData, "referral", 1000),
      follow_up_date: followUpDate,
      notes: optionalText(formData, "notes", 2000),
      updated_at: nowIso(),
    })
    .eq("id", opticalVisitId);

  if (error) return redirectError(returnTo, "The eye examination could not be saved. Please try again.");

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
  const visit = await ownedOpticalVisit(opticalVisitId, user.id);
  const returnTo = formReturnPath(formData, `/staff/optometrist/consultations/${opticalVisitId}`);

  const odAxis = optionalText(formData, "odAxis", 10);
  const osAxis = optionalText(formData, "osAxis", 10);
  if (!validAxis(odAxis)) return redirectError(returnTo, "Right-eye axis must be between 0 and 180.");
  if (!validAxis(osAxis)) return redirectError(returnTo, "Left-eye axis must be between 0 and 180.");

  const odSph = optionalText(formData, "odSph", 20);
  const osSph = optionalText(formData, "osSph", 20);
  if (!odSph && !osSph) return redirectError(returnTo, "Enter at least one spherical value for the prescription.");

  const supabase = await createClient();
  const now = nowIso();
  const { error } = await supabase.from("optical_prescriptions").insert({
    id: crypto.randomUUID(),
    patient_id: visit.patient_id,
    optical_visit_id: opticalVisitId,
    doctor_id: user.id,
    od_sph: odSph,
    od_cyl: optionalText(formData, "odCyl", 20),
    od_axis: odAxis,
    od_add: optionalText(formData, "odAdd", 20),
    od_prism: optionalText(formData, "odPrism", 20),
    od_base: optionalText(formData, "odBase", 20),
    os_sph: osSph,
    os_cyl: optionalText(formData, "osCyl", 20),
    os_axis: osAxis,
    os_add: optionalText(formData, "osAdd", 20),
    os_prism: optionalText(formData, "osPrism", 20),
    os_base: optionalText(formData, "osBase", 20),
    pd: optionalText(formData, "pd", 20),
    pd_od: optionalText(formData, "pdOd", 20),
    pd_os: optionalText(formData, "pdOs", 20),
    lens_type: optionalText(formData, "lensType", 100),
    lens_recommendation: optionalText(formData, "lensRecommendation", 1000),
    frame_recommendation: optionalText(formData, "frameRecommendation", 1000),
    notes: optionalText(formData, "notes", 1000),
    prescribed_at: now,
    created_at: now,
  });

  if (error) return redirectError(returnTo, "The prescription could not be saved. Please try again.");

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
  const visit = await ownedOpticalVisit(opticalVisitId, user.id);
  const returnTo = `/staff/optometrist/patients/${visit.patient_id}`;
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
  const patient = await getPatient(patientId);
  if (!patient) return redirectError("/staff/optometrist/patients", "Patient not found.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("optical_visits")
    .select("id, visits!inner(appointment_id, status)")
    .eq("patient_id", patientId)
    .eq("doctor_id", user.id)
    .is("visits.appointment_id", null)
    .eq("visits.status", "In Consultation")
    .gte("created_at", `${clinicToday()}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return redirectSuccess(`/staff/optometrist/consultations/${existing.id}`, "Continuing today's optical record.");

  const now = nowIso();
  const visitId = crypto.randomUUID();
  const opticalVisitId = crypto.randomUUID();

  const { error: visitError } = await supabase.from("visits").insert({
    id: visitId,
    patient_id: patientId,
    appointment_id: null,
    department: "optical",
    doctor_id: user.id,
    status: "In Consultation",
    started_at: now,
    created_at: now,
  });
  if (visitError) return redirectError("/staff/optometrist/patients", "The optical record could not be started.");

  const { error: opticalError } = await supabase.from("optical_visits").insert({
    id: opticalVisitId,
    patient_id: patientId,
    visit_id: visitId,
    doctor_id: user.id,
    visit_date: clinicToday(),
    presenting_complaint: null,
    created_at: now,
    updated_at: now,
  });
  if (opticalError) return redirectError("/staff/optometrist/patients", "The optical record could not be started.");

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
