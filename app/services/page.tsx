import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Eye, Smile } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { getServices } from "@/lib/data/queries";
import { formatKes } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our Services",
  description: "Dental and optical services at Pioneer Family Dental and Optical Clinic in Nairobi.",
};

export default function ServicesPage() {
  const services = getServices();
  const dental = services.filter((s) => s.department === "dental");
  const optical = services.filter((s) => s.department === "optical");

  return (
    <PublicShell>
      <section className="border-b border-line bg-[linear-gradient(180deg,#F4F9FE_0%,#FFFFFF_100%)]">
        <div className="container-page py-14 sm:py-16">
          <p className="section-kicker">Our services</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-navy-950 sm:text-5xl">
            One clinic for your family&apos;s dental and optical needs.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-navy-500">
            From routine check-ups to restorative dental care and complete eye examinations, our teams are here to help you stay well.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/book" className="btn-primary">
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Book an appointment
            </Link>
            <a href="tel:+254712345678" className="btn-secondary">
              Call +254 712 345 678
            </a>
          </div>
        </div>
      </section>

      <div className="container-page space-y-14 py-14">
        <section id="dental" className="scroll-mt-24">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600 text-white">
                <Smile className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Dental department</p>
                <h2 className="mt-1 text-2xl font-semibold text-navy-950">Healthy smiles, at every stage.</h2>
              </div>
            </div>
            <Link href="/book?department=dental" className="text-sm font-bold text-teal-700 hover:text-teal-900">
              Book a dental visit →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {dental.map((service) => (
              <article key={service.id} className="card flex flex-col p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div>
                  <h3 className="text-base font-semibold text-navy-900">{service.name}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-navy-500">{service.description}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" aria-hidden />
                    {service.duration_minutes} minute appointment
                  </p>
                </div>
                <div className="mt-4 shrink-0 text-left sm:mt-0 sm:text-right">
                  <p className="text-lg font-semibold text-navy-900">{formatKes(service.price)}</p>
                  <Link href={`/book?department=dental&service=${service.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900">
                    Book <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="optical" className="scroll-mt-24">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 text-white">
                <Eye className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">Optical department</p>
                <h2 className="mt-1 text-2xl font-semibold text-navy-950">Clear vision, comfortable living.</h2>
              </div>
            </div>
            <Link href="/book?department=optical" className="text-sm font-bold text-sky-700 hover:text-sky-900">
              Book an optical visit →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {optical.map((service) => (
              <article key={service.id} className="card flex flex-col p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div>
                  <h3 className="text-base font-semibold text-navy-900">{service.name}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-navy-500">{service.description}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" aria-hidden />
                    {service.duration_minutes} minute appointment
                  </p>
                </div>
                <div className="mt-4 shrink-0 text-left sm:mt-0 sm:text-right">
                  <p className="text-lg font-semibold text-navy-900">{formatKes(service.price)}</p>
                  <Link href={`/book?department=optical&service=${service.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900">
                    Book <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-navy-950 p-7 text-white sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-kicker !text-teal-300">Not sure which service you need?</p>
              <h2 className="mt-2 text-2xl font-semibold">Start with a consultation.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-navy-200">
                Our clinicians will assess your needs and recommend the right next step. You do not need a referral to book.
              </p>
            </div>
            <Link href="/book" className="btn-teal shrink-0">
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Book a consultation
            </Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
