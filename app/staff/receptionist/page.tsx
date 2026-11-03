import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  ListOrdered,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { AppointmentTable } from "@/components/staff/appointment-table";
import { requireRole } from "@/lib/auth";
import {
  getDashboardCounts,
  getTodayAppointments,
  getWaitingPatients,
  listPatients,
} from "@/lib/data/queries";
import { clinicToday, formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Front Desk Overview" };

export default async function ReceptionistDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("receptionist");
  const params = await searchParams;
  const today = clinicToday();
  const appointments = await getTodayAppointments();
  const counts = await getDashboardCounts(today);
  const queue = [...(await getWaitingPatients("dental")), ...(await getWaitingPatients("optical"))].sort((a, b) =>
    a.appointment_time.localeCompare(b.appointment_time),
  );
  const unlinked = appointments.filter((appointment) => !appointment.patient_id);
  const recentPatients = await listPatients(6);

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(today, { weekday: "long" })}
        title={`Good day, ${user.name.split(" ")[0]}.`}
        description="Register patients, manage today's schedule and keep the clinical queues moving."
        actions={
          <>
            <Link href="/staff/receptionist/patients/new" className="btn-secondary">
              <UserPlus className="h-4 w-4" aria-hidden /> Register patient
            </Link>
            <Link href="/staff/receptionist/appointments/new" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> Book appointment
            </Link>
          </>
        }
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's appointments" value={counts.total} hint={`${counts.booked + counts.confirmed} awaiting arrival`} icon={CalendarDays} tone="navy" />
        <StatCard label="In the queue" value={queue.length} hint={`${counts.inConsultation} in consultation`} icon={ListOrdered} tone="amber" />
        <StatCard label="Checked in" value={counts.checkedIn + counts.waiting} hint="Ready for a clinician" icon={Clock} tone="sky" />
        <StatCard label="Completed today" value={counts.completed} hint={`${counts.cancelled} cancelled · ${counts.noShow} no-show`} icon={CheckCircle2} tone="emerald" />
      </div>

      {unlinked.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {unlinked.length} online booking{unlinked.length === 1 ? "" : "s"} need a patient record
              </p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                Match each booking to an existing record or register the patient. Bookings are never merged automatically by phone number.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unlinked.slice(0, 4).map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/staff/receptionist/appointments/${appointment.id}`}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    {appointment.full_name} · {formatTime(appointment.appointment_time)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Section
          title="Today's schedule"
          description="All dental and optical appointments for today."
          action={<Link href="/staff/receptionist/appointments" className="text-xs font-bold text-teal-700 hover:text-teal-900">View all →</Link>}
          bodyClassName="p-0"
        >
          <AppointmentTable appointments={appointments.slice(0, 12)} basePath="/staff/receptionist/appointments" />
        </Section>

        <div className="space-y-5">
          <Section
            title="Clinical queue"
            description="Checked-in patients waiting to be seen."
            action={<Link href="/staff/receptionist/queue" className="text-xs font-bold text-teal-700 hover:text-teal-900">Manage →</Link>}
          >
            {queue.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-6 text-center text-xs text-navy-500">
                The queue is empty. Check patients in from today&apos;s schedule.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {queue.slice(0, 6).map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{appointment.full_name}</p>
                      <p className="text-[10px] text-navy-400">
                        {formatTime(appointment.appointment_time)} · {appointment.doctor_name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                      {appointment.department === "dental" ? "Dental" : "Optical"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recently registered" action={<Link href="/staff/receptionist/patients" className="text-xs font-bold text-teal-700 hover:text-teal-900">All patients →</Link>}>
            <ul className="space-y-2.5">
              {recentPatients.map((patient) => (
                <li key={patient.id}>
                  <Link href={`/staff/receptionist/patients/${patient.id}`} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1.5 hover:bg-navy-50">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-navy-900">{patient.full_name}</p>
                      <p className="text-[10px] text-navy-400">{patient.patient_number} · {patient.phone}</p>
                    </div>
                    <Users className="h-3.5 w-3.5 shrink-0 text-navy-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/staff/receptionist/queue" className="card flex items-center gap-3 p-4 transition hover:border-navy-200 hover:shadow-lift">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><ListOrdered className="h-5 w-5" aria-hidden /></span>
          <span><span className="block text-sm font-semibold text-navy-900">Manage queue</span><span className="block text-[11px] text-navy-400">Check in and add walk-ins</span></span>
        </Link>
        <Link href="/staff/receptionist/appointments" className="card flex items-center gap-3 p-4 transition hover:border-navy-200 hover:shadow-lift">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><CalendarCheck className="h-5 w-5" aria-hidden /></span>
          <span><span className="block text-sm font-semibold text-navy-900">Appointments</span><span className="block text-[11px] text-navy-400">Search, confirm and reschedule</span></span>
        </Link>
        <Link href="/staff/receptionist/patients" className="card flex items-center gap-3 p-4 transition hover:border-navy-200 hover:shadow-lift">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Users className="h-5 w-5" aria-hidden /></span>
          <span><span className="block text-sm font-semibold text-navy-900">Patient records</span><span className="block text-[11px] text-navy-400">Find and update master details</span></span>
        </Link>
      </div>
    </div>
  );
}
