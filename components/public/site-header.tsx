"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Menu, Phone, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Our Services" },
  { href: "/appointment", label: "Find Appointment" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/95 backdrop-blur">
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold text-navy-600 transition hover:bg-navy-50 hover:text-navy-900",
                pathname === link.href && "bg-navy-50 text-navy-900",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <a href="tel:+254712345678" className="btn-ghost text-xs">
            <Phone className="h-4 w-4" aria-hidden />
            +254 712 345 678
          </a>
          <Link href="/book" className="btn-primary">
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Book an appointment
          </Link>
          <Link href="/login" className="hidden text-xs font-semibold text-navy-500 hover:text-navy-800 xl:inline">
            Staff login
          </Link>
        </div>
        <button
          type="button"
          className="btn-secondary !min-h-10 !px-3 lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-white px-5 pb-5 pt-3 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-semibold text-navy-700 hover:bg-navy-50"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-navy-500 hover:bg-navy-50">
              Staff login
            </Link>
            <div className="mt-3 grid gap-2">
              <Link href="/book" onClick={() => setOpen(false)} className="btn-primary w-full">
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Book an appointment
              </Link>
              <a href="tel:+254712345678" className="btn-secondary w-full">
                <Phone className="h-4 w-4" aria-hidden />
                Call the clinic
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
