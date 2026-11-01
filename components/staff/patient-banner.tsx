import { AlertTriangle, CalendarDays, Phone, ShieldCheck, UserRound } from "lucide-react";
import type { Patient } from "@/lib/types";
import { ageFromDob, formatDate, initials } from "@/lib/utils";

export function PatientBanner({
  patient,
  actions,
  showContact = true,
}: {
  patient: Patient;
  actions?: React.ReactNode;
  showContact?: boolean;
}) {
  const age = ageFromDob(patient.date_of_birth);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-navy-900 text-lg font-bold text-white">
            {initials(patient.full_name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-navy-950">{patient.full_name}</h2>
              <span className="badge bg-navy-50 text-navy-700 ring-navy-200">{patient.patient_number}</span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-navy-400" aria-hidden />
                {patient.gender || "Gender not recorded"}
                {age !== null ? ` · ${age} years` : ""}
                {patient.date_of_birth ? ` · Born ${formatDate(patient.date_of_birth)}` : ""}
              </span>
              {showContact && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-navy-400" aria-hidden />
                  {patient.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-navy-400" aria-hidden />
                Registered {formatDate(patient.created_at)}
              </span>
            </p>
            {patient.conditions && (
              <p className="mt-2 text-xs leading-5 text-navy-500">
                <span className="font-semibold text-navy-700">Conditions:</span> {patient.conditions}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {patient.allergies && !/^none/i.test(patient.allergies) && (
        <div className="flex items-start gap-2.5 border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            <strong className="font-bold">Allergy alert:</strong> {patient.allergies}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line bg-mist px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-400">
        <ShieldCheck className="h-3.5 w-3.5 text-teal-600" aria-hidden />
        Shared master patient record · Clinical notes remain department-specific
      </div>
    </div>
  );
}
