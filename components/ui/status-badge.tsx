import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  Booked: "bg-sky-50 text-sky-700 ring-sky-200",
  Confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
  "Checked In": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Waiting for Doctor": "bg-amber-50 text-amber-800 ring-amber-200",
  "In Consultation": "bg-violet-50 text-violet-700 ring-violet-200",
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  "No Show": "bg-rose-50 text-rose-700 ring-rose-200",
  Waiting: "bg-amber-50 text-amber-800 ring-amber-200",
  "In Progress": "bg-violet-50 text-violet-700 ring-violet-200",
  Planned: "bg-sky-50 text-sky-700 ring-sky-200",
  Monitoring: "bg-teal-50 text-teal-700 ring-teal-200",
  Healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Dental caries": "bg-amber-50 text-amber-800 ring-amber-200",
  Fracture: "bg-orange-50 text-orange-700 ring-orange-200",
  "Missing tooth": "bg-slate-100 text-slate-600 ring-slate-200",
  "Existing filling / restoration": "bg-sky-50 text-sky-700 ring-sky-200",
  Crown: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Root canal treated": "bg-violet-50 text-violet-700 ring-violet-200",
  "Extraction required": "bg-rose-50 text-rose-700 ring-rose-200",
  Extracted: "bg-slate-100 text-slate-500 ring-slate-200",
  Other: "bg-navy-50 text-navy-700 ring-navy-200",
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Medium: "bg-amber-50 text-amber-800 ring-amber-200",
  High: "bg-rose-50 text-rose-700 ring-rose-200",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  queued: "bg-sky-50 text-sky-700 ring-sky-200",
  not_configured: "bg-amber-50 text-amber-800 ring-amber-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status, className }: { status: string | AppointmentStatus; className?: string }) {
  const style = STATUS_STYLES[status] ?? "bg-navy-50 text-navy-700 ring-navy-200";
  return (
    <span className={cn("badge", style, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" aria-hidden />
      {status.replaceAll("_", " ")}
    </span>
  );
}
