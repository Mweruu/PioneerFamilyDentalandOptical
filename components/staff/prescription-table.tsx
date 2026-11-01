import { Fragment } from "react";
import { Glasses } from "lucide-react";
import type { OpticalPrescription } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function value(value: string | null) {
  return value || "—";
}

export function PrescriptionTable({ prescriptions }: { prescriptions: OpticalPrescription[] }) {
  if (!prescriptions.length) {
    return (
      <div className="px-5 py-10 text-center">
        <Glasses className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-navy-800">No spectacle prescriptions</p>
        <p className="mt-1 text-xs text-navy-500">Prescriptions issued during an eye examination will appear here.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap !rounded-none !border-0">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Eye</th>
            <th>SPH</th>
            <th>CYL</th>
            <th>Axis</th>
            <th>Add</th>
            <th>Prism / base</th>
            <th>PD</th>
            <th>Lens</th>
            <th>Clinician</th>
          </tr>
        </thead>
        <tbody>
          {prescriptions.map((rx) => (
            <Fragment key={rx.id}>
            <tr>
              <td className="whitespace-nowrap text-xs font-semibold text-navy-800" rowSpan={2}>{formatDate(rx.prescribed_at)}</td>
              <td className="text-xs font-semibold text-navy-700">OD (right)</td>
              <td className="font-mono text-xs">{value(rx.od_sph)}</td>
              <td className="font-mono text-xs">{value(rx.od_cyl)}</td>
              <td className="font-mono text-xs">{value(rx.od_axis)}</td>
              <td className="font-mono text-xs">{value(rx.od_add)}</td>
              <td className="font-mono text-xs">{value(rx.od_prism)}{rx.od_base ? ` / ${rx.od_base}` : ""}</td>
              <td className="font-mono text-xs">{value(rx.pd_od ?? rx.pd)}</td>
              <td className="max-w-[150px] whitespace-normal text-[11px] text-navy-500" rowSpan={2}>{rx.lens_type || rx.lens_recommendation || "—"}</td>
              <td className="whitespace-nowrap text-xs" rowSpan={2}>{rx.doctor_name || "Clinician"}</td>
            </tr>
            <tr>
              <td className="text-xs font-semibold text-navy-700">OS (left)</td>
              <td className="font-mono text-xs">{value(rx.os_sph)}</td>
              <td className="font-mono text-xs">{value(rx.os_cyl)}</td>
              <td className="font-mono text-xs">{value(rx.os_axis)}</td>
              <td className="font-mono text-xs">{value(rx.os_add)}</td>
              <td className="font-mono text-xs">{value(rx.os_prism)}{rx.os_base ? ` / ${rx.os_base}` : ""}</td>
              <td className="font-mono text-xs">{value(rx.pd_os ?? rx.pd)}</td>
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
