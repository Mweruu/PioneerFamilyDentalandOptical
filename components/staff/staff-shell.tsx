"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Eye,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Smile,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { Role, StaffUser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

const NAV: Record<Role, NavGroup[]> = {
  receptionist: [
    {
      items: [
        { href: "/staff/receptionist", label: "Front desk overview", icon: LayoutDashboard, exact: true },
        { href: "/staff/receptionist/appointments", label: "Appointments", icon: CalendarDays },
        { href: "/staff/receptionist/queue", label: "Today's queue", icon: ListOrdered },
        { href: "/staff/receptionist/patients", label: "Patients", icon: Users },
      ],
    },
    {
      label: "Quick actions",
      items: [
        { href: "/staff/receptionist/patients/new", label: "Register patient", icon: Users },
        { href: "/staff/receptionist/appointments/new", label: "Book appointment", icon: CalendarDays },
      ],
    },
  ],
  dentist: [
    {
      items: [
        { href: "/staff/dentist", label: "Dental dashboard", icon: LayoutDashboard, exact: true },
        { href: "/staff/dentist/appointments", label: "My appointments", icon: CalendarDays },
        { href: "/staff/dentist/patients", label: "Dental patients", icon: Smile },
        { href: "/staff/dentist/follow-ups", label: "Follow-ups due", icon: ClipboardList },
      ],
    },
    {
      label: "Clinical",
      items: [
        { href: "/staff/dentist/chart", label: "Tooth chart guide", icon: Stethoscope },
      ],
    },
  ],
  eye_doctor: [
    {
      items: [
        { href: "/staff/optometrist", label: "Optical dashboard", icon: LayoutDashboard, exact: true },
        { href: "/staff/optometrist/appointments", label: "My appointments", icon: CalendarDays },
        { href: "/staff/optometrist/patients", label: "Optical patients", icon: Eye },
        { href: "/staff/optometrist/follow-ups", label: "Follow-ups due", icon: ClipboardList },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/staff/admin", label: "Clinic overview", icon: LayoutDashboard, exact: true },
        { href: "/staff/admin/staff", label: "Staff accounts", icon: Users },
        { href: "/staff/admin/services", label: "Services", icon: ClipboardList },
        { href: "/staff/admin/schedules", label: "Clinician schedules", icon: CalendarDays },
      ],
    },
    {
      label: "Governance",
      items: [
        { href: "/staff/admin/reports", label: "Reports", icon: BarChart3 },
        { href: "/staff/admin/audit", label: "Audit log", icon: ShieldCheck },
        { href: "/staff/admin/notifications", label: "Notifications", icon: Bell },
        { href: "/staff/admin/settings", label: "Clinic settings", icon: Settings },
      ],
    },
  ],
};

const SEARCH_TARGET: Partial<Record<Role, string>> = {
  receptionist: "/staff/receptionist/patients",
  dentist: "/staff/dentist/patients",
  eye_doctor: "/staff/optometrist/patients",
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarContent({ user, onNavigate }: { user: StaffUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV[user.role];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <Logo light href="/staff" />
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-400">Signed in as</p>
        <p className="mt-1 truncate text-sm font-semibold text-white">{user.name}</p>
        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-teal-200 ring-1 ring-inset ring-teal-300/20">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          {ROLE_LABELS[user.role]}
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Staff navigation">
        {groups.map((group, index) => (
          <div key={group.label ?? `group-${index}`}>
            {group.label && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-400">{group.label}</p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
                        active
                          ? "bg-white text-navy-900 shadow-sm"
                          : "text-navy-200 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-teal-600" : "text-navy-300")} aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-semibold text-navy-300 hover:bg-white/10 hover:text-white">
          <Eye className="h-4 w-4" aria-hidden />
          View public website
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-navy-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function StaffShell({ user, children }: { user: StaffUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = NAV[user.role];
  const current = groups.flatMap((group) => group.items).find((item) => isActive(pathname, item));
  const searchTarget = SEARCH_TARGET[user.role];

  return (
    <div className="min-h-screen bg-mist">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-navy-950 lg:block">
        <SidebarContent user={user} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-navy-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-navy-300 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-navy-600 hover:bg-navy-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900">{current?.label ?? ROLE_LABELS[user.role]}</p>
              <p className="hidden text-[11px] text-navy-400 sm:block">Pioneer Family Dental and Optical Clinic</p>
            </div>

            {searchTarget && (
              <form action={searchTarget} className="relative hidden w-64 md:block xl:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
                <input
                  type="search"
                  name="q"
                  className="input !py-2 !pl-9 !text-xs"
                  placeholder="Search name, phone or number"
                  aria-label="Search patients"
                />
              </form>
            )}

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 sm:flex">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-900 text-[10px] font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="leading-tight">
                  <span className="block max-w-[130px] truncate text-[11px] font-bold text-navy-900">{user.name}</span>
                  <span className="block text-[10px] text-navy-400">{ROLE_LABELS[user.role]}</span>
                </span>
              </span>
              <form action={logoutAction} className="hidden sm:block">
                <button type="submit" className="btn-secondary !min-h-9 !px-3 !text-xs" title="Sign out">
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Sign out
                </button>
              </form>
              <Link href="/" className="btn-ghost !min-h-9 !px-2.5 !text-xs sm:hidden" aria-label="Public website">
                <Activity className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        <footer className="mx-auto max-w-6xl px-4 pb-8 text-[11px] leading-5 text-navy-400 sm:px-6 lg:px-8">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" aria-hidden />
            Access is role-based and logged. Handle patient information confidentially under the Kenya Data Protection Act, 2019.
          </p>
        </footer>
      </div>
    </div>
  );
}
