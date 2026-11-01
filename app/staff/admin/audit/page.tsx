import Link from "next/link";
import { Filter, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/staff/flash";
import { requireRole } from "@/lib/auth";
import { getAuditLogs } from "@/lib/data/queries";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Audit Log" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; role?: string; error?: string; success?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const logs = getAuditLogs(500);
  const actions = [...new Set(logs.map((log) => log.action))].sort();
  const roles = [...new Set(logs.map((log) => log.actor_role).filter(Boolean))].sort() as string[];
  const query = params.q?.trim().toLowerCase() ?? "";
  const filtered = logs.filter((log) => {
    if (params.action && log.action !== params.action) return false;
    if (params.role && log.actor_role !== params.role) return false;
    if (!query) return true;
    return [log.actor_name, log.action, log.entity_type, log.entity_id, log.details, log.patient_id]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Immutable record of authentication, patient record access and administrative changes. Review regularly for unusual activity."
        actions={<Link href="/staff/admin/reports" className="btn-secondary"><ShieldCheck className="h-4 w-4" aria-hidden /> Reports</Link>}
      />
      <Flash error={params.error} success={params.success} />

      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_220px_170px_auto] lg:items-end">
        <div>
          <label htmlFor="auditQuery" className="label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input id="auditQuery" name="q" defaultValue={params.q} className="input !pl-9" placeholder="Actor, detail, entity or patient ID" />
          </div>
        </div>
        <div>
          <label htmlFor="auditAction" className="label">Action</label>
          <select id="auditAction" name="action" className="select" defaultValue={params.action ?? ""}>
            <option value="">All actions</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="auditRole" className="label">Role</label>
          <select id="auditRole" name="role" className="select" defaultValue={params.role ?? ""}>
            <option value="">All roles</option>
            {roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary"><Filter className="h-4 w-4" aria-hidden /> Apply</button>
          <Link href="/staff/admin/audit" className="btn-secondary">Clear</Link>
        </div>
      </form>

      <p className="mb-3 text-xs text-navy-500">Showing <strong className="text-navy-800">{filtered.length}</strong> of the {logs.length} most recent entries.</p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>Patient</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap text-[11px] text-navy-500">{formatDateTime(log.created_at)}</td>
                <td>
                  <p className="text-xs font-semibold text-navy-900">{log.actor_name || "System"}</p>
                  <p className="text-[10px] text-navy-400">{log.actor_role?.replaceAll("_", " ") || "—"}</p>
                </td>
                <td><span className="badge bg-navy-50 font-mono text-[10px] text-navy-700 ring-navy-200">{log.action}</span></td>
                <td className="text-[11px] text-navy-500">
                  {log.entity_type || "—"}
                  {log.entity_id && <span className="mt-0.5 block truncate font-mono text-[10px] text-navy-400" title={log.entity_id}>{log.entity_id}</span>}
                </td>
                <td className="max-w-[360px] whitespace-normal text-[11px] leading-5 text-navy-600">{log.details || "—"}</td>
                <td className="text-[10px] font-mono text-navy-400">{log.patient_id ? log.patient_id.slice(0, 12) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="px-6 py-12 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-navy-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-navy-800">No audit entries match these filters</p>
            <p className="mt-1 text-xs text-navy-500">Try clearing the search or selecting a different action.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[10px] leading-5 text-navy-400">
        Audit entries are written by the server after each sensitive action. Clinical record views, role mismatches, staff changes and settings updates are recorded.
      </p>
    </div>
  );
}
