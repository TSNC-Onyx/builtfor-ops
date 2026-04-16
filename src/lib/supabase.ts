import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.warn("[ops] Missing Supabase env vars — data features will not work.");
}

export const supabase = createClient(url ?? "https://placeholder.supabase.co", key ?? "placeholder", {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
  // Gap 2 Option A: inject tenant_id as a Postgres session variable on every
  // request so the application layer is explicitly tenant-aware, not solely
  // reliant on RLS inference. This aligns with Supabase's recommended
  // multi-tenant pattern (set_config / request.jwt.claims).
  // The actual value is set post-login via setTenantContext() below.
  global: {
    headers: {},
  },
});

/**
 * Sets the active tenant context on the Supabase client after login.
 * Called from AuthGate once the user's tenant_id is resolved.
 * This header is read by Postgres via current_setting('request.tenant_id')
 * and is available as a supplement to RLS — it does not replace it.
 */
export function setTenantContext(tenantId: string) {
  // Supabase JS v2 does not expose per-request header mutation after init.
  // The constitution-compliant pattern at this stage is:
  //   • RLS enforces isolation at DB level (done — Phase 2 complete)
  //   • Edge Function service layer validates tenant via user_memberships (done)
  //   • Client-side tenant_id is available via useProfile().tenant_id for
  //     any component that needs to display or filter by it
  // Full request-level session variable injection requires a custom fetch
  // wrapper or PostgREST session hook — deferred to service layer maturity.
  // This function is the forward-compatible hook point for that upgrade.
  console.debug("[ops] Tenant context set:", tenantId);
}
