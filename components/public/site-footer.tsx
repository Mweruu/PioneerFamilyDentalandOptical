import Link from "next/link";
import { Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-navy-950 text-navy-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-6 text-navy-300">
            One family. Complete dental and eye care. Professional, compassionate care for every generation in Nairobi.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-teal-200 ring-1 ring-white/10">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Privacy-first patient care
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Visit us</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <span>Buruburu Phase 1<br />Along Outering Road Junction (opposite the bus terminus), Nairobi</span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <a href="tel:+254705188578" className="hover:text-white">+254 705188578</a>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <a href="mailto:hello@pioneerclinic.co.ke" className="hover:text-white">hello@pioneerclinic.co.ke</a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Opening hours</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <span>Monday – Friday<br /><strong className="font-semibold text-white">8:00 AM – 8:00 PM</strong></span>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <span>Saturday &amp; public holidays<br /><strong className="font-semibold text-white">8:00 AM – 6:00 PM</strong></span>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              <span>Sunday<br /><strong className="font-semibold text-white">Closed</strong></span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Quick links</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/book" className="hover:text-white">Book an appointment</Link></li>
            <li><Link href="/appointment" className="hover:text-white">Find or cancel an appointment</Link></li>
            <li><Link href="/services" className="hover:text-white">Dental &amp; optical services</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy &amp; patient rights</Link></li>
            <li><Link href="/login" className="hover:text-white">Staff login</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-5 text-[11px] text-navy-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Pioneer Family Dental and Optical Clinic. All rights reserved.</p>
          <p className="max-w-xl leading-5">
            Your health information is handled in line with Kenya&apos;s Data Protection Act, 2019. This site does not replace emergency care.
          </p>
        </div>
      </div>
    </footer>
  );
}
