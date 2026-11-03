import Link from "next/link";
import { CalendarDays, Filter, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { AppointmentTable } from "@/components/staff/appointment-table";
import { requireRole } from "@/lib/auth";
import { getAppointments } from "@/lib/data/queries";
import { APPOINTMENT_STATUSES, type AppointmentStatus, type Department } from "@/lib/types";
import { clinicToday, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Appointments" };

export default async function ReceptionAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; department?: string; status?: string; q?: string; error?: string; success?: string }>;
}) {
  await requireRole("receptionist");
  const params = await searchParams;
  const date = params.date ?? clinicToday();
  const department = params.department === "dental" || params.department === "optical" ? (params.department as Department) : undefined;
  const status = APPOINTMENT_STATUSES.includes(params.status as AppointmentStatus)
    ? (params.status as AppointmentStatus)
    : undefined;

  const appointments = await getAppointments({
    date: date || undefined,
    department,
    status,
    query: params.q?.trim() || undefined,
    limit: 300,
  });

  const counts = {
    total: appointments.length,
    unlinked: appointments.filter((appointment) => !appointment.patient_id).length,
    active: appointments.filter((appointment) => !["Completed", "Cancelled", "No Show"].includes(appointment.status)).length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Front desk"
        title="Appointments"
        description="Search the schedule, confirm bookings, check patients in and manage the day."
        actions={
          <Link href="/staff/receptionist/appointments/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> Book appointment
          </Link>
        }
      />
      <Flash error={params.error} success={params.success} />

      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[150px_1fr_150px_170px_auto] lg:items-end">
        <div>
          <label htmlFor="filterDate" className="label">Date</label>
          <input id="filterDate" name="date" type="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label htmlFor="filterQuery" className="label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input id="filterQuery" name="q" defaultValue={params.q} className="input !pl-9" placeholder="Name, phone or reference" />
          </div>
        </div>
        <div>
          <label htmlFor="filterDepartment" className="label">Department</label>
          <select id="filterDepartment" name="department" defaultValue={department ?? ""} className="select">
            <option value="">All</option>
            <option value="dental">Dental</option>
            <option value="optical">Optical</option>
          </select>
        </div>
        <div>
          <label htmlFor="filterStatus" className="label">Status</label>
          <select id="filterStatus" name="status" defaultValue={status ?? ""} className="select">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            <Filter className="h-4 w-4" aria-hidden /> Apply
          </button>
          <Link href="/staff/receptionist/appointments?date=" className="btn-secondary">All dates</Link>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-navy-500">
          <CalendarDays className="h-4 w-4 text-navy-400" aria-hidden />
          {date ? formatDate(date, { weekday: "long" }) : "All dates"} · <strong className="text-navy-800">{counts.total}</strong> appointments
          {counts.unlinked > 0 && <span className="text-amber-700">· {counts.unlinked} unlinked</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "All", value: "" },
            { label: "Dental", value: "dental" },
            { label: "Optical", value: "optical" },
          ].map((tab) => {
            const query = new URLSearchParams();
            if (date) query.set("date", date);
            if (params.q) query.set("q", params.q);
            if (params.status) query.set("status", params.status);
            if (tab.value) query.set("department", tab.value);
            const active = (department ?? "") === tab.value;
            return (
              <Link
                key={tab.label}
                href={`/staff/receptionist/appointments?${query.toString()}`}
                className={active ? "badge bg-navy-900 text-white ring-navy-900" : "badge bg-white text-navy-600 ring-line"}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <AppointmentTable appointments={appointments} basePath="/staff/receptionist/appointments" showDate />
    </div>
  );
}
