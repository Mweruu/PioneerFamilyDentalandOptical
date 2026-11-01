import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "navy" | "teal" | "sky" | "amber" | "emerald" | "rose";
}) {
  const tones = {
    navy: "bg-navy-50 text-navy-700",
    teal: "bg-teal-50 text-teal-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-navy-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-navy-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
        </div>
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}
