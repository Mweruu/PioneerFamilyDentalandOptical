import Link from "next/link";
import { Bell, Mail, MessageSquare, Send, Settings, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { getAppointments, getNotificationRows, getSettings } from "@/lib/data/queries";
import { queueAppointmentReminderAction, updateNotificationFlagsAction } from "@/lib/actions/admin";
import { clinicToday, formatDate, formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const settings = await getSettings();
  const notifications = await getNotificationRows(60);
  const upcoming = (await getAppointments({ fromDate: clinicToday(), limit: 60 })).filter(
    (appointment) => !["Cancelled", "No Show", "Completed"].includes(appointment.status),
  );
  const smsEnabled = settings.notification_sms_enabled === "true";
  const emailEnabled = settings.notification_email_enabled === "true";
  const smsConfigured = Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL);
  const queued = notifications.filter((row) => row.status === "queued").length;
  const sent = notifications.filter((row) => row.status === "sent").length;
  const failed = notifications.filter((row) => row.status === "failed").length;
  const notConfigured = notifications.filter((row) => row.status === "not_configured").length;

  return (
    <div>
      <PageHeader
        eyebrow="Patient communication"
        title="Notifications"
        description="Queue appointment reminders and monitor SMS and email delivery. Provider credentials are configured through environment variables."
        actions={<Link href="/staff/admin/settings" className="btn-secondary"><Settings className="h-4 w-4" aria-hidden /> Settings</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Queued</p><p className="mt-1 text-2xl font-semibold text-sky-700">{queued}</p></div>
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Sent</p><p className="mt-1 text-2xl font-semibold text-emerald-700">{sent}</p></div>
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Failed</p><p className="mt-1 text-2xl font-semibold text-rose-700">{failed}</p></div>
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">Not configured</p><p className="mt-1 text-2xl font-semibold text-amber-700">{notConfigured}</p></div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="Queue a reminder" description="Active upcoming appointments across both departments." bodyClassName="p-0">
            {upcoming.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No upcoming appointments to remind.</p>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th>Appointment</th>
                      <th>Patient</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th><span className="sr-only">Send</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>
                          <p className="text-xs font-semibold text-navy-900">{formatDate(appointment.appointment_date)}</p>
                          <p className="text-[10px] text-navy-400">{formatTime(appointment.appointment_time)} · {appointment.reference}</p>
                        </td>
                        <td className="text-xs">{appointment.full_name}</td>
                        <td className="text-[11px] text-navy-500">
                          <p>{appointment.phone}</p>
                          {appointment.email && <p className="text-[10px] text-navy-400">{appointment.email}</p>}
                        </td>
                        <td><StatusBadge status={appointment.status} /></td>
                        <td>
                          <form action={queueAppointmentReminderAction}>
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <input type="hidden" name="returnTo" value="/staff/admin/notifications" />
                            <SubmitButton className="!min-h-8 !px-2 !text-[11px]" pendingText="Queueing…"><Send className="h-3 w-3" aria-hidden /> Remind</SubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Notification log" description="Most recent messages and their delivery status." bodyClassName="p-0">
            {notifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-navy-500">No notifications have been queued.</p>
            ) : (
              <div className="table-wrap !rounded-none !border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Channel</th>
                      <th>Recipient</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap text-[11px] text-navy-500">{formatDateTime(row.created_at)}</td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700">
                            {row.channel === "sms" ? <MessageSquare className="h-3.5 w-3.5 text-teal-600" aria-hidden /> : <Mail className="h-3.5 w-3.5 text-sky-600" aria-hidden />}
                            {row.channel.toUpperCase()}
                          </span>
                        </td>
                        <td className="max-w-[180px] truncate text-[11px] text-navy-600">{row.recipient}</td>
                        <td className="text-[11px] text-navy-600">{row.template}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td className="max-w-[220px] whitespace-normal text-[10px] leading-4 text-navy-400">{row.error || row.sent_at ? row.error || formatDateTime(row.sent_at) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Channel preferences" description="Toggle patient messaging. Provider credentials are required for delivery.">
            <form action={updateNotificationFlagsAction} className="space-y-3">
              <input type="hidden" name="returnTo" value="/staff/admin/notifications" />
              <label className="flex items-start gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" name="smsEnabled" defaultChecked={smsEnabled} className="mt-0.5 h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                <span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-900"><MessageSquare className="h-3.5 w-3.5 text-teal-600" aria-hidden /> SMS reminders</span>
                  <span className="mt-0.5 block text-[10px] leading-5 text-navy-400">{smsConfigured ? "Africa's Talking credentials detected." : "Africa's Talking credentials not configured."}</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" name="emailEnabled" defaultChecked={emailEnabled} className="mt-0.5 h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                <span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-900"><Mail className="h-3.5 w-3.5 text-sky-600" aria-hidden /> Email reminders</span>
                  <span className="mt-0.5 block text-[10px] leading-5 text-navy-400">{emailConfigured ? "Resend credentials detected." : "Resend credentials not configured."}</span>
                </span>
              </label>
              <SubmitButton className="w-full" pendingText="Saving…">Save preferences</SubmitButton>
            </form>
          </Section>

          <Section title="Provider status">
            <ul className="space-y-2.5 text-[11px] leading-5 text-navy-600">
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-navy-400" aria-hidden /> Africa&apos;s Talking</span>
                <span className={smsConfigured ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-amber-50 text-amber-800 ring-amber-200"}>{smsConfigured ? "Configured" : "Not configured"}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-navy-400" aria-hidden /> Resend email</span>
                <span className={emailConfigured ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-amber-50 text-amber-800 ring-amber-200"}>{emailConfigured ? "Configured" : "Not configured"}</span>
              </li>
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-navy-400">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" aria-hidden />
              Reminders contain only the patient name, appointment date, time and clinic contact details. No clinical information is sent.
            </p>
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="flex items-center gap-2 font-semibold text-navy-800"><Bell className="h-4 w-4 text-teal-600" aria-hidden /> Reminder policy</p>
            <p className="mt-2">Send reminders at least 24 hours before an appointment. Do not send reminders for cancelled, completed or no-show bookings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
