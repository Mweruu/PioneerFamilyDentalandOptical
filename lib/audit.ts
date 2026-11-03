import "server-only";
import { headers } from "next/headers";
import { createClient } from "./supabase/server";
import type { Role } from "./types";

type AuditInput = {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: Role | string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  patientId?: string | null;
  details?: string | null;
  /** Use the narrowly-scoped SECURITY DEFINER RPC for unauthenticated events. */
  publicEvent?: boolean;
};

async function requestIp() {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export async function logAudit(input: AuditInput) {
  const ip = await requestIp();
  const supabase = await createClient();

  if (input.publicEvent) {
    const { error } = await supabase.rpc("public_log_audit", {
      p_action: input.action,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_patient_id: input.patientId ?? null,
      p_details: input.details ?? null,
      p_ip: ip,
    });
    if (error) throw new Error(`Audit log failed: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    actor_role: input.actorRole ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    patient_id: input.patientId ?? null,
    details: input.details ?? null,
    ip,
  });

  if (error) throw new Error(`Audit log failed: ${error.message}`);
}
