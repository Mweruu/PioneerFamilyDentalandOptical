"use server";

import { requireStaffApi } from "../auth";
import { logAudit } from "../audit";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
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
  "notification_whatsapp_enabled",
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

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("staff")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return redirectError(returnTo, "A staff account with that email already exists.");

  const now = nowIso();
  let staffId: string | null = null;
  const admin = createAdminClient();

  if (admin) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error || !created.user) {
      return redirectError(returnTo, error?.message ?? "The authentication account could not be created.");
    }

    const { error: staffError } = await supabase.from("staff").insert({
      id: created.user.id,
      name,
      email,
      role,
      title,
      active: true,
      created_at: now,
      updated_at: now,
    });

    if (staffError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return redirectError(returnTo, "The staff profile could not be created. No account was saved.");
    }

    staffId = created.user.id;
  } else {
    const { data, error } = await supabase.rpc("admin_create_staff", {
      p_name: name,
      p_email: email,
      p_password: password,
      p_role: role,
      p_title: title,
    });

    if (error || !data) {
      return redirectError(
        returnTo,
        error?.message ??
          "Staff accounts cannot be created without a service-role key. Configure SUPABASE_SERVICE_ROLE_KEY or apply the admin_create_staff migration.",
      );
    }
    staffId = data as string;
  }

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.staff_create",
    entityType: "staff",
    entityId: staffId,
    details: `Created ${ROLE_LABELS[role]} account for ${email}.`,
  });

  redirectSuccess(returnTo, `${name} added as ${ROLE_LABELS[role]}.`);
}

export async function updateStaffAction(formData: FormData) {
  const user = await requireStaffApi("admin");
  const returnTo = formReturnPath(formData, "/staff/admin/staff");
  const staffId = text(formData, "staffId", 60);
  const staff = await getStaff(staffId);
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

  const supabase = await createClient();
  if (staff.role === "admin" && (role !== "admin" || !active)) {
    const { count } = await supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true)
      .neq("id", staffId);
    if (!count) return redirectError(returnTo, "At least one active administrator must remain.");
  }

  const { error } = await supabase
    .from("staff")
    .update({ name, title, role, active, updated_at: nowIso() })
    .eq("id", staffId);
  if (error) return redirectError(returnTo, "The staff account could not be updated.");

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
  const staff = await getStaff(staffId);
  if (!staff) return redirectError(returnTo, "Staff account not found.");
  if (!strongPassword(password)) {
    return redirectError(returnTo, "Use at least 10 characters with an uppercase letter, lowercase letter and number.");
  }

  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.auth.admin.updateUserById(staffId, { password });
    if (error) return redirectError(returnTo, error.message);
  } else {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_reset_staff_password", {
      p_staff_id: staffId,
      p_password: password,
    });
    if (error) {
      return redirectError(
        returnTo,
        error.message ??
          "Passwords cannot be reset without a service-role key. Configure SUPABASE_SERVICE_ROLE_KEY or apply the admin_reset_staff_password migration.",
      );
    }
  }

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

  const supabase = await createClient();
  const payload = {
    department,
    name,
    description,
    duration_minutes: Math.round(duration),
    price,
    active,
  };

  if (serviceId) {
    const { data: existing } = await supabase.from("services").select("id").eq("id", serviceId).maybeSingle();
    if (!existing) return redirectError(returnTo, "Service not found.");
    const { error } = await supabase.from("services").update(payload).eq("id", serviceId);
    if (error) return redirectError(returnTo, "The service could not be updated.");
  } else {
    const { error } = await supabase.from("services").insert({
      id: crypto.randomUUID(),
      ...payload,
      created_at: nowIso(),
    });
    if (error) return redirectError(returnTo, "The service could not be added.");
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

  const supabase = await createClient();
  const { data: service } = await supabase.from("services").select("id, name").eq("id", serviceId).maybeSingle();
  if (!service) return redirectError(returnTo, "Service not found.");

  const { error } = await supabase.from("services").update({ active }).eq("id", serviceId);
  if (error) return redirectError(returnTo, "The service could not be updated.");

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

  const doctor = await getStaff(doctorId);
  if (!doctor || !["dentist", "eye_doctor"].includes(doctor.role)) return redirectError(returnTo, "Select a valid clinician.");
  if (weekday === null || weekday < 0 || weekday > 6) return redirectError(returnTo, "Select a valid day of the week.");
  if (!isValidTime(startTime) || !isValidTime(endTime)) return redirectError(returnTo, "Enter valid session times.");
  if (startTime >= endTime) return redirectError(returnTo, "The session end time must be after the start time.");
  if (breakStart && breakEnd && (breakStart >= breakEnd || breakStart < startTime || breakEnd > endTime)) {
    return redirectError(returnTo, "The break must fall within the session and end after it starts.");
  }
  if (slotMinutes === null || slotMinutes < 10 || slotMinutes > 120) return redirectError(returnTo, "Slot length must be between 10 and 120 minutes.");

  const supabase = await createClient();
  const { error } = await supabase.from("doctor_schedules").upsert(
    {
      id: crypto.randomUUID(),
      doctor_id: doctorId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      break_start: breakStart,
      break_end: breakEnd,
      slot_minutes: Math.round(slotMinutes),
      active,
    },
    { onConflict: "doctor_id,weekday" },
  );
  if (error) return redirectError(returnTo, "The schedule could not be saved.");

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
  const before = await getSettings();
  const changes: string[] = [];
  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = nowIso();

  for (const key of SETTING_KEYS) {
    const raw = formData.get(`setting_${key}`);
    if (
      raw === null &&
      key !== "notification_sms_enabled" &&
      key !== "notification_email_enabled" &&
      key !== "notification_whatsapp_enabled"
    ) {
      continue;
    }
    const value =
      key === "notification_sms_enabled" ||
      key === "notification_email_enabled" ||
      key === "notification_whatsapp_enabled"
        ? checkbox(formData, `setting_${key}`)
          ? "true"
          : "false"
        : String(raw ?? "").trim().slice(0, 1000);
    if (before[key] !== value) changes.push(key);
    rows.push({ key, value, updated_at: now });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_settings").upsert(rows, { onConflict: "key" });
  if (error) return redirectError(returnTo, "The clinic settings could not be saved.");

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
  const appointment = await getAppointment(appointmentId);
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
  const whatsapp = checkbox(formData, "whatsappEnabled");
  const now = nowIso();

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_settings").upsert(
    [
      { key: "notification_sms_enabled", value: sms ? "true" : "false", updated_at: now },
      { key: "notification_email_enabled", value: email ? "true" : "false", updated_at: now },
      { key: "notification_whatsapp_enabled", value: whatsapp ? "true" : "false", updated_at: now },
    ],
    { onConflict: "key" },
  );
  if (error) return redirectError(returnTo, "Notification preferences could not be updated.");

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "admin.notification_flags",
    details: `WhatsApp ${whatsapp ? "enabled" : "disabled"}; SMS ${sms ? "enabled" : "disabled"}; email ${email ? "enabled" : "disabled"}.`,
  });
  redirectSuccess(returnTo, "Notification preferences updated.");
}
