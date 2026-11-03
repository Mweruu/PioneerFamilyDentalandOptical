import Link from "next/link";
import { CalendarCheck, Eye, ShieldCheck, Smile } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.02fr_.98fr]">
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(155deg,#071529_0%,#12315A_58%,#14635F_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-teal-300/15 blur-3xl" aria-hidden />

        <Logo light />

        <div className="relative max-w-md">
          <p className="section-kicker !text-teal-300">Staff workspace</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">
            One clinic. Two teams. A single, secure patient record.
          </h2>
          <p className="mt-4 text-sm leading-7 text-navy-200">
            Role-based access keeps dental, optical, reception and administration work separate while sharing the
            information each team is authorised to see.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              { icon: CalendarCheck, text: "Reception: registration, scheduling, check-in and vitals" },
              { icon: Smile, text: "Dentists: tooth charts, findings, treatment plans and notes" },
              { icon: Eye, text: "Eye doctors: examinations, refraction and prescriptions" },
              { icon: ShieldCheck, text: "Every record access is logged for accountability" },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3 text-navy-100">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <item.icon className="h-4 w-4 text-teal-200" aria-hidden />
                </span>
                <span className="pt-1.5">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] leading-5 text-navy-400">
          Pioneer Family Dental and Optical Clinic · Ngong Road, Nairobi
          <br />
          Access is monitored. Unauthorised use is prohibited.
        </p>
      </aside>

      <main id="main-content" className="flex flex-col bg-mist">
        <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4 lg:hidden">
          <Logo />
          <Link href="/" className="text-xs font-semibold text-navy-500 hover:text-navy-900">Public site</Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-400">Secure staff access</span>
              <Link href="/" className="text-xs font-semibold text-navy-500 hover:text-navy-900">Public site →</Link>
            </div>
            <div className="card p-6 sm:p-8">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-navy-950">{title}</h1>
              <p className="mt-1.5 text-sm leading-6 text-navy-500">{description}</p>
              <div className="mt-6">{children}</div>
            </div>
            {footer && <div className="mt-4 text-center text-[11px] leading-5 text-navy-400">{footer}</div>}
            <p className="mt-6 text-center text-[11px] leading-5 text-navy-400">
              Having trouble? Call the clinic administrator on{" "}
              <a href="tel:+254705188578" className="font-semibold text-navy-600">+254 705 188 578</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
