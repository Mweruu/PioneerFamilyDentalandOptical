import "server-only";
import "./ws";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Optional service-role client. It must never be imported into client code.
 * When the key is absent, privileged staff operations fall back to the
 * admin-only SECURITY DEFINER RPCs in supabase/migrations.
 */
export function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function hasServiceRoleKey() {
  return Boolean(supabaseUrl && serviceRoleKey);
}
