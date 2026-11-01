"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { db } from "../db";
import { queueAppointmentNotification } from "../notifications";
import {
  getAppointment,
  getAvailableSlots,
  getDoctorSchedule,
  getPatient,
  hasAppointmentOverlap,
} from "../data/queries";
import type { AppointmentStatus, Department } from "../types";
import { APPOINTMENT_STATUSES } from "../types";
import {
  addMinutesToTime,
  calculateBmi,
  clinicToday,
  formatDate,
  formatTime,
  nowIso,
  reference,
} from "../utils";
import {
  formReturnPath,
  intOrNull,
  isValidDate,
  isValidTime,
  multiText,
  numberOrNull,
  optionalText,
  redirectError,
  redirectSuccess,
  text,
} from "./helpers";

function nextPatientNumber() {
  const year = clinicToday().slice(0, 4);
  const prefix = `PFC-${year}-`;
  const row = db
    .prepare("SELECT patient_number FROM patients WHERE patient_number LIKE ? ORDER BY patient_number DESC LIMIT 1")
    .get(`${prefix}%`) as { patient_number: string } | undefined;
  const last = row ? Number(row.patient_number.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(4, "0")}`;
}

function requirePatient(id: string) {
  const patient = getPatient(id);
  if (!patient) throw new Error("Patient record not found.");
  return patient;
}

export async function registerPatientAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const returnTo = formReturnPath(formData, "/staff/receptionist/patients");

  const fullName = text(formData, "fullName", 120);
  const phone = text(formData, "phone", 30);
  const email = optionalText(formData, "email", 160);
  const dateOfBirth = optionalText(formData, "dateOfBirth", 10);
  const gender = optionalText(formData, "gender", 30);
  const address = optionalText(formData, "address", 300);
  const emergencyName = optionalText(formData, "emergencyContactName", 120);
  const emergencyPhone = optionalText(formData, "emergencyContactPhone", 30);
  const allergies = optionalText(formData, "allergies", 1000);
  const medicalHistory = optionalText(formData, "medicalHistory", 3000);
  const medications = optionalText(formData, "medications", 2000);
  const conditions = optionalText(formData, "conditions", 2000);
  const adminNotes = optionalText(formData, "adminNotes", 2000);
  const appointmentId = optionalText(formData, "appointmentId", 60);

  if (fullName.length < 2) return redirectError(returnTo, "Enter the patient's full name.");
  if (phone.replace(/\D/g, "").length < 7) return redirectError(returnTo, "Enter a valid phone number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return redirectError(returnTo, "Enter a valid email address.");
  if (dateOfBirth && !isValidDate(dateOfBirth)) return redirectError(returnTo, "Enter a valid date of birth.");

  const duplicate = db
    .prepare("SELECT id FROM patients WHERE lower(full_name) = lower(?) AND phone = ?")
    .get(fullName, phone) as { id: string } | undefined;
  if (duplicate) {
    return redirectError(returnTo, "A patient with this name and phone number already exists. Open the existing record instead.");
  }

  const id = `pat_${crypto.randomUUID()}`;
  const now = nowIso();
  const patientNumber = nextPatientNumber();

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO patients (id, patient_number, full_name, phone, email, date_of_birth, gender, address,
          emergency_contact_name, emergency_contact_phone, allergies, medical_history, medications, conditions,
          admin_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        patientNumber,
        fullName,
        phone,
        email,
        dateOfBirth,
        gender,
        address,
        emergencyName,
        emergencyPhone,
        allergies,
        medicalHistory,
        medications,
        conditions,
        adminNotes,
        now,
        now,
      );
      if (appointmentId) {
        const appointment = db.prepare("SELECT id, patient_id FROM appointments WHERE id = ?").get(appointmentId) as
          | { id: string; patient_id: string | null }
          | undefined;
        if (appointment && !appointment.patient_id) {
          db.prepare("UPDATE appointments SET patient_id = ?, patient_type = 'new', updated_at = ? WHERE id = ?").run(
            id,
            now,
            appointmentId,
          );
        }
      }
    })();
  } catch {
    return redirectError(returnTo, "The patient could not be registered. Please try again.");
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.register",
    entityType: "patient",
    entityId: id,
    patientId: id,
    details: `Registered patient ${patientNumber} (${fullName}).`,
  });

  redirectSuccess(`/staff/receptionist/patients/${id}`, `Patient ${patientNumber} registered.`);
}

export async function updatePatientAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const patientId = text(formData, "patientId", 60);
  const patient = requirePatient(patientId);
  const returnTo = `/staff/receptionist/patients/${patientId}`;

  const fullName = text(formData, "fullName", 120);
  const phone = text(formData, "phone", 30);
  if (fullName.length < 2) return redirectError(returnTo, "Enter the patient's full name.");
  if (phone.replace(/\D/g, "").length < 7) return redirectError(returnTo, "Enter a valid phone number.");

  db.prepare(`
    UPDATE patients SET full_name = ?, phone = ?, email = ?, date_of_birth = ?, gender = ?, address = ?,
      emergency_contact_name = ?, emergency_contact_phone = ?, allergies = ?, medical_history = ?,
      medications = ?, conditions = ?, admin_notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    fullName,
    phone,
    optionalText(formData, "email", 160),
    optionalText(formData, "dateOfBirth", 10),
    optionalText(formData, "gender", 30),
    optionalText(formData, "address", 300),
    optionalText(formData, "emergencyContactName", 120),
    optionalText(formData, "emergencyContactPhone", 30),
    optionalText(formData, "allergies", 1000),
    optionalText(formData, "medicalHistory", 3000),
    optionalText(formData, "medications", 2000),
    optionalText(formData, "conditions", 2000),
    optionalText(formData, "adminNotes", 2000),
    nowIso(),
    patientId,
  );

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.update",
    entityType: "patient",
    entityId: patientId,
    patientId,
    details: `Updated master record for ${patient.patient_number}.`,
  });

  redirectSuccess(returnTo, "Patient record updated.");
}

