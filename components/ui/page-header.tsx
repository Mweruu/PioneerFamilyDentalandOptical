import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-navy-400">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-navy-700">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-navy-600">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="section-kicker mb-1.5">{eyebrow}</p>}
        <h1 className="staff-page-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
