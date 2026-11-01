"use server";

import { requireStaffApi, hashPassword } from "../auth";
import { logAudit } from "../audit";
import { db } from "../db";
import { getAppointment, getSettings, getStaff } from "../data/queries";
import { queueAppointmentNotification } from "../notifications";
import type { Role } from "../types";
import { ROLE_LABELS } from "../types";
import { nowIso } from "../utils";
import {
  checkbox,
  formReturnPath,
  isValidTime,
  numberOrNull,
  optionalText,
  redirectError,
  redirectSuccess,
  text,
} from "./helpers";

const ROLES: Role[] = ["dentist", "receptionist", "eye_doctor", "admin"];
const SETTING_KEYS = [
  "clinic_name",
  "clinic_phone",
  "clinic_email",
  "clinic_address",
  "clinic_hours",
  "appointment_duration",
  "notification_sms_enabled",
  "notification_email_enabled",
  "notification_sender",
  "privacy_contact",
];

function strongPassword(password: string) {
  return (
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export async function createStaffAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/staff");
  const name = text(formData, "name", 120);
  const email = text(formData, "email", 160).toLowerCase();
  const role = text(formData, "role", 20) as Role;
  const title = optionalText(formData, "title", 120);
  const password = text(formData, "password", 200);

  if (name.length < 2) return redirectError(returnTo, "Enter the staff member's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return redirectError(returnTo, "Enter a valid work email address.");
  if (!ROLES.includes(role)) return redirectError(returnTo, "Select a valid role.");
  if (!strongPassword(password)) {
    return redirectError(returnTo, "Use at least 10 characters with an uppercase letter, lowercase letter and number.");
  }

  const existing = db.prepare("SELECT id FROM staff WHERE email = ? COLLATE NOCASE").get(email) as { id: string } | undefined;
  if (existing) return redirectError(returnTo, "A staff account with that email already exists.");

  const id = `usr_${crypto.randomUUID()}`;
  const now = nowIso();
  db.prepare(`
    INSERT INTO staff (id, name, email, password_hash, role, title, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, name, email, hashPassword(password), role, title, now, now);

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.staff_create",
    entityType: "staff",
    entityId: id,
    details: `Created ${ROLE_LABELS[role]} account for ${email}.`,
  });

  redirectSuccess(returnTo, `${name} added as ${ROLE_LABELS[role]}.`);
}

export async function updateStaffAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/staff");
  const staffId = text(formData, "staffId", 60);
  const staff = getStaff(staffId);
  if (!staff) return redirectError(returnTo, "Staff account not found.");

  const name = text(formData, "name", 120);
  const title = optionalText(formData, "title", 120);
  const role = text(formData, "role", 20) as Role;
  const active = checkbox(formData, "active");

  if (name.length < 2) return redirectError(returnTo, "Enter the staff member's full name.");
  if (!ROLES.includes(role)) return redirectError(returnTo, "Select a valid role.");
  if (staffId === user.id && (!active || role !== "admin")) {
    return redirectError(returnTo, "You cannot deactivate or change the role of your own account.");
  }

  if (staff.role === "admin" && (role !== "admin" || !active)) {
    const otherAdmins = db
      .prepare("SELECT COUNT(*) AS count FROM staff WHERE role = 'admin' AND active = 1 AND id <> ?")
      .get(staffId) as { count: number };
    if (otherAdmins.count === 0) return redirectError(returnTo, "At least one active administrator must remain.");
  }

  db.prepare("UPDATE staff SET name = ?, title = ?, role = ?, active = ?, updated_at = ? WHERE id = ?").run(
    name,
    title,
    role,
    active ? 1 : 0,
    nowIso(),
    staffId,
  );

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.staff_update",
    entityType: "staff",
    entityId: staffId,
    details: `Updated ${staff.email}: role ${role}, ${active ? "active" : "deactivated"}.`,
  });

  redirectSuccess(returnTo, "Staff account updated.");
}

export async function resetStaffPasswordAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/staff");
  const staffId = text(formData, "staffId", 60);
  const password = text(formData, "password", 200);
  const staff = getStaff(staffId);
  if (!staff) return redirectError(returnTo, "Staff account not found.");
  if (!strongPassword(password)) {
    return redirectError(returnTo, "Use at least 10 characters with an uppercase letter, lowercase letter and number.");
  }

  db.prepare("UPDATE staff SET password_hash = ?, updated_at = ? WHERE id = ?").run(hashPassword(password), nowIso(), staffId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.staff_password_reset",
    entityType: "staff",
    entityId: staffId,
    details: `Administrator reset the password for ${staff.email}.`,
  });

  redirectSuccess(returnTo, `Password reset for ${staff.name}. Share it securely and ask them to change it.`);
}

export async function saveServiceAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/services");
  const serviceId = optionalText(formData, "serviceId", 60);
  const department = text(formData, "department", 20);
  const name = text(formData, "name", 160);
  const description = optionalText(formData, "description", 1000);
  const duration = numberOrNull(formData, "durationMinutes");
  const price = numberOrNull(formData, "price");
  const active = checkbox(formData, "active");

  if (!["dental", "optical"].includes(department)) return redirectError(returnTo, "Select a department.");
  if (name.length < 2) return redirectError(returnTo, "Enter the service name.");
  if (duration === null || duration < 5 || duration > 240) return redirectError(returnTo, "Duration must be between 5 and 240 minutes.");
  if (price !== null && (price < 0 || price > 10_000_000)) return redirectError(returnTo, "Enter a valid price.");

  if (serviceId) {
    const existing = db.prepare("SELECT id FROM services WHERE id = ?").get(serviceId) as { id: string } | undefined;
    if (!existing) return redirectError(returnTo, "Service not found.");
    db.prepare(`
      UPDATE services SET department = ?, name = ?, description = ?, duration_minutes = ?, price = ?, active = ?
      WHERE id = ?
    `).run(department, name, description, Math.round(duration), price, active ? 1 : 0, serviceId);
  } else {
    db.prepare(`
      INSERT INTO services (id, department, name, description, duration_minutes, price, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`svc_${crypto.randomUUID()}`, department, name, description, Math.round(duration), price, active ? 1 : 0, nowIso());
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: serviceId ? "admin.service_update" : "admin.service_create",
    entityType: "service",
    entityId: serviceId,
    details: `${serviceId ? "Updated" : "Created"} ${department} service: ${name}.`,
  });

  redirectSuccess(returnTo, serviceId ? "Service updated." : "Service added.");
}

export async function toggleServiceAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/services");
  const serviceId = text(formData, "serviceId", 60);
  const active = checkbox(formData, "active");
  const service = db.prepare("SELECT id, name FROM services WHERE id = ?").get(serviceId) as { id: string; name: string } | undefined;
  if (!service) return redirectError(returnTo, "Service not found.");
  db.prepare("UPDATE services SET active = ? WHERE id = ?").run(active ? 1 : 0, serviceId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.service_toggle",
    entityType: "service",
    entityId: serviceId,
    details: `${active ? "Activated" : "Deactivated"} service ${service.name}.`,
  });
  redirectSuccess(returnTo, `${service.name} ${active ? "activated" : "deactivated"}.`);
}