export async function linkAppointmentPatientAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const appointmentId = text(formData, "appointmentId", 60);
  const patientId = text(formData, "patientId", 60);
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  const patient = requirePatient(patientId);
  const returnTo = `/staff/receptionist/appointments/${appointmentId}`;

  if (appointment.patient_id) return redirectError(returnTo, "This appointment is already linked to a patient record.");

  db.prepare("UPDATE appointments SET patient_id = ?, updated_at = ? WHERE id = ?").run(patientId, nowIso(), appointmentId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.link_patient",
    entityType: "appointment",
    entityId: appointmentId,
    patientId,
    details: `Linked appointment ${appointment.reference} to ${patient.patient_number}.`,
  });
  redirectSuccess(returnTo, "Appointment linked to the patient record.");
}

export async function createAppointmentAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const returnTo = formReturnPath(formData, "/staff/receptionist/appointments/new");

  const patientId = text(formData, "patientId", 60);
  const department = text(formData, "department", 20) as Department;
  const doctorId = text(formData, "doctorId", 60);
  const serviceId = text(formData, "serviceId", 60);
  const date = text(formData, "date", 10);
  const time = text(formData, "time", 5);
  const reason = text(formData, "reason", 1000);
  const notes = optionalText(formData, "notes", 1000);
  const patientType = text(formData, "patientType", 20) === "returning" ? "returning" : "new";

  if (!patientId) return redirectError(returnTo, "Select a registered patient.");
  const patient = getPatient(patientId);
  if (!patient) return redirectError(returnTo, "Patient record not found.");
  if (!["dental", "optical"].includes(department)) return redirectError(returnTo, "Select a department.");
  if (!isValidDate(date) || date < clinicToday()) return redirectError(returnTo, "Choose today or a future date.");
  if (!isValidTime(time)) return redirectError(returnTo, "Choose an available time.");
  if (reason.length < 3) return redirectError(returnTo, "Enter the reason for the visit.");

  const doctor = db
    .prepare("SELECT id, name, role, active FROM staff WHERE id = ?")
    .get(doctorId) as { id: string; name: string; role: string; active: number } | undefined;
  const expectedRole = department === "dental" ? "dentist" : "eye_doctor";
  if (!doctor || !doctor.active || doctor.role !== expectedRole) {
    return redirectError(returnTo, "Select an active clinician for this department.");
  }

  const service = db
    .prepare("SELECT id, name, duration_minutes, department, active FROM services WHERE id = ?")
    .get(serviceId) as { id: string; name: string; duration_minutes: number; department: string; active: number } | undefined;
  if (!service || !service.active || service.department !== department) {
    return redirectError(returnTo, "Select an active service for this department.");
  }

  if (!getDoctorSchedule(doctorId, date)) {
    return redirectError(returnTo, "The clinician does not have a clinic session on that date.");
  }
  const slots = getAvailableSlots(doctorId, date, service.duration_minutes);
  if (!slots.find((slot) => slot.time === time && slot.available)) {
    return redirectError(returnTo, "That time is not available. Choose another slot.");
  }
  if (hasAppointmentOverlap(doctorId, date, time, service.duration_minutes)) {
    return redirectError(returnTo, "That time overlaps an existing appointment. Choose another slot.");
  }

  const id = `apt_${crypto.randomUUID()}`;
  const ref = reference();
  const now = nowIso();

  try {
    db.prepare(`
      INSERT INTO appointments (id, reference, patient_id, full_name, phone, email, date_of_birth, gender,
        department, doctor_id, service_id, appointment_date, appointment_time, duration_minutes, reason,
        patient_type, notes, status, source, checked_in_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Booked', 'staff', NULL, ?, ?)
    `).run(
      id,
      ref,
      patient.id,
      patient.full_name,
      patient.phone,
      patient.email,
      patient.date_of_birth,
      patient.gender,
      department,
      doctorId,
      serviceId,
      date,
      time,
      service.duration_minutes,
      reason,
      patientType,
      notes,
      now,
      now,
    );
  } catch {
    return redirectError(returnTo, "The appointment could not be saved. The slot may have just been taken.");
  }

  await queueAppointmentNotification(id, "booking_confirmation");
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.staff_create",
    entityType: "appointment",
    entityId: id,
    patientId: patient.id,
    details: `Created staff appointment ${ref} for ${patient.patient_number} on ${date} at ${time}.`,
  });

  redirectSuccess(`/staff/receptionist/appointments/${id}`, `Appointment ${ref} created.`);
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const appointmentId = text(formData, "appointmentId", 60);
  const status = text(formData, "status", 30) as AppointmentStatus;
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  const returnTo = formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`);

  const allowed: AppointmentStatus[] = ["Confirmed", "Checked In", "Waiting for Doctor", "Cancelled", "No Show"];
  if (!APPOINTMENT_STATUSES.includes(status) || !allowed.includes(status)) {
    return redirectError(returnTo, "That status change is not permitted at the front desk.");
  }

  const now = nowIso();
  db.transaction(() => {
    const checkedInAt =
      status === "Checked In" || status === "Waiting for Doctor"
        ? appointment.checked_in_at ?? now
        : appointment.checked_in_at;

    db.prepare("UPDATE appointments SET status = ?, checked_in_at = ?, updated_at = ? WHERE id = ?").run(
      status,
      checkedInAt,
      now,
      appointmentId,
    );

    if (status === "Checked In" || status === "Waiting for Doctor") {
      const existing = db
        .prepare("SELECT id, status FROM visits WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(appointmentId) as { id: string; status: string } | undefined;
      if (existing) {
        db.prepare("UPDATE visits SET status = 'Waiting', doctor_id = ? WHERE id = ?").run(
          appointment.doctor_id,
          existing.id,
        );
      } else if (appointment.patient_id) {
        db.prepare(`
          INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
          VALUES (?, ?, ?, ?, ?, 'Waiting', ?, ?)
        `).run(
          `vis_${crypto.randomUUID()}`,
          appointment.patient_id,
          appointmentId,
          appointment.department,
          appointment.doctor_id,
          now,
          now,
        );
      }
    }

    if (status === "Cancelled" || status === "No Show") {
      db.prepare("UPDATE visits SET status = 'Cancelled' WHERE appointment_id = ? AND status IN ('Waiting','In Consultation')").run(
        appointmentId,
      );
    }
  })();

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.status_change",
    entityType: "appointment",
    entityId: appointmentId,
    patientId: appointment.patient_id,
    details: `Changed ${appointment.reference} from ${appointment.status} to ${status}.`,
  });

  redirectSuccess(returnTo, `Appointment marked ${status.toLowerCase()}.`);
}

export async function checkInAppointmentAction(formData: FormData) {
  const appointmentId = text(formData, "appointmentId", 60);
  const proxy = new FormData();
  proxy.set("appointmentId", appointmentId);
  proxy.set("status", "Checked In");
  proxy.set("returnTo", formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`));
  return updateAppointmentStatusAction(proxy);
}

