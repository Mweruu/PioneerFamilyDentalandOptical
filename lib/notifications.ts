import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { formatDate, formatTime, nowIso } from "./utils";

type NotificationTemplate = "booking_confirmation" | "reminder" | "cancellation";
type NotificationChannel = "sms" | "email" | "whatsapp";
type DeliveryResult = { status: "sent" | "failed" | "not_configured"; error: string | null };

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
  /** Service-role client for scheduled jobs; defaults to the cookie client. */
  client?: SupabaseClient;
};

type ReminderFlags = { sms: boolean; email: boolean; whatsapp: boolean };

type NotificationAttempt = { channel: NotificationChannel; recipient: string };

const DEFAULT_CLINIC = "Pioneer Family Dental and Optical Clinic";
const WHATSAPP_PARAM_MAX = 1024;

/** Which delivery providers have credentials in the server environment. */
export function notificationProviders() {
  return {
    sms: Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME),
    email: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL),
    whatsapp: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
    ),
  };
}

async function setting(supabase: SupabaseClient, key: string, publicEvent: boolean) {
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

async function clinicDetails(supabase: SupabaseClient, publicEvent: boolean) {
  const [clinic, phone] = await Promise.all([
    setting(supabase, "clinic_name", publicEvent),
    setting(supabase, "clinic_phone", publicEvent),
  ]);
  return {
    clinicName: clinic || DEFAULT_CLINIC,
    clinicPhone: phone || "the clinic",
  };
}

function messageFor(
  template: NotificationTemplate,
  appt: NotificationAppointment,
  clinicName: string,
  clinicPhone: string,
) {
  if (template === "cancellation") {
    return `${appt.full_name}, your appointment ${appt.reference} at ${clinicName} on ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} has been cancelled. Call ${clinicPhone} to rebook.`;
  }
  if (template === "reminder") {
    return `Reminder: ${appt.full_name}, your ${appt.department} appointment at ${clinicName} is on ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} with ${appt.doctor_name}. Ref: ${appt.reference}. Call ${clinicPhone}.`;
  }
  return `${appt.full_name}, your ${appt.department} appointment at ${clinicName} is confirmed for ${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)} with ${appt.doctor_name}. Ref: ${appt.reference}. Call ${clinicPhone}.`;
}

/** Body parameters for the approved WhatsApp reminder template. */
function whatsappParams(
  appt: NotificationAppointment,
  clinicName: string,
  clinicPhone: string,
) {
  return [
    appt.full_name,
    appt.department,
    clinicName,
    formatDate(appt.appointment_date),
    formatTime(appt.appointment_time),
    appt.doctor_name,
    appt.reference,
    clinicPhone,
  ];
}

/** Meta expects an international number without `+`, spaces or punctuation. */
export function normalizeWhatsAppRecipient(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

function templateParam(value: string) {
  return (value || "-").replace(/[\r\n\t]+/g, " ").slice(0, WHATSAPP_PARAM_MAX);
}

async function deliverSms(recipient: string, message: string): Promise<DeliveryResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  if (!apiKey || !username) {
    return { status: "not_configured", error: "Africa's Talking credentials are not configured." };
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
    return { status: "failed", error: `SMS provider returned ${response.status}.` };
  }
  return { status: "sent", error: null };
}

async function deliverEmail(
  recipient: string,
  subject: string,
  message: string,
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) {
    return { status: "not_configured", error: "Email provider credentials are not configured." };
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
    return { status: "failed", error: `Email provider returned ${response.status}.` };
  }
  return { status: "sent", error: null };
}

/**
 * Business-initiated WhatsApp messages must use a pre-approved template.
 * The template name, language and API version are configurable so the clinic
 * can match whatever was approved in Meta Business Manager.
 */
async function deliverWhatsApp(
  recipient: string,
  params: string[],
): Promise<DeliveryResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return {
      status: "not_configured",
      error: "WhatsApp Cloud API credentials are not configured.",
    };
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "appointment_reminder";
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizeWhatsAppRecipient(recipient),
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: params.map((value) => ({
                type: "text",
                text: templateParam(value),
              })),
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload?.error?.message) detail = `: ${payload.error.message}`;
    } catch {
      // The provider did not return JSON; keep the status code only.
    }
    return { status: "failed", error: `WhatsApp provider returned ${response.status}${detail}.` };
  }
  return { status: "sent", error: null };
}

