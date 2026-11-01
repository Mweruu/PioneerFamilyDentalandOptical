"use client";

import { useState } from "react";
import { AlertCircle, Save, Sparkles, Trash2 } from "lucide-react";
import { ToothChartGrid, ToothLegend } from "@/components/staff/tooth-chart-grid";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/staff/confirm-submit";
import {
  deleteToothFindingAction,
  quickToothUpdateAction,
  saveToothFindingAction,
} from "@/lib/actions/dental";
import type { ToothFinding } from "@/lib/types";
import { TOOTH_CONDITIONS, TOOTH_STATUSES, TOOTH_SURFACES } from "@/lib/types";
import { cn, safeJson } from "@/lib/utils";

export function DentalChartEditor({
  dentalVisitId,
  findings,
  returnTo,
}: {
  dentalVisitId: string;
  findings: ToothFinding[];
  returnTo: string;
}) {
  const [dentition, setDentition] = useState<"permanent" | "primary">("permanent");
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  const finding = selectedTooth
    ? findings.find((item) => item.tooth_number === selectedTooth && item.dentition === dentition)
    : undefined;
  const surfaces = safeJson<string[]>(finding?.surfaces ?? null, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-white p-1">
          {(["permanent", "primary"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDentition(value);
                setSelectedTooth(null);
              }}
              aria-pressed={dentition === value}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                dentition === value ? "bg-navy-900 text-white" : "text-navy-600 hover:bg-navy-50",
              )}
            >
              {value} teeth
            </button>
          ))}
        </div>
        <p className="text-[11px] text-navy-400">Select a tooth to record or update a finding.</p>
      </div>

      <ToothChartGrid
        findings={findings}
        dentition={dentition}
        selectedTooth={selectedTooth ?? undefined}
        onSelect={(tooth) => setSelectedTooth(tooth)}
      />
      <ToothLegend />

      {!selectedTooth ? (
        <div className="rounded-xl border border-dashed border-line bg-mist p-6 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-navy-300" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-navy-700">Choose a tooth on the chart</p>
          <p className="mt-1 text-xs text-navy-500">You can record caries, restorations, missing teeth and planned treatment.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-navy-900">Tooth {selectedTooth}</p>
              <p className="mt-0.5 text-[11px] text-navy-400">
                {finding ? `Current finding: ${finding.condition} · ${finding.status}` : "No finding recorded for this visit yet."}
              </p>
            </div>
            {finding && (
              <form action={deleteToothFindingAction}>
                <input type="hidden" name="findingId" value={finding.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmit
                  message={`Remove the finding for tooth ${selectedTooth}?`}
                  className="!min-h-8 !border-red-200 !px-2.5 !text-[11px] !text-red-700 hover:!bg-red-50"
                  pendingText="Removing…"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                </ConfirmSubmit>
              </form>
            )}
          </div>

          <form action={quickToothUpdateAction} className="mt-4 flex flex-col gap-2 rounded-lg bg-mist p-3 sm:flex-row sm:items-end">
            <input type="hidden" name="dentalVisitId" value={dentalVisitId} />
            <input type="hidden" name="toothNumber" value={selectedTooth} />
            <div className="flex-1">
              <label htmlFor="quickCondition" className="label !text-[11px]">Quick condition update</label>
              <select id="quickCondition" name="condition" className="select !py-2 !text-xs" defaultValue={finding?.condition ?? "Dental caries"}>
                {TOOTH_CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>{condition}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary !min-h-9 !px-3 !text-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Quick save
            </button>
          </form>

          <form key={`${dentition}-${selectedTooth}`} action={saveToothFindingAction} className="mt-4 space-y-4">
            <input type="hidden" name="dentalVisitId" value={dentalVisitId} />
            <input type="hidden" name="toothNumber" value={selectedTooth} />
            <input type="hidden" name="dentition" value={dentition} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="toothCondition" className="label">Condition *</label>
                <select id="toothCondition" name="condition" className="select" defaultValue={finding?.condition ?? "Dental caries"} required>
                  {TOOTH_CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>{condition}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="toothStatus" className="label">Status *</label>
                <select id="toothStatus" name="status" className="select" defaultValue={finding?.status ?? "Planned"} required>
                  {TOOTH_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <span className="label">Surfaces involved</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TOOTH_SURFACES.map((surface) => (
                    <label key={surface} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-navy-700">
                      <input
                        type="checkbox"
                        name="surfaces"
                        value={surface}
                        defaultChecked={surfaces.includes(surface)}
                        className="h-4 w-4 accent-teal-600"
                      />
                      {surface}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="toothDiagnosis" className="label">Tooth diagnosis</label>
                <input id="toothDiagnosis" name="diagnosis" className="input" defaultValue={finding?.diagnosis ?? ""} placeholder="e.g. Occlusal caries" />
              </div>
              <div>
                <label htmlFor="toothTreatmentDate" className="label">Treatment date</label>
                <input id="toothTreatmentDate" name="treatmentDate" type="date" className="input" defaultValue={finding?.treatment_date ?? ""} />
              </div>
              <div>
                <label htmlFor="toothPlanned" className="label">Planned treatment</label>
                <input id="toothPlanned" name="plannedTreatment" className="input" defaultValue={finding?.planned_treatment ?? ""} placeholder="e.g. Composite restoration" />
              </div>
              <div>
                <label htmlFor="toothPerformed" className="label">Treatment performed</label>
                <input id="toothPerformed" name="treatmentPerformed" className="input" defaultValue={finding?.treatment_performed ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="toothNotes" className="label">Tooth notes</label>
                <textarea id="toothNotes" name="notes" className="textarea !min-h-20" defaultValue={finding?.notes ?? ""} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton pendingText="Saving finding…">
                <Save className="h-4 w-4" aria-hidden /> Save tooth finding
              </SubmitButton>
              <p className="flex items-center gap-1.5 text-[11px] text-navy-400">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                Findings are saved to this visit and remain in the patient&apos;s dental history.
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
