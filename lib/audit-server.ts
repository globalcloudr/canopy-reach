import { createClient } from "@supabase/supabase-js";

export type AuditEventInput = {
  orgId: string;
  eventType: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

function getAuditEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

export async function logAuditEvent(input: AuditEventInput) {
  const env = getAuditEnv();
  if (!env || !input.orgId || !input.eventType) return;

  const adminSupabase = createClient(env.supabaseUrl, env.serviceRoleKey);
  const { error } = await adminSupabase.from("audit_events").insert({
    org_id: input.orgId,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Failed to write audit event", error);
  }
}
