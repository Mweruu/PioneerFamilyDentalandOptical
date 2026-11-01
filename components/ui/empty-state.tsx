import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-mist px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-navy-400 shadow-sm ring-1 ring-line">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-navy-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs leading-5 text-navy-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
