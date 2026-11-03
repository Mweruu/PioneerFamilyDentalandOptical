import "server-only";
import { createClient } from "./supabase/server";
import { formatDate, formatTime, nowIso } from "./utils";

type NotificationTemplate = "booking_confirmation" | "reminder" | "cancellation";

export type NotificationAppointment = {
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

type QueueOptions = {
  /** Unauthenticated public booking/lookup/cancellation. */
  publicEvent?: boolean;
  /** Appointment details already returned by a public RPC. */
  appointment?: NotificationAppointment;
};

async function setting(key: string, publicEvent: boolean) {
  const supabase = await createClient();

  if (publicEvent) {
    const { data } = await supabase.rpc("public_clinic_info");
    const info = (data ?? {}) as Record<string, string>;
    return info[key] ?? null;
  }

  const { data } = await supabase
    .from("clinic_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data as { value: string } | null)?.value ?? null;
}

async function messageFor(
  template: NotificationTemplate,
  appt: NotificationAppointment,
  publicEvent: boolean,
) {
  const [clinic, phone] = await Promise.all([
    setting("clinic_name", publicEvent),
    setting("clinic_phone", publicEvent),
  ]);
  const clinicName = clinic || "Pioneer Family Dental and Optical Clinic";
  const clinicPhone = phone || "";

  if (template === "cancellation") {
    return `${appt.full_name}, your appointment ${appt.reference} at ${clinicName} on ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} has been cancelled. Call ${clinicPhone} to rebook.`;
  }
  if (template === "reminder") {
    return `Reminder: ${appt.full_name}, your ${appt.department} appointment at ${clinicName} is on ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} with ${appt.doctor_name}. Ref: ${appt.reference}. Call ${clinicPhone}.`;
  }
  return `${appt.full_name}, your ${appt.department} appointment at ${clinicName} is confirmed for ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} with ${appt.doctor_name}. Ref: ${appt.reference}. Call ${clinicPhone}.`;
}

async function deliverSms(recipient: string, message: string) {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  if (!apiKey || !username) {
    return { status: "not_configured" as const, error: "Africa's Talking credentials are not configured." };
  }

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
  if (!apiKey || !from) {
    return { status: "not_configured" as const, error: "Email provider credentials are not configured." };
  }

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

async function loadAppointment(
  appointmentId: string,
  publicEvent: boolean,
): Promise<NotificationAppointment | null> {
  const supabase = await createClient();

  if (publicEvent) {
    const { data } = await supabase.rpc("public_appointment_notification", {
      p_appointment_id: appointmentId,
    });
    return (data as NotificationAppointment | null) ?? null;
  }

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, reference, full_name, phone, email, department, appointment_date, appointment_time, staff!appointments_doctor_id_fkey(name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!data) return null;
  const row = data as unknown as NotificationAppointment & { staff: { name: string } | null };
  return {
    id: row.id,
    reference: row.reference,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    department: row.department,
    appointment_date: row.appointment_date,
    appointment_time: row.appointment_time.slice(0, 5),
    doctor_name: row.staff?.name ?? "the clinic",
  };
}

export async function queueAppointmentNotification(
  appointmentId: string,
  template: NotificationTemplate = "booking_confirmation",
  options: QueueOptions = {},
) {
  const publicEvent = options.publicEvent ?? false;
  const appt = options.appointment ?? (await loadAppointment(appointmentId, publicEvent));
  if (!appt) return;

  const message = await messageFor(template, appt, publicEvent);
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

  const supabase = await createClient();
  const sentAt = result.status === "sent" ? nowIso() : null;

  if (publicEvent) {
    const { error } = await supabase.rpc("public_record_notification", {
      p_appointment_id: appt.id,
      p_reference: appt.reference,
      p_channel: channel,
      p_recipient: recipient,
      p_template: template,
      p_status: result.status,
      p_payload: message,
      p_error: result.error,
      p_sent_at: sentAt,
    });
    if (error) throw new Error(`Notification log failed: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("notifications").insert({
    appointment_id: appt.id,
    channel,
    recipient,
    template,
    status: result.status,
    payload: message,
    error: result.error,
    sent_at: sentAt,
  });
  if (error) throw new Error(`Notification log failed: ${error.message}`);
}
