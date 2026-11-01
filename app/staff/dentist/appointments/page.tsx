import Link from "next/link";
import { CalendarDays, Filter, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { AppointmentTable } from "@/components/staff/appointment-table";
import { requireRole } from "@/lib/auth";
import { getAppointments } from "@/lib/data/queries";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/types";
import { clinicToday, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Dental Appointments" };

export default async function DentistAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string; error?: string; success?: string }>;
}) {
  const user = await requireRole("dentist");
  const params = await searchParams;
  const date = params.date ?? clinicToday();
  const status = APPOINTMENT_STATUSES.includes(params.status as AppointmentStatus)
    ? (params.status as AppointmentStatus)
    : undefined;
  const appointments = getAppointments({
    doctorId: user.id,
    department: "dental",
    date: date || undefined,
    status,
    query: params.q?.trim() || undefined,
    limit: 300,
  });
  const active = appointments.filter((appointment) => !["Completed", "Cancelled", "No Show"].includes(appointment.status));

  return (
    <div>
      <PageHeader
        eyebrow="Dental schedule"
        title="My appointments"
        description="Your dental bookings, check-ins and consultations. Open an appointment to review the patient and start care."
        actions={<Link href="/staff/dentist/patients" className="btn-secondary">Find a patient</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[150px_1fr_180px_auto] lg:items-end">
        <div>
          <label htmlFor="dentistDate" className="label">Date</label>
          <input id="dentistDate" name="date" type="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label htmlFor="dentistQuery" className="label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input id="dentistQuery" name="q" defaultValue={params.q} className="input !pl-9" placeholder="Name, phone or reference" />
          </div>
        </div>
        <div>
          <label htmlFor="dentistStatus" className="label">Status</label>
          <select id="dentistStatus" name="status" defaultValue={status ?? ""} className="select">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary"><Filter className="h-4 w-4" aria-hidden /> Apply</button>
          <Link href="/staff/dentist/appointments?date=" className="btn-secondary">All dates</Link>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-navy-500">
          <CalendarDays className="h-4 w-4 text-navy-400" aria-hidden />
          {date ? formatDate(date, { weekday: "long" }) : "All dates"} · <strong className="text-navy-800">{appointments.length}</strong> appointments · {active.length} active
        </p>
        <Link href="/staff/dentist/follow-ups" className="text-xs font-bold text-teal-700 hover:text-teal-900">Treatment follow-ups →</Link>
      </div>

      <AppointmentTable
        appointments={appointments}
        basePath="/staff/dentist/appointments"
        showDate
        showClinician={false}
        emptyMessage="No dental appointments match these filters."
      />
    </div>
  );
}
