import Link from "next/link";
import { ChevronRight, Eye, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { PatientSearch } from "@/components/staff/patient-search";
import { requireRole } from "@/lib/auth";
import { listPatientsForDepartment } from "@/lib/data/queries";
import { ageFromDob, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Optical Patients" };

export default async function OptometristPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  await requireRole("eye_doctor");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const patients = await listPatientsForDepartment("optical", query, 100);

  return (
    <div>
      <PageHeader
        eyebrow="Optical records"
        title="Optical patients"
        description="Patients with an optical appointment or visit. Open a record to review eye examinations, prescriptions and follow-ups."
        actions={<Link href="/staff/optometrist/appointments" className="btn-secondary"><Eye className="h-4 w-4" aria-hidden /> My schedule</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <div className="card mb-5 p-4">
        <PatientSearch action="/staff/optometrist/patients" defaultValue={query} />
        <p className="mt-2 text-[11px] text-navy-400">
          {query ? `${patients.length} result(s) for “${query}”.` : `${patients.length} patient(s) with optical encounters.`}
        </p>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient number</th>
              <th>Full name</th>
              <th>Phone</th>
              <th>Age / gender</th>
              <th>Registered</th>
              <th><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => {
              const age = ageFromDob(patient.date_of_birth);
              return (
                <tr key={patient.id}>
                  <td className="font-mono text-xs font-semibold text-navy-800">{patient.patient_number}</td>
                  <td>
                    <Link href={`/staff/optometrist/patients/${patient.id}`} className="font-semibold text-navy-900 hover:text-teal-700">
                      {patient.full_name}
                    </Link>
                  </td>
                  <td className="text-xs">{patient.phone}</td>
                  <td className="text-xs">{age !== null ? `${age} yrs` : "—"} · {patient.gender || "—"}</td>
                  <td className="text-xs">{formatDate(patient.created_at)}</td>
                  <td className="text-right">
                    <Link href={`/staff/optometrist/patients/${patient.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50">
                      Open <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!patients.length && (
          <div className="px-6 py-12 text-center">
            <Eye className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-navy-800">No optical patients found</p>
            <p className="mt-1 text-xs text-navy-500">
              {query ? "Try another search term." : "Patients appear here after an optical appointment or visit."}
            </p>
            <Link href="/staff/optometrist/appointments" className="btn-secondary mt-4"><Users className="h-4 w-4" aria-hidden /> View optical schedule</Link>
          </div>
        )}
      </div>
    </div>
  );
}