export async function rescheduleAppointmentAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const appointmentId = text(formData, "appointmentId", 60);
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  const returnTo = `/staff/receptionist/appointments/${appointmentId}`;

  if (["Completed", "Cancelled", "No Show", "In Consultation"].includes(appointment.status)) {
    return redirectError(returnTo, "This appointment can no longer be rescheduled.");
  }

  const date = text(formData, "date", 10);
  const time = text(formData, "time", 5);
  if (!isValidDate(date) || date < clinicToday()) return redirectError(returnTo, "Choose today or a future date.");
  if (!isValidTime(time)) return redirectError(returnTo, "Choose a valid time.");

  const duration = appointment.duration_minutes;
  if (!getDoctorSchedule(appointment.doctor_id, date)) {
    return redirectError(returnTo, "The clinician does not have a clinic session on that date.");
  }
  const slots = getAvailableSlots(appointment.doctor_id, date, duration);
  if (!slots.find((slot) => slot.time === time && slot.available)) {
    return redirectError(returnTo, "That time is not available. Choose another slot.");
  }
  if (hasAppointmentOverlap(appointment.doctor_id, date, time, duration, appointmentId)) {
    return redirectError(returnTo, "That time overlaps another appointment.");
  }

  db.prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ?, updated_at = ? WHERE id = ?").run(
    date,
    time,
    nowIso(),
    appointmentId,
  );
  await queueAppointmentNotification(appointmentId, "reminder");
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.reschedule",
    entityType: "appointment",
    entityId: appointmentId,
    patientId: appointment.patient_id,
    details: `Rescheduled ${appointment.reference} from ${appointment.appointment_date} ${appointment.appointment_time} to ${date} ${time}.`,
  });

  redirectSuccess(returnTo, `Rescheduled to ${formatDate(date)} at ${formatTime(time)}.`);
}

