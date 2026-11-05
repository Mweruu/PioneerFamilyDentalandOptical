import { NextResponse } from "next/server";
import { queueAppointmentNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { clinicDatePlus } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type AppointmentRow = { id: string; reference: string };

/**
 * Daily reminder job, invoked by Vercel Cron.
 *
 * Reminds every active appointment booked for the next clinic day (09:00 EAT /
 * 06:00 UTC). Appointments that already have a reminder row are skipped, so a
 * manual reminder or a retried cron run never duplicates messages.
 *
 * Requires CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY. Vercel sends the secret
 * as `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for scheduled reminders." },
      { status: 503 },
    );
  }

  const date = clinicDatePlus(1);
  const { data, error } = await supabase
    .from("appointments")
    .select("id, reference")
    .eq("appointment_date", date)
    .in("status", ["Booked", "Confirmed"])
    .order("appointment_time");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appointments = (data ?? []) as AppointmentRow[];
  const ids = appointments.map((appointment) => appointment.id);

  let alreadyReminded = new Set<string>();
  if (ids.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from("notifications")
      .select("appointment_id")
      .eq("template", "reminder")
      .in("appointment_id", ids);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    alreadyReminded = new Set(
      (existing ?? [])
        .map((row) => (row as { appointment_id: string | null }).appointment_id)
        .filter((id): id is string => Boolean(id)),
    );
  }

  const results: Array<{
    reference: string;
    deliveries?: { channel: string; status: string }[];
    skipped?: boolean;
    error?: string;
  }> = [];

  for (const appointment of appointments) {
    if (alreadyReminded.has(appointment.id)) {
      results.push({ reference: appointment.reference, skipped: true });
      continue;
    }

    try {
      const deliveries = await queueAppointmentNotification(appointment.id, "reminder", {
        client: supabase,
      });
      results.push({ reference: appointment.reference, deliveries });
    } catch (caught) {
      results.push({
        reference: appointment.reference,
        error: caught instanceof Error ? caught.message : "Reminder failed.",
      });
    }
  }

  return NextResponse.json({
    date,
    due: appointments.length,
    skipped: results.filter((result) => result.skipped).length,
    attempted: results.filter((result) => !result.skipped).length,
    results,
  });
}
