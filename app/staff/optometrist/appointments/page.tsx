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

export const metadata = { title: "My Optical Appointments" };

export default async function OptometristAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string; error?: string; success?: string }>;
}) {
  const user = await requireRole("eye_doctor");
  const params = await searchParams;
  const date = params.date ?? clinicToday();
  const status = APPOINTMENT_STATUSES.includes(params.status as AppointmentStatus)
    ? (params.status as AppointmentStatus)
    : undefined;
  const appointments = await getAppointments({
    doctorId: user.id,
    department: "optical",
    date: date || undefined,
    status,
    query: params.q?.trim() || undefined,
    limit: 300,
  });
  const active = appointments.filter((appointment) => !["Completed", "Cancelled", "No Show"].includes(appointment.status));

  return (
    <div>
      <PageHeader
        eyebrow="Optical schedule"
        title="My appointments"
        description="Your eye examination bookings, check-ins and consultations. Open an appointment to review the patient and begin the examination."
        actions={<Link href="/staff/optometrist/patients" className="btn-secondary">Find a patient</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[150px_1fr_180px_auto] lg:items-end">
        <div>
          <label htmlFor="opticalDate" className="label">Date</label>
          <input id="opticalDate" name="date" type="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label htmlFor="opticalQuery" className="label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input id="opticalQuery" name="q" defaultValue={params.q} className="input !pl-9" placeholder="Name, phone or reference" />
          </div>
        </div>
        <div>
          <label htmlFor="opticalStatus" className="label">Status</label>
          <select id="opticalStatus" name="status" defaultValue={status ?? ""} className="select">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary"><Filter className="h-4 w-4" aria-hidden /> Apply</button>
          <Link href="/staff/optometrist/appointments?date=" className="btn-secondary">All dates</Link>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-navy-500">
          <CalendarDays className="h-4 w-4 text-navy-400" aria-hidden />
          {date ? formatDate(date, { weekday: "long" }) : "All dates"} · <strong className="text-navy-800">{appointments.length}</strong> appointments · {active.length} active
        </p>
        <Link href="/staff/optometrist/follow-ups" className="text-xs font-bold text-teal-700 hover:text-teal-900">Optical follow-ups →</Link>
      </div>

      <AppointmentTable
        appointments={appointments}
        basePath="/staff/optometrist/appointments"
        showDate
        showClinician={false}
        emptyMessage="No optical appointments match these filters."
      />
    </div>
  );
}
