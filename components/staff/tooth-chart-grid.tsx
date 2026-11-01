import { cn } from "@/lib/utils";
import { PERMANENT_TEETH, PRIMARY_TEETH, type ToothFinding } from "@/lib/types";

const CONDITION_STYLES: Record<string, string> = {
  Healthy: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  "Dental caries": "bg-amber-50 text-amber-800 ring-amber-300",
  Fracture: "bg-orange-50 text-orange-800 ring-orange-300",
  "Missing tooth": "bg-slate-100 text-slate-500 ring-slate-300",
  "Existing filling / restoration": "bg-sky-50 text-sky-800 ring-sky-300",
  Crown: "bg-indigo-50 text-indigo-800 ring-indigo-300",
  "Root canal treated": "bg-violet-50 text-violet-800 ring-violet-300",
  "Extraction required": "bg-rose-50 text-rose-800 ring-rose-300",
  Extracted: "bg-slate-100 text-slate-500 ring-slate-300",
  Other: "bg-navy-50 text-navy-800 ring-navy-300",
};

const QUADRANT_LABELS = {
  permanent: {
    upperRight: "Upper right",
    upperLeft: "Upper left",
    lowerLeft: "Lower left",
    lowerRight: "Lower right",
  },
  primary: {
    upperRight: "Upper right (primary)",
    upperLeft: "Upper left (primary)",
    lowerLeft: "Lower left (primary)",
    lowerRight: "Lower right (primary)",
  },
};

export function ToothChartGrid({
  findings,
  dentition = "permanent",
  selectedTooth,
  onSelect,
}: {
  findings: ToothFinding[];
  dentition?: "permanent" | "primary";
  selectedTooth?: string;
  onSelect?: (tooth: string) => void;
}) {
  const teeth = dentition === "permanent" ? PERMANENT_TEETH : PRIMARY_TEETH;
  const labels = QUADRANT_LABELS[dentition];
  const byTooth = new Map(
    findings.filter((finding) => finding.dentition === dentition).map((finding) => [finding.tooth_number, finding]),
  );

  function quadrant(name: keyof typeof teeth) {
    return (
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-navy-400">{labels[name]}</p>
        <div className={cn("grid gap-1", dentition === "permanent" ? "grid-cols-8" : "grid-cols-5")}>
          {teeth[name].map((tooth) => {
            const finding = byTooth.get(tooth);
            const condition = finding?.condition;
            const selected = selectedTooth === tooth;
            const classes = condition ? CONDITION_STYLES[condition] ?? CONDITION_STYLES.Other : "bg-white text-navy-500 ring-line";
            return (
              <button
                key={tooth}
                type="button"
                onClick={onSelect ? () => onSelect(tooth) : undefined}
                disabled={!onSelect}
                title={`Tooth ${tooth}${condition ? ` — ${condition}` : " — no finding"}`}
                aria-pressed={onSelect ? selected : undefined}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-md text-[11px] font-bold ring-1 ring-inset transition",
                  classes,
                  onSelect && "hover:-translate-y-0.5 hover:shadow-sm",
                  selected && "ring-2 ring-navy-900 ring-offset-1",
                  !onSelect && "cursor-default",
                )}
              >
                {tooth}
                {condition && (
                  <span
                    className={cn(
                      "absolute bottom-0.5 h-1 w-1 rounded-full",
                      condition === "Healthy" ? "bg-emerald-500" : "bg-current opacity-70",
                    )}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-navy-500">
          {dentition === "permanent" ? "Permanent dentition" : "Primary dentition"} · FDI notation
        </p>
        <p className="text-[10px] text-navy-400">Patient&apos;s right is on the left side of the chart</p>
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {quadrant("upperRight")}
          {quadrant("upperLeft")}
        </div>
        <div className="h-px bg-line" />
        <div className="grid gap-4 sm:grid-cols-2">
          {quadrant("lowerRight")}
          {quadrant("lowerLeft")}
        </div>
      </div>
    </div>
  );
}

export function ToothLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-navy-500">
      {Object.entries(CONDITION_STYLES).map(([condition, style]) => (
        <span key={condition} className="inline-flex items-center gap-1">
          <span className={cn("h-2.5 w-2.5 rounded-sm ring-1 ring-inset", style)} aria-hidden />
          {condition}
        </span>
      ))}
    </div>
  );
}