export async function recordVitalsAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const patientId = text(formData, "patientId", 60);
  const patient = requirePatient(patientId);
  const returnTo = formReturnPath(formData, `/staff/receptionist/patients/${patientId}`);

  const systolic = intOrNull(formData, "bpSystolic");
  const diastolic = intOrNull(formData, "bpDiastolic");
  const pulse = intOrNull(formData, "pulse");
  const temperature = numberOrNull(formData, "temperatureC");
  const respiratoryRate = intOrNull(formData, "respiratoryRate");
  const spo2 = intOrNull(formData, "spo2");
  const weight = numberOrNull(formData, "weightKg");
  const height = numberOrNull(formData, "heightCm");
  const observations = optionalText(formData, "observations", 1000);
  let visitId = optionalText(formData, "visitId", 60);

  const inRange = (value: number | null, min: number, max: number) => value === null || (value >= min && value <= max);
  if (!inRange(systolic, 40, 300) || !inRange(diastolic, 20, 200)) return redirectError(returnTo, "Check the blood pressure values.");
  if (!inRange(pulse, 20, 250)) return redirectError(returnTo, "Check the pulse value.");
  if (!inRange(temperature, 30, 45)) return redirectError(returnTo, "Check the temperature value.");
  if (!inRange(respiratoryRate, 5, 80)) return redirectError(returnTo, "Check the respiratory rate.");
  if (!inRange(spo2, 50, 100)) return redirectError(returnTo, "Check the oxygen saturation value.");
  if (!inRange(weight, 1, 500)) return redirectError(returnTo, "Check the weight value.");
  if (!inRange(height, 30, 250)) return redirectError(returnTo, "Check the height value.");
  if (systolic !== null && diastolic !== null && systolic <= diastolic) return redirectError(returnTo, "Systolic pressure must be higher than diastolic pressure.");

  if (visitId) {
    const visit = db.prepare("SELECT id FROM visits WHERE id = ? AND patient_id = ?").get(visitId, patientId) as
      | { id: string }
      | undefined;
    if (!visit) visitId = null;
  }
  if (!visitId) {
    const active = db
      .prepare("SELECT id FROM visits WHERE patient_id = ? AND status IN ('Waiting','In Consultation') ORDER BY created_at DESC LIMIT 1")
      .get(patientId) as { id: string } | undefined;
    visitId = active?.id ?? null;
  }

  const bmi = calculateBmi(weight, height);
  db.prepare(`
    INSERT INTO vitals (id, patient_id, visit_id, bp_systolic, bp_diastolic, pulse, temperature_c,
      respiratory_rate, spo2, weight_kg, height_cm, bmi, observations, recorded_by, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `vit_${crypto.randomUUID()}`,
    patientId,
    visitId,
    systolic,
    diastolic,
    pulse,
    temperature,
    respiratoryRate,
    spo2,
    weight,
    height,
    bmi,
    observations,
    user.id,
    nowIso(),
  );

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "vitals.record",
    entityType: "vitals",
    patientId,
    details: `Recorded vitals for ${patient.patient_number}.`,
  });

  redirectSuccess(returnTo, "Vitals recorded.");
}

export async function createWalkInAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const returnTo = formReturnPath(formData, "/staff/receptionist/queue");
  const patientId = text(formData, "patientId", 60);
  const department = text(formData, "department", 20) as Department;
  const doctorId = text(formData, "doctorId", 60);
  const reason = text(formData, "reason", 1000);
  const patient = getPatient(patientId);

  if (!patient) return redirectError(returnTo, "Select a registered patient.");
  if (!["dental", "optical"].includes(department)) return redirectError(returnTo, "Select a department.");
  if (reason.length < 3) return redirectError(returnTo, "Enter the reason for the walk-in visit.");

  const doctor = db
    .prepare("SELECT id, name, role, active FROM staff WHERE id = ?")
    .get(doctorId) as { id: string; name: string; role: string; active: number } | undefined;
  const expectedRole = department === "dental" ? "dentist" : "eye_doctor";
  if (!doctor || !doctor.active || doctor.role !== expectedRole) {
    return redirectError(returnTo, "Select an active clinician for this department.");
  }

  const today = clinicToday();
  if (!getDoctorSchedule(doctorId, today)) {
    return redirectError(returnTo, "That clinician is not scheduled to see patients today.");
  }

  const now = new Date();
  const clinicTime = now.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Nairobi",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  let time = addMinutesToTime(clinicTime, -(now.getMinutes() % 5));
  const service = db
    .prepare("SELECT id, duration_minutes FROM services WHERE department = ? AND active = 1 ORDER BY duration_minutes LIMIT 1")
    .get(department) as { id: string; duration_minutes: number } | undefined;

  const taken = db.prepare(`
    SELECT 1 FROM appointments
    WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status NOT IN ('Cancelled','No Show')
  `);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!taken.get(doctorId, today, time)) break;
    time = addMinutesToTime(time, 5);
  }

  const id = `apt_${crypto.randomUUID()}`;
  const ref = reference();
  const visitId = `vis_${crypto.randomUUID()}`;

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO appointments (id, reference, patient_id, full_name, phone, email, date_of_birth, gender,
          department, doctor_id, service_id, appointment_date, appointment_time, duration_minutes, reason,
          patient_type, notes, status, source, checked_in_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'returning', NULL, 'Waiting for Doctor', 'walk_in', ?, ?, ?)
      `).run(
        id,
        ref,
        patient.id,
        patient.full_name,
        patient.phone,
        patient.email,
        patient.date_of_birth,
        patient.gender,
        department,
        doctorId,
        service?.id ?? null,
        today,
        time,
        service?.duration_minutes ?? 30,
        reason,
        nowIso(),
        nowIso(),
        nowIso(),
      );
      db.prepare(`
        INSERT INTO visits (id, patient_id, appointment_id, department, doctor_id, status, started_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'Waiting', ?, ?)
      `).run(visitId, patient.id, id, department, doctorId, nowIso(), nowIso());
    })();
  } catch {
    return redirectError(returnTo, "The walk-in could not be added to the queue. Please try again.");
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.walk_in",
    entityType: "appointment",
    entityId: id,
    patientId: patient.id,
    details: `Added walk-in ${ref} for ${patient.patient_number} to the ${department} queue.`,
  });

  redirectSuccess(returnTo, `${patient.full_name} added to the ${department} queue.`);
}

