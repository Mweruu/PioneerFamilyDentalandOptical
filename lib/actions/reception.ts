"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { createClient } from "../supabase/server";
import { queueAppointmentNotification } from "../notifications";
import {
  getAppointment,
  getAvailableSlots,
  getDoctorSchedule,
  getPatient,
  hasAppointmentOverlap,
  nextPatientNumber,
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

async function requirePatient(id: string) {
  const patient = await getPatient(id);
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

  const supabase = await createClient();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("patients")
    .select("id")
    .ilike("full_name", fullName)
    .eq("phone", phone)
    .maybeSingle();
  if (duplicateError) return redirectError(returnTo, "The patient could not be registered. Please try again.");
  if (duplicate) {
    return redirectError(returnTo, "A patient with this name and phone number already exists. Open the existing record instead.");
  }

  const id = crypto.randomUUID();
  const now = nowIso();
  const patientNumber = await nextPatientNumber();

  const { error } = await supabase.from("patients").insert({
    id,
    patient_number: patientNumber,
    full_name: fullName,
    phone,
    email,
    date_of_birth: dateOfBirth,
    gender,
    address,
    emergency_contact_name: emergencyName,
    emergency_contact_phone: emergencyPhone,
    allergies,
    medical_history: medicalHistory,
    medications,
    conditions,
    admin_notes: adminNotes,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    return redirectError(returnTo, "The patient could not be registered. Please try again.");
  }

  if (appointmentId) {
    await supabase
      .from("appointments")
      .update({ patient_id: id, patient_type: "new", updated_at: now })
      .eq("id", appointmentId)
      .is("patient_id", null);
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
  const patient = await requirePatient(patientId);
  const returnTo = `/staff/receptionist/patients/${patientId}`;

  const fullName = text(formData, "fullName", 120);
  const phone = text(formData, "phone", 30);
  if (fullName.length < 2) return redirectError(returnTo, "Enter the patient's full name.");
  if (phone.replace(/\D/g, "").length < 7) return redirectError(returnTo, "Enter a valid phone number.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      full_name: fullName,
      phone,
      email: optionalText(formData, "email", 160),
      date_of_birth: optionalText(formData, "dateOfBirth", 10),
      gender: optionalText(formData, "gender", 30),
      address: optionalText(formData, "address", 300),
      emergency_contact_name: optionalText(formData, "emergencyContactName", 120),
      emergency_contact_phone: optionalText(formData, "emergencyContactPhone", 30),
      allergies: optionalText(formData, "allergies", 1000),
      medical_history: optionalText(formData, "medicalHistory", 3000),
      medications: optionalText(formData, "medications", 2000),
      conditions: optionalText(formData, "conditions", 2000),
      admin_notes: optionalText(formData, "adminNotes", 2000),
      updated_at: nowIso(),
    })
    .eq("id", patientId);

  if (error) return redirectError(returnTo, "The patient record could not be updated. Please try again.");

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
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  const patient = await requirePatient(patientId);
  const returnTo = `/staff/receptionist/appointments/${appointmentId}`;

  if (appointment.patient_id) return redirectError(returnTo, "This appointment is already linked to a patient record.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ patient_id: patientId, updated_at: nowIso() })
    .eq("id", appointmentId);
  if (error) return redirectError(returnTo, "The appointment could not be linked. Please try again.");

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
  const patient = await getPatient(patientId);
  if (!patient) return redirectError(returnTo, "Patient record not found.");
  if (!["dental", "optical"].includes(department)) return redirectError(returnTo, "Select a department.");
  if (!isValidDate(date) || date < clinicToday()) return redirectError(returnTo, "Choose today or a future date.");
  if (!isValidTime(time)) return redirectError(returnTo, "Choose an available time.");
  if (reason.length < 3) return redirectError(returnTo, "Enter the reason for the visit.");

  const supabase = await createClient();
  const { data: doctor } = await supabase
    .from("staff")
    .select("id, name, role, active")
    .eq("id", doctorId)
    .maybeSingle();
  const expectedRole = department === "dental" ? "dentist" : "eye_doctor";
  if (!doctor || !doctor.active || doctor.role !== expectedRole) {
    return redirectError(returnTo, "Select an active clinician for this department.");
  }

  const { data: service } = await supabase
    .from("services")
    .select("id, name, duration_minutes, department, active")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service || !service.active || service.department !== department) {
    return redirectError(returnTo, "Select an active service for this department.");
  }

  if (!(await getDoctorSchedule(doctorId, date))) {
    return redirectError(returnTo, "The clinician does not have a clinic session on that date.");
  }
  const slots = await getAvailableSlots(doctorId, date, service.duration_minutes);
  if (!slots.find((slot) => slot.time === time && slot.available)) {
    return redirectError(returnTo, "That time is not available. Choose another slot.");
  }
  if (await hasAppointmentOverlap(doctorId, date, time, service.duration_minutes)) {
    return redirectError(returnTo, "That time overlaps an existing appointment. Choose another slot.");
  }

  const id = crypto.randomUUID();
  const ref = reference();
  const now = nowIso();

  const { error } = await supabase.from("appointments").insert({
    id,
    reference: ref,
    patient_id: patient.id,
    full_name: patient.full_name,
    phone: patient.phone,
    email: patient.email,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    department,
    doctor_id: doctorId,
    service_id: serviceId,
    appointment_date: date,
    appointment_time: time,
    duration_minutes: service.duration_minutes,
    reason,
    patient_type: patientType,
    notes,
    status: "Booked",
    source: "staff",
    checked_in_at: null,
    created_at: now,
    updated_at: now,
  });

  if (error) {
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
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");
  const returnTo = formReturnPath(formData, `/staff/receptionist/appointments/${appointmentId}`);

  const allowed: AppointmentStatus[] = ["Confirmed", "Checked In", "Waiting for Doctor", "Cancelled", "No Show"];
  if (!APPOINTMENT_STATUSES.includes(status) || !allowed.includes(status)) {
    return redirectError(returnTo, "That status change is not permitted at the front desk.");
  }

  const supabase = await createClient();
  const now = nowIso();
  const checkedInAt =
    status === "Checked In" || status === "Waiting for Doctor"
      ? appointment.checked_in_at ?? now
      : appointment.checked_in_at;

  const { error } = await supabase
    .from("appointments")
    .update({ status, checked_in_at: checkedInAt, updated_at: now })
    .eq("id", appointmentId);
  if (error) return redirectError(returnTo, "The appointment status could not be updated.");

  if (status === "Checked In" || status === "Waiting for Doctor") {
    const { data: existing } = await supabase
      .from("visits")
      .select("id, status")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from("visits").update({ status: "Waiting", doctor_id: appointment.doctor_id }).eq("id", existing.id);
    } else if (appointment.patient_id) {
      await supabase.from("visits").insert({
        id: crypto.randomUUID(),
        patient_id: appointment.patient_id,
        appointment_id: appointmentId,
        department: appointment.department,
        doctor_id: appointment.doctor_id,
        status: "Waiting",
        started_at: now,
        created_at: now,
      });
    }
  }

  if (status === "Cancelled" || status === "No Show") {
    await supabase
      .from("visits")
      .update({ status: "Cancelled" })
      .eq("appointment_id", appointmentId)
      .in("status", ["Waiting", "In Consultation"]);
  }

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
  const appointment = await getAppointment(appointmentId);
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
  if (!(await getDoctorSchedule(appointment.doctor_id, date))) {
    return redirectError(returnTo, "The clinician does not have a clinic session on that date.");
  }
  const slots = await getAvailableSlots(appointment.doctor_id, date, duration);
  if (!slots.find((slot) => slot.time === time && slot.available)) {
    return redirectError(returnTo, "That time is not available. Choose another slot.");
  }
  if (await hasAppointmentOverlap(appointment.doctor_id, date, time, duration, appointmentId)) {
    return redirectError(returnTo, "That time overlaps another appointment.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ appointment_date: date, appointment_time: time, updated_at: nowIso() })
    .eq("id", appointmentId);
  if (error) return redirectError(returnTo, "The appointment could not be rescheduled. Please try again.");

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
  const patient = await requirePatient(patientId);
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

  const supabase = await createClient();

  if (visitId) {
    const { data: visit } = await supabase
      .from("visits")
      .select("id")
      .eq("id", visitId)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (!visit) visitId = null;
  }
  if (!visitId) {
    const { data: active } = await supabase
      .from("visits")
      .select("id")
      .eq("patient_id", patientId)
      .in("status", ["Waiting", "In Consultation"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    visitId = active?.id ?? null;
  }

  const bmi = calculateBmi(weight, height);
  const { error } = await supabase.from("vitals").insert({
    id: crypto.randomUUID(),
    patient_id: patientId,
    visit_id: visitId,
    bp_systolic: systolic,
    bp_diastolic: diastolic,
    pulse,
    temperature_c: temperature,
    respiratory_rate: respiratoryRate,
    spo2,
    weight_kg: weight,
    height_cm: height,
    bmi,
    observations,
    recorded_by: user.id,
    recorded_at: nowIso(),
  });
  if (error) return redirectError(returnTo, "The vitals could not be saved. Please try again.");

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
  const patient = await getPatient(patientId);

  if (!patient) return redirectError(returnTo, "Select a registered patient.");
  if (!["dental", "optical"].includes(department)) return redirectError(returnTo, "Select a department.");
  if (reason.length < 3) return redirectError(returnTo, "Enter the reason for the walk-in visit.");

  const supabase = await createClient();
  const { data: doctor } = await supabase
    .from("staff")
    .select("id, name, role, active")
    .eq("id", doctorId)
    .maybeSingle();
  const expectedRole = department === "dental" ? "dentist" : "eye_doctor";
  if (!doctor || !doctor.active || doctor.role !== expectedRole) {
    return redirectError(returnTo, "Select an active clinician for this department.");
  }

  const today = clinicToday();
  if (!(await getDoctorSchedule(doctorId, today))) {
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

  const { data: service } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .eq("department", department)
    .eq("active", true)
    .order("duration_minutes")
    .limit(1)
    .maybeSingle();

  for (let attempt = 0; attempt < 20; attempt++) {
    const { data: taken } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("appointment_date", today)
      .eq("appointment_time", time)
      .not("status", "in", "(Cancelled,No Show)")
      .maybeSingle();
    if (!taken) break;
    time = addMinutesToTime(time, 5);
  }

  const id = crypto.randomUUID();
  const ref = reference();
  const visitId = crypto.randomUUID();
  const nowIsoValue = nowIso();

  const { error } = await supabase.from("appointments").insert({
    id,
    reference: ref,
    patient_id: patient.id,
    full_name: patient.full_name,
    phone: patient.phone,
    email: patient.email,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    department,
    doctor_id: doctorId,
    service_id: service?.id ?? null,
    appointment_date: today,
    appointment_time: time,
    duration_minutes: service?.duration_minutes ?? 30,
    reason,
    patient_type: "returning",
    notes: null,
    status: "Waiting for Doctor",
    source: "walk_in",
    checked_in_at: nowIsoValue,
    created_at: nowIsoValue,
    updated_at: nowIsoValue,
  });

  if (error) {
    return redirectError(returnTo, "The walk-in could not be added to the queue. Please try again.");
  }

  const { error: visitError } = await supabase.from("visits").insert({
    id: visitId,
    patient_id: patient.id,
    appointment_id: id,
    department,
    doctor_id: doctorId,
    status: "Waiting",
    started_at: nowIsoValue,
    created_at: nowIsoValue,
  });

  if (visitError) {
    return redirectError(returnTo, "The walk-in appointment was created but the queue entry failed. Contact support.");
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
  const appointment = await getAppointment(appointmentId);
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
  const patient = await requirePatient(patientId);
  const note = optionalText(formData, "adminNotes", 2000);

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ admin_notes: note, updated_at: nowIso() })
    .eq("id", patientId);
  if (error) return redirectError(`/staff/receptionist/patients/${patientId}`, "The note could not be saved.");

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
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return redirectError("/staff/receptionist/appointments", "Appointment not found.");

  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("patients")
    .select("id, patient_number, full_name")
    .eq("phone", phone);

  if (!matches || matches.length !== 1) {
    return redirectError(
      `/staff/receptionist/appointments/${appointmentId}`,
      !matches || matches.length === 0
        ? "No patient record matches that phone number."
        : "More than one patient matches that phone number. Link the record manually.",
    );
  }

  const match = matches[0] as { id: string; patient_number: string; full_name: string };
  const { error } = await supabase
    .from("appointments")
    .update({ patient_id: match.id, updated_at: nowIso() })
    .eq("id", appointmentId);
  if (error) return redirectError(`/staff/receptionist/appointments/${appointmentId}`, "The appointment could not be linked.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "appointment.link_patient",
    entityType: "appointment",
    entityId: appointmentId,
    patientId: match.id,
    details: `Linked ${appointment.reference} to ${match.patient_number} by phone match.`,
  });
  redirectSuccess(`/staff/receptionist/appointments/${appointmentId}`, `Linked to ${match.full_name}.`);
}

export async function bulkConfirmAppointmentsAction(formData: FormData) {
  const user = await requireStaffApi("receptionist");
  const ids = multiText(formData, "appointmentIds", 60);
  const returnTo = formReturnPath(formData, "/staff/receptionist/appointments");
  if (!ids.length) return redirectError(returnTo, "Select at least one appointment.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "Confirmed", updated_at: nowIso() })
    .in("id", ids)
    .eq("status", "Booked")
    .select("id");

  if (error) return redirectError(returnTo, "The appointments could not be confirmed.");
  const count = (data ?? []).length;

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
