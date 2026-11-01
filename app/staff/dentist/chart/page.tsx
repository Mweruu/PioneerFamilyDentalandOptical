import Link from "next/link";
import { ArrowLeft, Info, Stethoscope, Smile, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/staff/section";
import { ToothChartGrid, ToothLegend } from "@/components/staff/tooth-chart-grid";
import { requireRole } from "@/lib/auth";
import type { ToothFinding } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "FDI Tooth Chart Guide" };

const SAMPLE_CONDITIONS: { tooth: string; dentition: "permanent" | "primary"; condition: string }[] = [
  { tooth: "16", dentition: "permanent", condition: "Dental caries" },
  { tooth: "26", dentition: "permanent", condition: "Existing filling / restoration" },
  { tooth: "36", dentition: "permanent", condition: "Root canal treated" },
  { tooth: "46", dentition: "permanent", condition: "Crown" },
  { tooth: "18", dentition: "permanent", condition: "Extracted" },
  { tooth: "11", dentition: "permanent", condition: "Fracture" },
  { tooth: "75", dentition: "primary", condition: "Dental caries" },
  { tooth: "85", dentition: "primary", condition: "Healthy" },
];

function sampleFinding({ tooth, dentition, condition }: (typeof SAMPLE_CONDITIONS)[number], index: number): ToothFinding {
  const now = new Date().toISOString();
  return {
    id: `sample-${index}`,
    patient_id: "sample",
    dental_visit_id: "sample",
    tooth_number: tooth,
    dentition,
    condition,
    surfaces: null,
    diagnosis: null,
    planned_treatment: null,
    treatment_performed: null,
    treatment_date: null,
    notes: null,
    status: "Monitoring",
    created_at: now,
    updated_at: now,
  };
}

const FINDINGS = SAMPLE_CONDITIONS.map(sampleFinding);

const QUADRANTS = [
  { label: "Upper right", permanent: "1", primary: "5", example: "11–18 / 51–55" },
  { label: "Upper left", permanent: "2", primary: "6", example: "21–28 / 61–65" },
  { label: "Lower left", permanent: "3", primary: "7", example: "31–38 / 71–75" },
  { label: "Lower right", permanent: "4", primary: "8", example: "41–48 / 81–85" },
];

export default async function ToothChartGuidePage() {
  await requireRole("dentist");

  return (
    <div>
      <PageHeader
        eyebrow="Clinical reference"
        title="FDI tooth chart guide"
        description="How Pioneer Family Dental records tooth findings using the two-digit FDI World Dental Federation notation."
        actions={<Link href="/staff/dentist/patients" className="btn-secondary"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to dental patients</Link>}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Section title="How the two-digit system works" description="The first digit identifies the quadrant and dentition; the second identifies the tooth position from the midline.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-mist p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><Smile className="h-4 w-4 text-teal-600" aria-hidden /> Permanent dentition</p>
                <p className="mt-1 text-xs leading-5 text-navy-600">Quadrants 1–4. Teeth 11–18 (upper right), 21–28 (upper left), 31–38 (lower left) and 41–48 (lower right).</p>
              </div>
              <div className="rounded-xl border border-line bg-mist p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><Stethoscope className="h-4 w-4 text-sky-600" aria-hidden /> Primary dentition</p>
                <p className="mt-1 text-xs leading-5 text-navy-600">Quadrants 5–8. Teeth 51–55, 61–65, 71–75 and 81–85. Primary teeth are charted separately from permanent teeth.</p>
              </div>
            </div>

            <div className="table-wrap mt-4">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quadrant</th>
                    <th>Permanent</th>
                    <th>Primary</th>
                    <th>Tooth range</th>
                  </tr>
                </thead>
                <tbody>
                  {QUADRANTS.map((row) => (
                    <tr key={row.label}>
                      <td className="text-xs font-semibold text-navy-800">{row.label}</td>
                      <td className="font-mono text-xs">{row.permanent}</td>
                      <td className="font-mono text-xs">{row.primary}</td>
                      <td className="font-mono text-xs">{row.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-[11px] leading-5 text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              <p>
                Charts are drawn from the clinician&apos;s view: the patient&apos;s right side appears on the left of the chart.
                Record the tooth number exactly as charted, for example <strong>36</strong> for the lower-left first permanent molar.
              </p>
            </div>
          </Section>

          <Section title="Example chart" description="Colours show the latest recorded condition for each tooth.">
            <div className="space-y-4">
              <ToothChartGrid findings={FINDINGS} dentition="permanent" />
              <ToothChartGrid findings={FINDINGS} dentition="primary" />
              <ToothLegend />
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Recording a finding" description="Use the chart editor inside a dental consultation.">
            <ol className="space-y-3 text-xs leading-5 text-navy-600">
              <li><strong className="text-navy-800">1. Select the tooth</strong> on the permanent or primary chart.</li>
              <li><strong className="text-navy-800">2. Choose a condition</strong> such as caries, fracture, crown or missing tooth.</li>
              <li><strong className="text-navy-800">3. Add surfaces</strong> (mesial, distal, buccal, lingual, occlusal) where relevant.</li>
              <li><strong className="text-navy-800">4. Record the plan</strong> — diagnosis, planned treatment and status.</li>
              <li><strong className="text-navy-800">5. Save</strong> to add the finding to the visit and patient history.</li>
            </ol>
            <Link href="/staff/dentist/patients" className="btn-primary mt-4 w-full"><BookOpen className="h-4 w-4" aria-hidden /> Open a patient record</Link>
          </Section>

          <Section title="Condition colours">
            <ToothLegend />
            <p className="mt-3 text-[10px] leading-5 text-navy-400">
              The patient card always shows the most recent finding for each tooth. The full history remains available in the tooth findings table.
            </p>
          </Section>

          <Section title="Clinical reminders">
            <ul className="space-y-2 text-[11px] leading-5 text-navy-600">
              <li>Confirm the correct dentition before charting a paediatric patient.</li>
              <li>Do not overwrite an old finding — add a new finding so the history stays complete.</li>
              <li>Link treatment plans to the relevant teeth so follow-up reports stay accurate.</li>
              <li>Check allergies and medical history before prescribing or performing treatment.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
