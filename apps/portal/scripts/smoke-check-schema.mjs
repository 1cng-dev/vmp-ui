#!/usr/bin/env node
// Post-deploy smoke check for the Supabase objects the Phase 1/2 VM
// ownership migrations create. Run this after applying migrations (and
// after any PostgREST schema-cache reload) to catch a missing/stale
// relation immediately, rather than finding out from a customer-facing
// "0 VMs" bug — exactly what shipped silently before this script existed.
//
// Usage:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/smoke-check-schema.mjs
//
// Uses the anon key only (same privilege level as the browser) — never a
// service-role key, so this is safe to run from anywhere, including CI.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error(
    "[smoke-check] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set " +
      "(source apps/portal/.env first, or export them directly)."
  );
  process.exit(1);
}

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
let failures = 0;

async function checkRelationExists(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=id&limit=0`, { headers });
  // A missing relation is PGRST205 (404). Anything else — including 200
  // with zero rows, which is what an anon caller correctly gets from a
  // customer-scoped view — means the relation exists and is reachable.
  const body = res.status === 404 ? await res.json().catch(() => ({})) : null;
  if (res.status === 404 && body?.code === "PGRST205") {
    console.error(`  ✗ ${name}: not found (PGRST205) — migration not applied, or PostgREST schema cache is stale`);
    failures++;
  } else {
    console.log(`  ✓ ${name}: reachable (${res.status})`);
  }
}

async function checkRpcExists(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => ({}));
  // PGRST202 = "could not find function" — genuinely missing. Any other
  // response (including a permission/argument error) means the function
  // exists; these RPCs are intentionally service_role-only, so an anon
  // caller getting rejected for permissions, not "not found", is correct
  // and expected.
  if (body?.code === "PGRST202") {
    console.error(`  ✗ ${name}(): not found (PGRST202) — migration not applied, or schema cache is stale`);
    failures++;
  } else {
    console.log(`  ✓ ${name}(): reachable (status ${res.status})`);
  }
}

console.log(`[smoke-check] Checking Supabase schema at ${SUPABASE_URL} ...`);
await checkRelationExists("vms_customer_safe");
await checkRpcExists("get_vm_password", {
  p_vm_id: "00000000-0000-0000-0000-000000000000",
  p_key: "smoke-check",
});
await checkRpcExists("jwt_role", {});

if (failures > 0) {
  console.error(`\n[smoke-check] FAILED — ${failures} check(s) did not find their object.`);
  process.exit(1);
}
console.log("\n[smoke-check] All checks passed.");
