import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  HeartPulse,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Smile,
  Star,
  Users,
} from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { getServices } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

const dentalHighlights = [
  { icon: Stethoscope, title: "Dental consultations", text: "Clear diagnosis and a plan you understand." },
  { icon: Sparkles, title: "Cleanings & fillings", text: "Preventive and restorative care for all ages." },
  { icon: HeartPulse, title: "Root canals & extractions", text: "Gentle treatment when a tooth needs more help." },
];

const opticalHighlights = [
  { icon: Eye, title: "Eye examinations", text: "Vision and eye-health checks under one roof." },
  { icon: CheckCircle2, title: "Refraction & prescriptions", text: "Accurate spectacle prescriptions for daily comfort." },
  { icon: Users, title: "Family eye care", text: "From children to grandparents, we see the whole family." },
];

export default async function HomePage() {
  const services = await getServices();
  const dental = services.filter((s) => s.department === "dental").slice(0, 4);
  const optical = services.filter((s) => s.department === "optical").slice(0, 4);

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#F5F9FE_0%,#FFFFFF_78%)]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-100/70 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-teal-100/60 blur-3xl" aria-hidden />
        <div className="container-page relative grid items-center gap-12 py-14 lg:grid-cols-[1.02fr_.98fr] lg:py-20">
          <div className="max-w-2xl animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Family dental &amp; eye care in Nairobi
            </div>
            <h1 className="mt-5 text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] text-navy-950 sm:text-[58px] lg:text-[64px]">
              Complete care for every <span className="text-teal-600">smile</span> and every <span className="text-sky-600">sight</span>.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-navy-600 sm:text-[17px]">
              Pioneer Family Dental and Optical Clinic brings trusted dental and eye care together in one calm, welcoming place — for you and the people you love.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/book" className="btn-primary !min-h-12 !px-6 !text-[15px]">
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Book an appointment
              </Link>
              <Link href="/services" className="btn-secondary !min-h-12 !px-6 !text-[15px]">
                Explore our services
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400">Same-week</dt>
                <dd className="mt-1 text-sm font-semibold text-navy-800">Appointments</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400">Two teams</dt>
                <dd className="mt-1 text-sm font-semibold text-navy-800">One patient record</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400">Mon–Sat</dt>
                <dd className="mt-1 text-sm font-semibold text-navy-800">Open six days</dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white bg-navy-100 shadow-lift">
              <Image
                src="/images/hero.jpg"
                alt="A calm, modern dental and optical clinic environment"
                fill
                priority
                sizes="(min-width: 1024px) 520px, 90vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/55 via-navy-950/5 to-transparent" aria-hidden />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-navy-950/65 p-4 text-white backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
                  </span>
                  Appointments available
                </div>
                <p className="mt-2 text-lg font-semibold">Care that fits family life.</p>
                <p className="mt-1 text-xs leading-5 text-navy-100">Book online in under two minutes. No account needed.</p>
              </div>
            </div>
            <div className="absolute -left-3 top-8 hidden rounded-2xl border border-line bg-white p-3.5 shadow-lift sm:block lg:-left-8">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-amber-600">
                  <Star className="h-4 w-4 fill-current" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy-900">Trusted by families</p>
                  <p className="text-[11px] text-navy-500">Compassionate, unhurried care</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-2 bottom-24 hidden rounded-2xl border border-line bg-white p-3.5 shadow-lift sm:block lg:-right-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy-400">One record</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-navy-900">
                <Smile className="h-4 w-4 text-teal-600" aria-hidden /> Dental
                <span className="text-navy-300">+</span>
                <Eye className="h-4 w-4 text-sky-600" aria-hidden /> Optical
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Privacy-first records", text: "Secure, role-based access" },
            { icon: Clock, title: "Easy scheduling", text: "Online booking & reminders" },
            { icon: Users, title: "Whole-family care", text: "Dental and optical together" },
            { icon: MapPin, title: "Convenient location", text: "Buruburu, Nairobi" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl px-2 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <item.icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-navy-500">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" id="services">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-kicker">Two departments, one standard of care</p>
          <h2 className="mt-3 text-3xl font-semibold text-navy-950 sm:text-4xl">Everything your family needs, close to home.</h2>
          <p className="mt-3 text-sm leading-7 text-navy-500 sm:text-base">
            Our dental and optical teams work together around one shared patient record, so your care stays joined up.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-3xl border border-teal-100 bg-[linear-gradient(145deg,#F0FAF7_0%,#FFFFFF_65%)] p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600 text-white shadow-sm">
                <Smile className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Dental care</p>
                <h3 className="text-xl font-semibold text-navy-950">Healthy smiles at every age</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {dentalHighlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-teal-100/80 bg-white/80 p-4">
                  <item.icon className="h-5 w-5 text-teal-600" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-navy-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-navy-500">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {dental.map((service) => (
                <span key={service.id} className="rounded-full border border-teal-100 bg-white px-3 py-1 text-[11px] font-semibold text-teal-800">
                  {service.name}
                </span>
              ))}
            </div>
            <Link href="/services#dental" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-900">
              See dental services <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-sky-100 bg-[linear-gradient(145deg,#F1F8FE_0%,#FFFFFF_65%)] p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 text-white shadow-sm">
                <Eye className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">Optical care</p>
                <h3 className="text-xl font-semibold text-navy-950">See clearly, live comfortably</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {opticalHighlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-sky-100/80 bg-white/80 p-4">
                  <item.icon className="h-5 w-5 text-sky-600" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-navy-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-navy-500">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {optical.map((service) => (
                <span key={service.id} className="rounded-full border border-sky-100 bg-white px-3 py-1 text-[11px] font-semibold text-sky-800">
                  {service.name}
                </span>
              ))}
            </div>
            <Link href="/services#optical" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 hover:text-sky-900">
              See optical services <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>
        </div>
      </section>

      <section className="bg-navy-950 py-16 text-white lg:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="section-kicker !text-teal-300">Why families choose Pioneer</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Care that feels personal, because it is.</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-navy-200 sm:text-base">
              We take the time to listen, explain your options and involve you in every decision. No rushed appointments. No confusing jargon.
            </p>
            <Link href="/book" className="btn-teal mt-7">
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Book your first visit
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: HeartPulse, title: "Unhurried appointments", text: "Time to ask questions and understand your care." },
              { icon: ShieldCheck, title: "Private by design", text: "Your records are protected and shared only with your care team." },
              { icon: Users, title: "One family record", text: "Dental and optical teams see the right information, together." },
              { icon: Star, title: "A calm experience", text: "Gentle care and clear communication from arrival to follow-up." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <item.icon className="h-5 w-5 text-teal-300" aria-hidden />
                <p className="mt-4 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1.5 text-xs leading-5 text-navy-300">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" id="contact">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl border border-line bg-mist p-6 sm:p-8">
            <p className="section-kicker">Visit the clinic</p>
            <h2 className="mt-3 text-2xl font-semibold text-navy-950 sm:text-3xl">Easy to reach. Easy to plan around.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-navy-500">
              We are on Ngong Road with accessible parking and a comfortable waiting area. Walk-ins are welcome, but booked appointments are seen first.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-4">
                <MapPin className="h-5 w-5 text-teal-600" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-navy-900">Buruburu Phase 1 along Outering Road Junction (opposite the bus terminus)</p>
                <p className="mt-1 text-xs leading-5 text-navy-500"> Nairobi, Kenya</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <Phone className="h-5 w-5 text-teal-600" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-navy-900">+254 705 188 578</p>
                <p className="mt-1 text-xs leading-5 text-navy-500">Call or WhatsApp during clinic hours</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <Clock className="h-5 w-5 text-teal-600" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-navy-900">Mon–Fri, 8am–8pm</p>
                <p className="mt-1 text-xs leading-5 text-navy-500">Saturday 8am–6pm · Sunday closed</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <CalendarCheck className="h-5 w-5 text-teal-600" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-navy-900">Book online</p>
                <p className="mt-1 text-xs leading-5 text-navy-500">No account needed. Instant reference number.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl bg-[linear-gradient(150deg,#0B1F3A_0%,#12315A_70%,#14635F_100%)] p-6 text-white shadow-lift sm:p-8">
            <div>
              <p className="section-kicker !text-teal-300">New or returning patient?</p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Your first step is simple.</h2>
              <p className="mt-3 text-sm leading-6 text-navy-200">
                Tell us whether you need dental or optical care, choose a time, and we will take care of the rest.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Pick a dental or optical visit", "Choose an available doctor and time", "Get your booking reference instantly"].map((item, index) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-teal-200 ring-1 ring-white/15">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-navy-100">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/book" className="btn-teal mt-8 w-full">
              Book an appointment
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