async function reminderFlags(
  supabase: SupabaseClient,
  publicEvent: boolean,
): Promise<ReminderFlags | null> {
  if (publicEvent) return null;

  const { data } = await supabase
    .from("clinic_settings")
    .select("key, value")
    .in("key", [
      "notification_sms_enabled",
      "notification_email_enabled",
      "notification_whatsapp_enabled",
    ]);

  if (!data || data.length === 0) return null;
  const values = Object.fromEntries(
    (data as { key: string; value: string }[]).map((row) => [row.key, row.value]),
  );

  return {
    sms: values.notification_sms_enabled === "true",
    email: values.notification_email_enabled === "true",
    whatsapp: values.notification_whatsapp_enabled === "true",
  };
}

/**
 * Reminder policy: deliver on every channel the clinic has enabled and
 * configured. Confirmations and cancellations keep their existing behaviour
 * of choosing a single best channel.
 */
function reminderAttempts(
  appt: NotificationAppointment,
  flags: ReminderFlags,
  providers: ReturnType<typeof notificationProviders>,
): NotificationAttempt[] {
  const attempts: NotificationAttempt[] = [];

  if (flags.whatsapp && providers.whatsapp) {
    attempts.push({ channel: "whatsapp", recipient: appt.phone });
  }
  if (flags.sms && providers.sms) {
    attempts.push({ channel: "sms", recipient: appt.phone });
  }
  if (flags.email && providers.email && appt.email) {
    attempts.push({ channel: "email", recipient: appt.email });
  }

  return attempts;
}

function defaultAttempt(appt: NotificationAppointment): NotificationAttempt {
  return appt.email
    ? { channel: "email", recipient: appt.email }
    : { channel: "sms", recipient: appt.phone };
}

async function loadAppointment(
  supabase: SupabaseClient,
  appointmentId: string,
  publicEvent: boolean,
): Promise<NotificationAppointment | null> {
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

async function recordNotification(
  supabase: SupabaseClient,
  appt: NotificationAppointment,
  attempt: NotificationAttempt,
  template: NotificationTemplate,
  payload: string,
  result: DeliveryResult,
  publicEvent: boolean,
) {
  const sentAt = result.status === "sent" ? nowIso() : null;

  if (publicEvent) {
    const { error } = await supabase.rpc("public_record_notification", {
      p_appointment_id: appt.id,
      p_reference: appt.reference,
      p_channel: attempt.channel,
      p_recipient: attempt.recipient,
      p_template: template,
      p_status: result.status,
      p_payload: payload,
      p_error: result.error,
      p_sent_at: sentAt,
    });
    if (error) throw new Error(`Notification log failed: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("notifications").insert({
    appointment_id: appt.id,
    channel: attempt.channel,
    recipient: attempt.recipient,
    template,
    status: result.status,
    payload,
    error: result.error,
    sent_at: sentAt,
  });
  if (error) throw new Error(`Notification log failed: ${error.message}`);
}

export async function queueAppointmentNotification(
  appointmentId: string,
  template: NotificationTemplate = "booking_confirmation",
  options: QueueOptions = {},
) {
  const publicEvent = options.publicEvent ?? false;
  const supabase = options.client ?? (await createClient());
  const appt =
    options.appointment ?? (await loadAppointment(supabase, appointmentId, publicEvent));
  if (!appt) return [];

  const providers = notificationProviders();
  const { clinicName, clinicPhone } = await clinicDetails(supabase, publicEvent);
  const message = messageFor(template, appt, clinicName, clinicPhone);
  const flags = template === "reminder" ? await reminderFlags(supabase, publicEvent) : null;
  const attempts = flags ? reminderAttempts(appt, flags, providers) : [defaultAttempt(appt)];

  if (attempts.length === 0) {
    const fallback = defaultAttempt(appt);
    await recordNotification(
      supabase,
      appt,
      fallback,
      template,
      message,
      {
        status: "not_configured",
        error:
          "No reminder channel is enabled and configured. Enable WhatsApp, SMS or email in notification settings.",
      },
      publicEvent,
    );
    return [{ channel: fallback.channel, status: "not_configured" as const }];
  }

  const subject = `Pioneer Clinic — ${template.replaceAll("_", " ")}`;
  const results: { channel: NotificationChannel; status: DeliveryResult["status"] }[] = [];

  for (const attempt of attempts) {
    let result: DeliveryResult;

    try {
      if (attempt.channel === "email") {
        result = await deliverEmail(attempt.recipient, subject, message);
      } else if (attempt.channel === "whatsapp") {
        result = await deliverWhatsApp(
          attempt.recipient,
          whatsappParams(appt, clinicName, clinicPhone),
        );
      } else {
        result = await deliverSms(attempt.recipient, message);
      }
    } catch (error) {
      result = {
        status: "failed",
        error: error instanceof Error ? error.message : "Notification delivery failed.",
      };
    }

    await recordNotification(supabase, appt, attempt, template, message, result, publicEvent);
    results.push({ channel: attempt.channel, status: result.status });
  }

  return results;
}
