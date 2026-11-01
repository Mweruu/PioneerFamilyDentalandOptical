import Link from "next/link";
import { Clock, Eye, Plus, Smile, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { Section } from "@/components/staff/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth";
import { getServices } from "@/lib/data/queries";
import { saveServiceAction } from "@/lib/actions/admin";
import { formatKes } from "@/lib/format";
import { DEPARTMENTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clinic Services" };

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const services = getServices(undefined, false);
  const dental = services.filter((service) => service.department === "dental");
  const optical = services.filter((service) => service.department === "optical");

  return (
    <div>
      <PageHeader
        eyebrow="Service catalogue"
        title="Services"
        description="Manage the services offered for online and staff booking. Inactive services stay on historical appointments but are hidden from new bookings."
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          {[
            { department: "dental" as const, items: dental, icon: Smile },
            { department: "optical" as const, items: optical, icon: Eye },
          ].map(({ department, items, icon: Icon }) => (
            <Section key={department} title={`${DEPARTMENTS[department]} services`} description={`${items.filter((item) => item.active).length} active of ${items.length}`}>
              <div className="space-y-2.5">
                {items.map((service) => (
                  <div key={service.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-navy-900">{service.name}</p>
                          <span className={service.active ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-slate-100 text-slate-600 ring-slate-200"}>
                            {service.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-navy-500">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /> {service.duration_minutes} min</span>
                          <span>{formatKes(service.price)}</span>
                        </p>
                        {service.description && <p className="mt-1 text-[11px] leading-5 text-navy-500">{service.description}</p>}
                      </div>
                      <Icon className="h-4 w-4 shrink-0 text-navy-300" aria-hidden />
                    </div>

                    <details className="mt-2.5 border-t border-line pt-2.5">
                      <summary className="cursor-pointer text-[11px] font-bold text-teal-700">Edit service</summary>
                      <form action={saveServiceAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="serviceId" value={service.id} />
                        <input type="hidden" name="returnTo" value="/staff/admin/services" />
                        <div>
                          <label htmlFor={`svcName-${service.id}`} className="label !text-[11px]">Name</label>
                          <input id={`svcName-${service.id}`} name="name" className="input !py-2 !text-sm" defaultValue={service.name} required />
                        </div>
                        <div>
                          <label htmlFor={`svcDept-${service.id}`} className="label !text-[11px]">Department</label>
                          <select id={`svcDept-${service.id}`} name="department" className="select !py-2 !text-sm" defaultValue={service.department}>
                            <option value="dental">Dental</option>
                            <option value="optical">Optical</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`svcDuration-${service.id}`} className="label !text-[11px]">Duration (minutes)</label>
                          <input id={`svcDuration-${service.id}`} name="durationMinutes" type="number" min={5} max={240} className="input !py-2 !text-sm" defaultValue={service.duration_minutes} required />
                        </div>
                        <div>
                          <label htmlFor={`svcPrice-${service.id}`} className="label !text-[11px]">Price (KES)</label>
                          <input id={`svcPrice-${service.id}`} name="price" type="number" min={0} step="1" className="input !py-2 !text-sm" defaultValue={service.price ?? ""} />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor={`svcDescription-${service.id}`} className="label !text-[11px]">Description</label>
                          <textarea id={`svcDescription-${service.id}`} name="description" className="textarea !min-h-16 !text-sm" defaultValue={service.description ?? ""} />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-navy-700">
                          <input type="checkbox" name="active" defaultChecked={service.active === 1} className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
                          Available for new bookings
                        </label>
                        <div className="flex justify-end">
                          <SubmitButton className="!min-h-9 !text-xs" pendingText="Saving…">Save service</SubmitButton>
                        </div>
                      </form>
                    </details>
                  </div>
                ))}
                {!items.length && <p className="text-xs text-navy-500">No {department} services yet.</p>}
              </div>
            </Section>
          ))}
        </div>

        <Section title="Add a service" description="New services appear in booking forms when active.">
          <form action={saveServiceAction} className="space-y-3">
            <input type="hidden" name="returnTo" value="/staff/admin/services" />
            <div>
              <label htmlFor="newServiceDepartment" className="label">Department *</label>
              <select id="newServiceDepartment" name="department" className="select" defaultValue="dental">
                <option value="dental">Dental</option>
                <option value="optical">Optical</option>
              </select>
            </div>
            <div>
              <label htmlFor="newServiceName" className="label">Service name *</label>
              <input id="newServiceName" name="name" className="input" required />
            </div>
            <div>
              <label htmlFor="newServiceDescription" className="label">Description</label>
              <textarea id="newServiceDescription" name="description" className="textarea !min-h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="newServiceDuration" className="label">Duration (min) *</label>
                <input id="newServiceDuration" name="durationMinutes" type="number" min={5} max={240} defaultValue={30} className="input" required />
              </div>
              <div>
                <label htmlFor="newServicePrice" className="label">Price (KES)</label>
                <input id="newServicePrice" name="price" type="number" min={0} step="1" className="input" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-navy-700">
              <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-400" />
              Available for new bookings
            </label>
            <SubmitButton className="w-full" pendingText="Adding…"><Plus className="h-4 w-4" aria-hidden /> Add service</SubmitButton>
          </form>

          <div className="mt-4 rounded-xl bg-mist p-3 text-[10px] leading-5 text-navy-500">
            <p className="flex items-center gap-1.5 font-semibold text-navy-700"><Stethoscope className="h-3 w-3 text-teal-600" aria-hidden /> Booking rules</p>
            <p className="mt-1">Service duration determines the appointment length. Existing appointments are not changed when a service is edited.</p>
            <Link href="/staff/admin/schedules" className="mt-2 inline-flex font-bold text-teal-700 hover:text-teal-900">Configure clinician schedules →</Link>
          </div>
        </Section>
      </div>
    </div>
  );
}
