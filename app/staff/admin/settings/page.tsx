import Link from "next/link";
import { Bell, LockKeyhole, Save, Settings, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/data/queries";
import { saveSettingsAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clinic Settings" };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const settings = await getSettings();
  const value = (key: string, fallback = "") => settings[key] ?? fallback;

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Clinic settings"
        description="Public contact details, booking defaults, notification preferences and the privacy contact shown to patients."
        actions={<Link href="/staff/admin/notifications" className="btn-secondary"><Bell className="h-4 w-4" aria-hidden /> Notifications</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <form action={saveSettingsAction} className="space-y-5">
          <input type="hidden" name="returnTo" value="/staff/admin/settings" />
          <Section title="Clinic identity" description="Used on the public site, booking confirmations and printed records.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="clinicName" className="label">Clinic name *</label>
                <input id="clinicName" name="setting_clinic_name" className="input" defaultValue={value("clinic_name", "Pioneer Family Dental and Optical Clinic")} required />
              </div>
              <div>
                <label htmlFor="clinicPhone" className="label">Phone</label>
                <input id="clinicPhone" name="setting_clinic_phone" className="input" defaultValue={value("clinic_phone")} placeholder="+254 7xx xxx xxx" />
              </div>
              <div>
                <label htmlFor="clinicEmail" className="label">Email</label>
                <input id="clinicEmail" name="setting_clinic_email" type="email" className="input" defaultValue={value("clinic_email")} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="clinicAddress" className="label">Physical address</label>
                <input id="clinicAddress" name="setting_clinic_address" className="input" defaultValue={value("clinic_address")} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="clinicHours" className="label">Opening hours</label>
                <textarea id="clinicHours" name="setting_clinic_hours" className="textarea !min-h-20" defaultValue={value("clinic_hours")} />
              </div>
            </div>
          </Section>

          <Section title="Booking defaults" description="Fallback duration for services without a specific duration.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="appointmentDuration" className="label">Default appointment length (minutes)</label>
                <input id="appointmentDuration" name="setting_appointment_duration" type="number" min={5} max={240} className="input" defaultValue={value("appointment_duration", "30")} />
              </div>
              <div>
                <label htmlFor="notificationSender" className="label">SMS sender ID</label>
                <input id="notificationSender" name="setting_notification_sender" className="input" defaultValue={value("notification_sender", "PIONEER")} />
              </div>
            </div>
          </Section>

          <Section title="Notifications" description="These switches are checked before any reminder is queued.">
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" name="setting_notification_sms_enabled" defaultChecked={value("notification_sms_enabled") === "true"} className="mt-0.5 h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                <span>
                  <span className="block text-xs font-semibold text-navy-900">Enable SMS reminders</span>
                  <span className="mt-0.5 block text-[10px] leading-5 text-navy-400">Requires Africa&apos;s Talking credentials in the server environment.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" name="setting_notification_email_enabled" defaultChecked={value("notification_email_enabled") === "true"} className="mt-0.5 h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                <span>
                  <span className="block text-xs font-semibold text-navy-900">Enable email reminders</span>
                  <span className="mt-0.5 block text-[10px] leading-5 text-navy-400">Requires a Resend API key and verified sender address.</span>
                </span>
              </label>
            </div>
          </Section>

          <Section title="Privacy contact" description="Shown in the public privacy notice for data subject requests.">
            <div>
              <label htmlFor="privacyContact" className="label">Privacy contact</label>
              <input id="privacyContact" name="setting_privacy_contact" className="input" defaultValue={value("privacy_contact")} placeholder="e.g. privacy@pioneerclinic.co.ke" />
            </div>
          </Section>

          <div className="flex justify-end">
            <SubmitButton pendingText="Saving settings…"><Save className="h-4 w-4" aria-hidden /> Save all settings</SubmitButton>
          </div>
        </form>

        <div className="space-y-5">
          <Section title="Security posture">
            <ul className="space-y-2.5 text-[11px] leading-5 text-navy-600">
              <li className="flex items-start gap-2"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden /> Passwords and password resets are managed by Supabase Auth; every table is protected by PostgreSQL Row Level Security.</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden /> Sessions use short-lived Supabase tokens stored in HTTP-only cookies and refreshed by the proxy.</li>
              <li className="flex items-start gap-2"><Settings className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden /> Every server action re-checks the signed-in staff role.</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden /> Sensitive actions and clinical record views are written to the audit log.</li>
            </ul>
          </Section>

          <Section title="Environment checks">
            <ul className="space-y-2 text-[11px] leading-5 text-navy-600">
              <li className="flex items-center justify-between gap-2">
                <span>Supabase URL</span>
                <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-amber-50 text-amber-800 ring-amber-200"}>
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Publishable key</span>
                <span className={process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-amber-50 text-amber-800 ring-amber-200"}>
                  {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "Set" : "Not set"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Service-role key (optional)</span>
                <span className={process.env.SUPABASE_SERVICE_ROLE_KEY ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-slate-50 text-slate-700 ring-slate-200"}>
                  {process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Using RPC fallback"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>App URL</span>
                <span className={process.env.NEXT_PUBLIC_APP_URL ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-amber-50 text-amber-800 ring-amber-200"}>
                  {process.env.NEXT_PUBLIC_APP_URL ? "Set" : "Not set"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Database</span>
                <span className="badge bg-sky-50 text-sky-700 ring-sky-200">Supabase Postgres</span>
              </li>
            </ul>
            <p className="mt-3 text-[10px] leading-5 text-navy-400">
              Set production secrets in the hosting environment. Never commit API keys or service-role keys to the repository.
            </p>
          </Section>

          <div className="card p-4 text-[11px] leading-5 text-navy-500">
            <p className="font-semibold text-navy-800">Data protection</p>
            <p className="mt-2">The clinic processes health data under the Kenya Data Protection Act, 2019. Keep the privacy contact current and respond to access or correction requests promptly.</p>
            <Link href="/privacy" className="mt-2 inline-flex font-bold text-teal-700 hover:text-teal-900">View public privacy notice →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
