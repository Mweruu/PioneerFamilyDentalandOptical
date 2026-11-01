import Link from "next/link";
import { ArrowLeft, CalendarCheck, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { getAppointment } from "@/lib/data/queries";
import { registerPatientAction } from "@/lib/actions/reception";
import { clinicToday, formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Register Patient" };

type Params = {
  appointmentId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  error?: string;
  success?: string;
};

export default async function RegisterPatientPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole("receptionist");
  const params = await searchParams;
  const appointment = params.appointmentId ? getAppointment(params.appointmentId) : undefined;
  const currentQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "error" && key !== "success") currentQuery.set(key, value);
  }
  const returnTo = `/staff/receptionist/patients/new${currentQuery.size ? `?${currentQuery.toString()}` : ""}`;

  return (
    <div>
      <PageHeader
        eyebrow="Master patient record"
        title="Register a patient"
        description="Create one shared record for dental and optical care. Only collect information you need for care and administration."
        actions={<Link href="/staff/receptionist/patients" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to patients</Link>}
      />
      <Flash error={params.error} success={params.success} />

      {appointment && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <div>
            <p className="font-semibold">Registering from online booking {appointment.reference}</p>
            <p className="mt-0.5">
              {formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)} · {appointment.doctor_name}.
              The booking will be linked automatically when you save.
            </p>
          </div>
        </div>
      )}

      <form action={registerPatientAction} className="space-y-5">
        <input type="hidden" name="returnTo" value={returnTo} />
        {appointment && <input type="hidden" name="appointmentId" value={appointment.id} />}

        <Section title="Identity and contact" description="Fields marked with * are required.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="label">Full name *</label>
              <input id="fullName" name="fullName" className="input" defaultValue={params.fullName ?? appointment?.full_name ?? ""} autoComplete="name" required />
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone number *</label>
              <input id="phone" name="phone" type="tel" className="input" defaultValue={params.phone ?? appointment?.phone ?? ""} autoComplete="tel" placeholder="07xx xxx xxx" required />
            </div>
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input id="email" name="email" type="email" className="input" defaultValue={params.email ?? appointment?.email ?? ""} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="dateOfBirth" className="label">Date of birth</label>
              <input id="dateOfBirth" name="dateOfBirth" type="date" className="input" max={clinicToday()} defaultValue={params.dateOfBirth ?? appointment?.date_of_birth ?? ""} autoComplete="bday" />
            </div>
            <div>
              <label htmlFor="gender" className="label">Gender</label>
              <select id="gender" name="gender" className="select" defaultValue={params.gender ?? appointment?.gender ?? ""}>
                <option value="">Not recorded</option>
                <option>Female</option>
                <option>Male</option>
                <option>Intersex</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="address" className="label">Home address</label>
              <input id="address" name="address" className="input" placeholder="Estate, town or city" autoComplete="street-address" />
            </div>
          </div>
        </Section>

        <Section title="Emergency contact" description="Optional, but helpful for urgent situations.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="emergencyContactName" className="label">Contact name</label>
              <input id="emergencyContactName" name="emergencyContactName" className="input" />
            </div>
            <div>
              <label htmlFor="emergencyContactPhone" className="label">Contact phone</label>
              <input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" className="input" />
            </div>
          </div>
        </Section>

        <Section title="Medical safety information" description="Shared with both clinical teams so care is safe. Please confirm with the patient.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="allergies" className="label">Allergies</label>
              <input id="allergies" name="allergies" className="input" placeholder="e.g. Penicillin, latex, or 'None known'" />
            </div>
            <div>
              <label htmlFor="conditions" className="label">Existing conditions</label>
              <textarea id="conditions" name="conditions" className="textarea" placeholder="e.g. Hypertension, diabetes, asthma" />
            </div>
            <div>
              <label htmlFor="medications" className="label">Current medications</label>
              <textarea id="medications" name="medications" className="textarea" placeholder="Include dose and frequency where known" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="medicalHistory" className="label">Relevant medical history</label>
              <textarea id="medicalHistory" name="medicalHistory" className="textarea" placeholder="Past surgeries, hospital admissions or anything the clinical team should know" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="adminNotes" className="label">Front-desk notes</label>
              <textarea id="adminNotes" name="adminNotes" className="textarea" placeholder="Accessibility needs, preferred language or communication notes" />
            </div>
          </div>
        </Section>

        <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex max-w-xl items-start gap-2.5 text-xs leading-5 text-navy-600">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />
            <span>
              I confirm the patient has been given the{" "}
              <Link href="/privacy" target="_blank" className="font-semibold text-navy-900 underline">privacy notice</Link>{" "}
              and understands how their information will be used.
            </span>
          </label>
          <SubmitButton pendingText="Registering…">
            <UserPlus className="h-4 w-4" aria-hidden /> Register patient
          </SubmitButton>
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-5 text-navy-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
          Registration is audited. Avoid recording information that is not needed for care or clinic administration.
        </p>
      </form>
    </div>
  );
}
