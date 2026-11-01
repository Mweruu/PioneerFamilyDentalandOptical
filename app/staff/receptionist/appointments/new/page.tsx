import Link from "next/link";
import { ArrowLeft, CalendarPlus, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { PatientSearch } from "@/components/staff/patient-search";
import { PatientBanner } from "@/components/staff/patient-banner";
import { StaffBookingForm } from "@/components/staff/staff-booking-form";
import { requireRole } from "@/lib/auth";
import { getDoctors, getPatient, getServices, listPatients, searchPatients } from "@/lib/data/queries";
import { clinicToday } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Book Appointment" };

export default async function NewReceptionAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; q?: string; department?: string; error?: string; success?: string }>;
}) {
  await requireRole("receptionist");
  const params = await searchParams;
  const patient = params.patientId ? getPatient(params.patientId) : undefined;
  const doctors = getDoctors();
  const services = getServices();
  const today = clinicToday();

  if (!patient) {
    const query = params.q?.trim();
    const patients = query ? searchPatients(query) : listPatients(12);
    return (
      <div>
        <PageHeader
          eyebrow="Step 1 of 2"
          title="Select the patient"
          description="Staff bookings are always linked to a registered patient record. Register a new patient first if they are not on file."
          actions={<Link href="/staff/receptionist/appointments" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Link>}
        />
        <Flash error={params.error} success={params.success} />

        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
          <Section title="Find a registered patient" description="Search by full name, phone number or patient number.">
            <PatientSearch action="/staff/receptionist/appointments/new" defaultValue={query} />
            <ul className="mt-4 divide-y divide-line">
              {patients.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/staff/receptionist/appointments/new?patientId=${item.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-navy-50/60"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-500">
                        <UserRound className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-navy-900">{item.full_name}</span>
                        <span className="block text-[11px] text-navy-400">{item.patient_number} · {item.phone}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-teal-700">Select →</span>
                  </Link>
                </li>
              ))}
              {!patients.length && (
                <li className="py-8 text-center text-xs text-navy-500">
                  No patients match that search.{" "}
                  <Link href="/staff/receptionist/patients/new" className="font-bold text-teal-700">Register a new patient</Link>.
                </li>
              )}
            </ul>
          </Section>

          <div className="card p-5">
            <CalendarPlus className="h-5 w-5 text-teal-600" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold text-navy-900">New patient?</h2>
            <p className="mt-1 text-xs leading-5 text-navy-500">
              Register the patient first. You can return to this screen and the new record will be available.
            </p>
            <Link href="/staff/receptionist/patients/new" className="btn-secondary mt-4 w-full">Register patient</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Step 2 of 2"
        title="Book an appointment"
        description="Availability is checked against the clinician's schedule and existing bookings before saving."
        actions={<Link href="/staff/receptionist/appointments/new" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Change patient</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="space-y-5">
        <PatientBanner patient={patient} />
        <Section title="Appointment details">
          <StaffBookingForm
            patient={patient}
            doctors={doctors}
            services={services}
            today={today}
            initialDepartment={params.department === "optical" ? "optical" : "dental"}
          />
        </Section>
      </div>
    </div>
  );
}