export async function saveScheduleAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/schedules");
  const doctorId = text(formData, "doctorId", 60);
  const weekday = numberOrNull(formData, "weekday");
  const startTime = text(formData, "startTime", 5);
  const endTime = text(formData, "endTime", 5);
  const breakStart = optionalText(formData, "breakStart", 5);
  const breakEnd = optionalText(formData, "breakEnd", 5);
  const slotMinutes = numberOrNull(formData, "slotMinutes");
  const active = checkbox(formData, "active");

  const doctor = getStaff(doctorId);
  if (!doctor || !["dentist", "eye_doctor"].includes(doctor.role)) return redirectError(returnTo, "Select a valid clinician.");
  if (weekday === null || weekday < 0 || weekday > 6) return redirectError(returnTo, "Select a valid day of the week.");
  if (!isValidTime(startTime) || !isValidTime(endTime)) return redirectError(returnTo, "Enter valid session times.");
  if (startTime >= endTime) return redirectError(returnTo, "The session end time must be after the start time.");
  if (breakStart && breakEnd && (breakStart >= breakEnd || breakStart < startTime || breakEnd > endTime)) {
    return redirectError(returnTo, "The break must fall within the session and end after it starts.");
  }
  if (slotMinutes === null || slotMinutes < 10 || slotMinutes > 120) return redirectError(returnTo, "Slot length must be between 10 and 120 minutes.");

  db.prepare(`
    INSERT INTO doctor_schedules (id, doctor_id, weekday, start_time, end_time, break_start, break_end, slot_minutes, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(doctor_id, weekday) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time,
      break_start = excluded.break_start, break_end = excluded.break_end, slot_minutes = excluded.slot_minutes,
      active = excluded.active
  `).run(
    `sch_${crypto.randomUUID()}`,
    doctorId,
    weekday,
    startTime,
    endTime,
    breakStart,
    breakEnd,
    Math.round(slotMinutes),
    active ? 1 : 0,
  );

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.schedule_update",
    entityType: "schedule",
    entityId: doctorId,
    details: `Updated ${doctor.name} schedule for weekday ${weekday}.`,
  });

  redirectSuccess(returnTo, "Schedule saved.");
}

