import Link from "next/link";
import { Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";

export const metadata = {
  title: "Privacy Notice",
  description:
    "How Pioneer Family Dental and Optical Clinic collects, uses, stores and protects personal and health information under the Kenya Data Protection Act, 2019.",
};

const sections = [
  {
    id: "who-we-are",
    title: "1. Who we are",
    body: [
      "Pioneer Family Dental and Optical Clinic is the data controller for the personal and health information described in this notice. Our clinic is located at Buruburu Phase 1 along Outering Road Junction (opposite the bus terminus), Nairobi, Kenya.",
      "You can reach our privacy contact at privacy@pioneerclinic.co.ke or by calling +254 705 188 578 during clinic hours.",
    ],
  },
  {
    id: "information",
    title: "2. Information we collect",
    body: [
      "Identity and contact details: your full name, phone number, email address, date of birth, gender and address.",
      "Appointment details: the department, service, clinician, date, time and reason for your visit.",
      "Health information: medical history, allergies, medications, conditions, vitals, dental findings, treatment plans, eye examination results and spectacle prescriptions. Health information is sensitive personal data under the Data Protection Act, 2019.",
      "Emergency contact details, where you choose to provide them.",
      "Technical and audit information: limited security logs recording who accessed a record and when. We use this to protect your information and investigate incidents.",
    ],
  },
  {
    id: "why",
    title: "3. Why we use your information",
    body: [
      "To register you as a patient and maintain one shared master record across our dental and optical departments.",
      "To schedule, confirm, remind you about and manage appointments.",
      "To provide safe clinical care, including diagnosis, treatment, follow-up and coordination between your dental and optical care teams.",
      "To send appointment confirmations, reminders and cancellation notices by WhatsApp, SMS or email where you have provided contact details.",
      "To meet our legal, regulatory and professional record-keeping obligations.",
      "To keep the clinic secure, prevent misuse and maintain audit logs.",
    ],
  },
  {
    id: "lawful-basis",
    title: "4. Lawful basis",
    body: [
      "We process your information under the Kenya Data Protection Act, 2019. Depending on the purpose, our lawful basis is the performance of a contract or steps taken at your request (managing your appointment), compliance with a legal obligation (health records and tax obligations), your consent (optional communications), and legitimate interests (clinic security and service improvement).",
      "Where we process health information, we do so for the provision of health care and the management of health services, subject to confidentiality and professional duties.",
    ],
  },
  {
    id: "sharing",
    title: "5. Who can see your information",
    body: [
      "Access is limited by role. Reception staff can see the information needed to register you, manage appointments and record vitals. Dentists can see dental clinical records; eye doctors can see optical clinical records. Both clinical teams can see the shared master record and relevant medical safety information, such as allergies.",
      "Administrators manage staff accounts, services, schedules and system settings. Administrative access to clinical content is restricted and audited.",
      "We may share information with laboratories, referral clinicians or other health providers involved in your care, with your knowledge or as permitted by law. We may also share information where required by a court order, regulator or applicable law.",
      "We do not sell your personal information. We do not use your health information for advertising.",
    ],
  },
  {
    id: "sms-email",
    title: "6. WhatsApp, SMS and email notifications",
    body: [
      "If you provide a phone number or email address, we may send appointment confirmations, reminders and cancellation notices by WhatsApp, SMS or email. Message delivery is handled by service providers acting on our instructions.",
      "You can ask us to stop non-essential messages at any time. We may still contact you about essential clinical or appointment matters.",
    ],
  },
  {
    id: "retention",
    title: "7. How long we keep information",
    body: [
      "We keep patient records for as long as required for clinical care and by applicable Kenyan health record-keeping requirements. Retention periods are reviewed and records are securely disposed of when no longer needed.",
      "Audit logs are retained for security and accountability purposes. Password reset tokens expire after 30 minutes and are marked as used once redeemed.",
    ],
  },
  {
    id: "security",
    title: "8. How we protect information",
    body: [
      "We use role-based access control, server-side authorisation checks, hashed passwords, HTTP-only session cookies, audit logging and encrypted connections in production. Staff accounts can be deactivated immediately.",
      "No system is completely secure. If we become aware of a personal data breach that poses a risk to you, we will assess it and notify the Office of the Data Protection Commissioner and affected individuals as required by law.",
    ],
  },
  {
    id: "rights",
    title: "9. Your rights",
    body: [
      "Under the Data Protection Act, 2019 you have the right to be informed about how your information is used, to access your personal data, to request correction of inaccurate information, to request deletion where applicable, to object to or restrict certain processing, and to data portability where applicable.",
      "You also have the right to withdraw consent where processing is based on consent, without affecting processing that already took place. To exercise a right, contact privacy@pioneerclinic.co.ke. We may need to verify your identity before acting on a request.",
      "If you are not satisfied with our response, you may complain to the Office of the Data Protection Commissioner in Kenya.",
    ],
  },
  {
    id: "children",
    title: "10. Children",
    body: [
      "We provide care to children. Where a patient is a child, we collect information from and share it with a parent or guardian, consistent with the child's best interests and applicable law.",
    ],
  },
  {
    id: "cookies",
    title: "11. Cookies and sessions",
    body: [
      "The public website does not require an account. Staff sign-in uses a single HTTP-only session cookie to keep you signed in securely. We do not use advertising cookies.",
    ],
  },
  {
    id: "changes",
    title: "12. Changes to this notice",
    body: [
      "We may update this notice from time to time. The current version is always available on this page. Material changes will be communicated through the clinic or by other appropriate means.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <section className="border-b border-line bg-[linear-gradient(180deg,#F4F9FE_0%,#FFFFFF_100%)]">
        <div className="container-page py-12 sm:py-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Your information, protected
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-navy-950 sm:text-5xl">Privacy notice</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-navy-500">
            This notice explains how Pioneer Family Dental and Optical Clinic handles personal and health information in
            line with the Kenya Data Protection Act, 2019.
          </p>
          <p className="mt-2 text-xs font-semibold text-navy-400">Last updated: 31 October 2026</p>
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[240px_1fr] lg:items-start">
        <nav aria-label="Privacy notice contents" className="card p-4 lg:sticky lg:top-24">
          <p className="px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400">On this page</p>
          <ul className="mt-2 space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block rounded-lg px-2 py-1.5 text-xs leading-5 text-navy-600 hover:bg-navy-50 hover:text-navy-900">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="prose-clinic max-w-3xl space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-navy-950">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
            <h2 className="text-lg font-semibold text-navy-950">Contact us about privacy</h2>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <p className="flex items-start gap-2.5 text-navy-700">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                <a href="mailto:privacy@pioneerclinic.co.ke" className="font-semibold underline">privacy@pioneerclinic.co.ke</a>
              </p>
              <p className="flex items-start gap-2.5 text-navy-700">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                <a href="tel:+254705188578" className="font-semibold underline">+254 705 188 578</a>
              </p>
            </div>
            <p className="mt-4 flex items-start gap-2.5 text-xs leading-5 text-navy-600">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />
              We may ask you to verify your identity before responding to an access, correction or deletion request.
            </p>
          </section>

          <div className="flex flex-wrap gap-3 border-t border-line pt-6">
            <Link href="/book" className="btn-primary">Book an appointment</Link>
            <Link href="/" className="btn-secondary">Return home</Link>
          </div>
        </article>
      </div>
    </PublicShell>
  );
}
