import "server-only";
import { db } from "./db";
import { formatDate, formatTime, nowIso } from "./utils";

type NotificationTemplate = "booking_confirmation" | "reminder" | "cancellation" | "password_reset";

type AppointmentNotification = {
  id: string;
  reference: string;
  full_name: string;
  phone: string;
  email: string | null;
  department: string;
  appointment_date: string;
  appointment_time: string;
  doctor_name: string;
};

function setting(key: string) {
  const row = db.prepare("SELECT value FROM clinic_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function messageFor(template: NotificationTemplate, appt: AppointmentNotification) {
  const clinic = setting("clinic_name") || "Pioneer Family Dental and Optical Clinic";
  const phone = setting("clinic_phone") || "";
  if (template === "cancellation") {
    return `${appt.full_name}, your appointment ${appt.reference} at ${clinic} on ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} has been cancelled. Call ${phone} to rebook.`;
  }
  if (template === "reminder") {
    return `Reminder: ${appt.full_name}, your ${appt.department} appointment at ${clinic} is on ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} with ${appt.doctor_name}. Ref: ${appt.reference}. Call ${phone}.`;
  }
  return `${appt.full_name}, your ${appt.department} appointment at ${clinic} is confirmed for ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} with ${appt.doctor_name}. Ref: ${appt.reference}. Call ${phone}.`;
}

async function deliverSms(recipient: string, message: string) {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  if (!apiKey || !username) return { status: "not_configured" as const, error: "Africa's Talking credentials are not configured." };

  const body = new URLSearchParams({
    username,
    to: recipient,
    message,
    from: process.env.AFRICASTALKING_SENDER_ID || "",
  });

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    return { status: "failed" as const, error: `SMS provider returned ${response.status}.` };
  }
  return { status: "sent" as const, error: null };
}

async function deliverEmail(recipient: string, subject: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) return { status: "not_configured" as const, error: "Email provider credentials are not configured." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      text: message,
    }),
  });

  if (!response.ok) {
    return { status: "failed" as const, error: `Email provider returned ${response.status}.` };
  }
  return { status: "sent" as const, error: null };
}

export async function queueAppointmentNotification(appointmentId: string, template: NotificationTemplate = "booking_confirmation") {
  const appt = db
    .prepare(`
      SELECT a.id, a.reference, a.full_name, a.phone, a.email, a.department, a.appointment_date,
             a.appointment_time, s.name AS doctor_name
      FROM appointments a
      JOIN staff s ON s.id = a.doctor_id
      WHERE a.id = ?
    `)
    .get(appointmentId) as AppointmentNotification | undefined;
  if (!appt) return;

  const message = messageFor(template, appt);
  const channel: "sms" | "email" = appt.email ? "email" : "sms";
  const recipient = channel === "email" ? appt.email! : appt.phone;

  let result: { status: "sent" | "failed" | "not_configured"; error: string | null } = {
    status: "not_configured",
    error: "No notification provider configured.",
  };

  try {
    if (channel === "email") {
      result = await deliverEmail(recipient, `Pioneer Clinic — ${template.replaceAll("_", " ")}`, message);
    } else {
      result = await deliverSms(recipient, message);
    }
  } catch (error) {
    result = { status: "failed", error: error instanceof Error ? error.message : "Notification delivery failed." };
  }

  db.prepare(`
    INSERT INTO notifications (id, appointment_id, channel, recipient, template, status, payload, error, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    appt.id,
    channel,
    recipient,
    template,
    result.status,
    message,
    result.error,
    result.status === "sent" ? nowIso() : null,
    nowIso(),
  );
}

export async function queuePasswordResetNotification(recipient: string, name: string, resetUrl: string) {
  const message = `Hello ${name}, a password reset was requested for your Pioneer Clinic staff account. Use this link within 30 minutes: ${resetUrl}. If you did not request this, contact the clinic administrator.`;
  const result = await deliverEmail(recipient, "Pioneer Clinic password reset", message);
  db.prepare(`
    INSERT INTO notifications (id, appointment_id, channel, recipient, template, status, payload, error, sent_at, created_at)
    VALUES (?, NULL, 'email', ?, 'password_reset', ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    recipient,
    result.status,
    message,
    result.error,
    result.status === "sent" ? nowIso() : null,
    nowIso(),
  );
  return result;
}