export async function saveSettingsAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/settings");
  const before = getSettings();
  const changes: string[] = [];

  const update = db.prepare(`
    INSERT INTO clinic_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const now = nowIso();

  db.transaction(() => {
    for (const key of SETTING_KEYS) {
      const raw = formData.get(`setting_${key}`);
      if (raw === null && key !== "notification_sms_enabled" && key !== "notification_email_enabled") continue;
      const value = key === "notification_sms_enabled" || key === "notification_email_enabled"
        ? (checkbox(formData, `setting_${key}`) ? "true" : "false")
        : String(raw ?? "").trim().slice(0, 1000);
      if (before[key] !== value) changes.push(key);
      update.run(key, value, now);
    }
  })();

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.settings_update",
    entityType: "settings",
    details: changes.length ? `Updated settings: ${changes.join(", ")}.` : "Settings submitted with no changes.",
  });

  redirectSuccess(returnTo, "Clinic settings saved.");
}

export async function queueAppointmentReminderAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const appointmentId = text(formData, "appointmentId", 60);
  const returnTo = formReturnPath(formData, "/staff/admin/notifications");
  const appointment = getAppointment(appointmentId);
  if (!appointment) return redirectError(returnTo, "Appointment not found.");
  if (["Cancelled", "No Show", "Completed"].includes(appointment.status)) {
    return redirectError(returnTo, "Reminders are only sent for active appointments.");
  }
  await queueAppointmentNotification(appointmentId, "reminder");
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.reminder_queue",
    entityType: "appointment",
    entityId: appointmentId,
    patientId: appointment.patient_id,
    details: `Queued reminder for ${appointment.reference}.`,
  });
  redirectSuccess(returnTo, `Reminder queued for ${appointment.reference}.`);
}

export async function updateNotificationFlagsAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/notifications");
  const sms = checkbox(formData, "smsEnabled");
  const email = checkbox(formData, "emailEnabled");
  const update = db.prepare(`
    INSERT INTO clinic_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const now = nowIso();
  db.transaction(() => {
    update.run("notification_sms_enabled", sms ? "true" : "false", now);
    update.run("notification_email_enabled", email ? "true" : "false", now);
  })();
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.notification_flags",
    details: `SMS ${sms ? "enabled" : "disabled"}; email ${email ? "enabled" : "disabled"}.`,
  });
  redirectSuccess(returnTo, "Notification preferences updated.");
}