export async function markReminderSentAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const appointmentId = text(formData, "appointmentId", 60);
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  await queueAppointmentNotification(appointmentId, "reminder");
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.reminder_queued",
    entityType: "appointment",
    entityId: appointmentId,
    patientId: appointment.patient_id,
    details: `Queued reminder for ${appointment.reference}.`,
  });
  redirectSuccess(`/staff/receptionist/appointments/${appointmentId}`, "Reminder queued for delivery.");
}

export async function addPatientNoteAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const patientId = text(formData, "patientId", 60);
  const patient = requirePatient(patientId);
  const note = optionalText(formData, "adminNotes", 2000);
  db.prepare("UPDATE patients SET admin_notes = ?, updated_at = ? WHERE id = ?").run(note, nowIso(), patientId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "patient.admin_note",
    entityType: "patient",
    entityId: patientId,
    patientId,
    details: `Updated front-desk note for ${patient.patient_number}.`,
  });
  redirectSuccess(`/staff/receptionist/patients/${patientId}`, "Front-desk note saved.");
}

export async function linkExistingPatientToAppointmentAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const appointmentId = text(formData, "appointmentId", 60);
  const phone = text(formData, "phone", 30);
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  const matches = db.prepare("SELECT id, patient_number, full_name FROM patients WHERE phone = ?").all(phone) as {
    id: string;
    patient_number: string;
    full_name: string;
  }[];
  if (matches.length !== 1) {
    return redirectError(
      `/staff/receptionist/appointments/${appointmentId}`,
      matches.length === 0 ? "No patient record matches that phone number." : "More than one patient matches that phone number. Link the record manually.",
    );
  }
  db.prepare("UPDATE appointments SET patient_id = ?, updated_at = ? WHERE id = ?").run(matches[0].id, nowIso(), appointmentId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.link_patient",
    entityType: "appointment",
    entityId: appointmentId,
    patientId: matches[0].id,
    details: `Linked ${appointment.reference} to ${matches[0].patient_number} by phone match.`,
  });
  redirectSuccess(`/staff/receptionist/appointments/${appointmentId}`, `Linked to ${matches[0].full_name}.`);
}

export async function bulkConfirmAppointmentsAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const ids = multiText(formData, "appointmentIds", 60);
  const returnTo = formReturnPath(formData, "/staff/receptionist/appointments");
  if (!ids.length) return redirectError(returnTo, "Select at least one appointment.");
  const now = nowIso();
  let count = 0;
  const update = db.prepare("UPDATE appointments SET status = 'Confirmed', updated_at = ? WHERE id = ? AND status = 'Booked'");
  db.transaction(() => {
    for (const id of ids) {
      const result = update.run(now, id);
      count += result.changes;
    }
  })();
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.bulk_confirm",
    details: `Confirmed ${count} appointment(s).`,
  });
  redirectSuccess(returnTo, `${count} appointment(s) confirmed.`);
}

export async function markNoShowAction(formData: FormData) {
  const appointmentId = text(formData, "appointmentId", 60);
  const proxy = new FormData();
  proxy.set("appointmentId", appointmentId);
  proxy.set("status", "No Show");
  proxy.set("returnTo", formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`));
  return updateAppointmentStatusAction(proxy);
}

export async function markConfirmedAction(formData: FormData) {
  const appointmentId = text(formData, "appointmentId", 60);
  const proxy = new FormData();
  proxy.set("appointmentId", appointmentId);
  proxy.set("status", "Confirmed");
  proxy.set("returnTo", formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`));
  return updateAppointmentStatusAction(proxy);
}

export async function markWaitingAction(formData: FormData) {
  const appointmentId = text(formData, "appointmentId", 60);
  const proxy = new FormData();
  proxy.set("appointmentId", appointmentId);
  proxy.set("status", "Waiting for Doctor");
  proxy.set("returnTo", formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`));
  return updateAppointmentStatusAction(proxy);
}

export async function cancelAppointmentAction(formData: FormData) {
  const appointmentId = text(formData, "appointmentId", 60);
  const proxy = new FormData();
  proxy.set("appointmentId", appointmentId);
  proxy.set("status", "Cancelled");
  proxy.set("returnTo", formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`));
  return updateAppointmentStatusAction(proxy);
}
