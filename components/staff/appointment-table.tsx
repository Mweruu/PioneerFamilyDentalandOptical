import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Appointment } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import { cn, formatDate, formatTime } from "@/lib/utils";

export function AppointmentTable({
  appointments,
  basePath,
  showDate = false,
  showClinician = true,
  emptyMessage = "No appointments match these filters.",
}: {
  appointments: Appointment[];
  basePath: string;
  showDate?: boolean;
  showClinician?: boolean;
  emptyMessage?: string;
}) {
  if (!appointments.length) {
    return <p className="rounded-xl border border-dashed border-line bg-mist px-4 py-8 text-center text-xs text-navy-500">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{showDate ? "Date & time" : "Time"}</th>
            <th>Patient</th>
            <th>Department</th>
            <th>Service</th>
            {showClinician && <th>Clinician</th>}
            <th>Status</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>
                <span className="block font-semibold text-navy-900">{formatTime(appointment.appointment_time)}</span>
                <span className="block text-[11px] text-navy-400">
                  {showDate ? formatDate(appointment.appointment_date) : `${appointment.duration_minutes} min`}
                </span>
              </td>
              <td>
                <span className="block font-semibold text-navy-900">{appointment.full_name}</span>
                <span className="block text-[11px] text-navy-400">
                  {appointment.patient_number || "Not linked"} · {appointment.reference}
                </span>
              </td>
              <td>
                <span
                  className={cn(
                    "badge",
                    appointment.department === "dental"
                      ? "bg-teal-50 text-teal-700 ring-teal-200"
                      : "bg-sky-50 text-sky-700 ring-sky-200",
                  )}
                >
                  {DEPARTMENTS[appointment.department]}
                </span>
              </td>
              <td>
                <span className="block max-w-[180px] truncate text-xs text-navy-600">{appointment.service_name || "—"}</span>
              </td>
              {showClinician && <td className="text-xs">{appointment.doctor_name}</td>}
              <td><StatusBadge status={appointment.status} /></td>
              <td className="text-right">
                <Link
                  href={`${basePath}/${appointment.id}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50"
                >
                  Open <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
