import Link from "next/link";
import { CalendarCheck, Clock, Eye, Phone, ShieldCheck, Smile } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { BookingForm } from "@/components/public/booking-form";
import { getDoctors, getServices } from "@/lib/data/queries";
import { clinicToday } from "@/lib/utils";
import type { Department } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Book an Appointment",
  description: "Book a dental or optical appointment at Pioneer Family Dental and Optical Clinic. No account required.",
};

export default async function BookPage({ searchParams }: { searchParams: Promise<{ department?: string; service?: string }> }) {
  const params = await searchParams;
  const initialDepartment: Department = params.department === "optical" ? "optical" : "dental";
  const doctors = await getDoctors();
  const services = await getServices();

  return (
    <PublicShell>
      <section className="border-b border-line bg-[linear-gradient(180deg,#F4F9FE_0%,#FFFFFF_100%)]">
        <div className="container-page py-12 sm:py-14">
          <p className="section-kicker">Book online</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-navy-950 sm:text-5xl">A time that works for you.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-navy-500">
            Book a dental or optical appointment in a few steps. You will receive a reference number immediately and our team will confirm your visit.
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px] lg:items-start">
        <BookingForm
          doctors={doctors}
          services={services}
          initialDepartment={initialDepartment}
          initialServiceId={params.service}
          today={clinicToday()}
        />

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-900">What to expect</h2>
            <ul className="mt-4 space-y-4 text-xs leading-5 text-navy-600">
              <li className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                </span>
                <span><strong className="block text-sm font-semibold text-navy-900">Instant reference</strong>Your booking is saved as soon as you confirm.</span>
              </li>
              <li className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
                  <Clock className="h-4 w-4" aria-hidden />
                </span>
                <span><strong className="block text-sm font-semibold text-navy-900">Arrive 10 minutes early</strong>Bring an ID and any current medication or spectacles.</span>
              </li>
              <li className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <span><strong className="block text-sm font-semibold text-navy-900">Private and secure</strong>Only your care team can access your clinical information.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-navy-950 p-5 text-white">
            <h2 className="text-sm font-semibold">Need help booking?</h2>
            <p className="mt-2 text-xs leading-5 text-navy-300">Call the front desk and we will find a suitable time for you.</p>
            <a href="tel:+254705188578" className="btn-teal mt-4 w-full">
              <Phone className="h-4 w-4" aria-hidden />
              +254 705 188 578
            </a>
            <p className="mt-3 text-center text-[10px] text-navy-400">Mon–Fri 8am–8pm · Sat 8am–6pm</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
              <Smile className="h-4 w-4 text-teal-700" aria-hidden />
              <p className="mt-2 text-xs font-semibold text-teal-900">Dental care</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
              <Eye className="h-4 w-4 text-sky-700" aria-hidden />
              <p className="mt-2 text-xs font-semibold text-sky-900">Optical care</p>
            </div>
          </div>

          <p className="px-1 text-[11px] leading-5 text-navy-400">
            Already booked? <Link href="/appointment" className="font-semibold text-navy-700 underline">Find or cancel your appointment</Link>.
          </p>
        </aside>
      </div>
    </PublicShell>
  );
}
