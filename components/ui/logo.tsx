import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ light = false, compact = false, href = "/" }: { light?: boolean; compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3 no-underline">
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm",
          light ? "bg-white text-navy-900" : "bg-navy-900 text-white",
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
          <path
            d="M7.2 3.7c1.1 0 1.7.5 2.8.5s1.7-.5 2.8-.5c2.6 0 4.2 2 4.2 5.1 0 3.6-1.7 8.2-3.1 10.1-.5.7-1.2.7-1.7 0l-1.6-2.5c-.5-.8-.9-.8-1.4 0l-1.6 2.5c-.5.7-1.2.7-1.7 0C5.5 17 4 12.4 4 8.8c0-3.1 1.6-5.1 3.2-5.1Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M8.6 9.1c.8-.5 1.7-.5 2.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14.2 9.1c.8-.5 1.7-.5 2.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className={cn("block text-[15px] font-bold tracking-[-0.01em]", light ? "text-white" : "text-navy-900")}>
            Pioneer Family
          </span>
          <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.15em]", light ? "text-sky-200" : "text-teal-600")}>
            Dental &amp; Optical
          </span>
        </span>
      )}
    </Link>
  );
}
