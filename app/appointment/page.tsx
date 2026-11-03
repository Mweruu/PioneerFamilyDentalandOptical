import Link from "next/link";
import { CalendarCheck, Phone, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { AppointmentLookup } from "@/components/public/appointment-lookup";

export const metadata = {
  title: "Find or Cancel an Appointment",
  description:
    "Securely look up or cancel your Pioneer Family Dental and Optical Clinic appointment using your reference, full name and phone number.",
};

export default function AppointmentPage() {
  return (
    <PublicShell>
      <section className="border-b border-line bg-[linear-gradient(180deg,#F4F9FE_0%,#FFFFFF_100%)]">
        <div className="container-page py-12 sm:py-14">
          <p className="section-kicker">Appointment lookup</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-navy-950 sm:text-5xl">
            Find or cancel your appointment.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-navy-500">
            Enter the reference from your booking confirmation together with the name and phone number used at booking.
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px] lg:items-start">
        <AppointmentLookup />

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden />
              Why three details?
            </h2>
            <p className="mt-2 text-xs leading-5 text-navy-500">
              Appointment information is personal. Requiring the reference, full name and phone number together means a
              phone number alone cannot be used to discover someone&apos;s appointment.
            </p>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <CalendarCheck className="h-4 w-4 text-teal-600" aria-hidden />
              Cancellation policy
            </h2>
            <p className="mt-2 text-xs leading-5 text-navy-500">
              You can cancel online while an appointment is <strong className="text-navy-700">Booked</strong> or{" "}
              <strong className="text-navy-700">Confirmed</strong>. Once you have checked in, please speak to the front desk.
            </p>
          </div>

          <div className="rounded-2xl bg-navy-950 p-5 text-white">
            <h2 className="text-sm font-semibold">Need to reschedule?</h2>
            <p className="mt-2 text-xs leading-5 text-navy-300">
              Cancel online, then book a new time, or call us and the front desk will help.
            </p>
            <a href="tel:+254705188578" className="btn-teal mt-4 w-full">
              <Phone className="h-4 w-4" aria-hidden />
              +254 705 188 578
            </a>
            <Link href="/book" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Book a new appointment
            </Link>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
