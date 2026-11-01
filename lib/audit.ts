import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import type { Role } from "./types";
import { nowIso } from "./utils";

type AuditInput = {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: Role | string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  patientId?: string | null;
  details?: string | null;
};

export async function logAudit(input: AuditInput) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
  } catch {
    // headers() is unavailable in some background contexts.
  }

  db.prepare(`
    INSERT INTO audit_logs
      (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, patient_id, details, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    input.actorId ?? null,
    input.actorName ?? null,
    input.actorRole ?? null,
    input.action,
    input.entityType ?? null,
    input.entityId ?? null,
    input.patientId ?? null,
    input.details ?? null,
    ip,
    nowIso(),
  );
}
