# Proxmox integration — VM status, ownership & operations

This started as VM status/usage monitoring only. **Phase 1** (see
[Customer VM Ownership & Operations](#customer-vm-ownership--operations-phase-1) below)
added: hiding the real Proxmox vmid from customers end-to-end, encrypting VM login
passwords at rest, and the remaining power operations (reset/suspend/resume) alongside
the original start/stop/shutdown/reboot. **Phase 2** (see
[Phase 2 — Power Actions, Console, Go-Live](#phase-2--power-actions-console-go-live)
below) wired the customer portal's power-action buttons and console viewer to those
Phase 1 backend routes for real, and closed two gaps Phase 1's own write-up got wrong
once looked at closely. **Phase 3** (see
[Phase 3 — Multi-node & VM migration support](#phase-3--multi-node--vm-migration-support)
below) made both `proxmox-proxcy` and the portal's VM-binding forms treat the Proxmox
cluster's node topology as dynamic — nodes get added/removed, and a VM's node changes
whenever Proxmox migrates it — instead of assuming a fixed vmid→node mapping. Still out
of scope: actually creating/deleting/migrating a VM on Proxmox, snapshots, and backups —
"operations" here means controlling the power state of a VM that already exists and is
already bound to a customer via `vm_ownership`, not provisioning lifecycle.

## Architecture & data flow

```
┌─────────────┐        HTTPS + Supabase JWT        ┌────────────────┐        Proxmox API token       ┌──────────────┐
│  vmp-ui      │  ────────────────────────────────▶ │  proxmox-proxcy │ ─────────────────────────────▶ │  Proxmox VE   │
│  apps/portal │ ◀──────────────────────────────────│  (Express)      │ ◀───────────────────────────────│  server       │
└─────────────┘        VM status / usage JSON        └────────────────┘        VM status / usage JSON   └──────────────┘
       │                                                      │
       │ Supabase JWT (auth)                                   │ service-role key (auth, ownership, audit)
       ▼                                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (shared project)                                       │
│  - auth.users              → JWT issuer                          │
│  - public.vm_ownership     → which vmid/node a customer owns      │
│  - public.team_members     → who is staff/admin                  │
│  - public.vm_action_audit  → action audit log                    │
└─────────────────────────────────────────────────────────────────┘
```

**The portal never calls the Proxmox API directly.** It only ever talks to
`proxmox-proxcy` (via `VITE_API_URL`), which holds the Proxmox API token and is the
only thing with network access to the Proxmox VE server. This keeps the token, the
self-signed TLS cert, and Proxmox's raw error shapes off the client entirely.

Request path for "show me this VM's live usage":

1. Portal calls `GET {VITE_API_URL}/api/vms/:vmid` (or `/stats` for the usage
   history graphs) with `Authorization: Bearer <supabase-jwt>`.
2. `proxmox-proxcy`'s `authenticate` middleware verifies the JWT against Supabase
   and resolves `req.user`.
3. `authorizeVm` middleware resolves which VM the caller may see:
   - **Customer**: looks up `vm_ownership` for `(user_id, vmid)` — 403 if no match.
   - **Admin**: (read-only routes only — see [Authorization model](#authorization-model))
     looks up `vm_ownership` by `vmid` alone, or `/cluster/resources` as a fallback,
     regardless of who owns it.
4. `proxmox-proxcy` calls Proxmox (`status/current`, `config`, or `rrddata`) using its
   own service-side API token, and returns a normalized JSON response.

Where each portal view gets its data:

| View | File | Data source |
| --- | --- | --- |
| Customer "My VMs" list | `CustomerVMListView.tsx` | Supabase `vms_customer_safe` view (hostname, plan, billing — Phase 1) |
| Customer VM detail → Usage/Credentials | `CustomerVMDetail.tsx` | `proxmox-proxcy` `by-record` routes (`useVMStatusByRecord`/`useVMStatsByRecord`/`useVMCredentials`) |
| Admin "VM records" list | `VMList.tsx` | Supabase `vms` table (full) — unchanged by this integration |
| Admin VM detail drawer → Usage | `VMDrawer.tsx` | `proxmox-proxcy` vmid-keyed routes (`useVMStatus`/`useVMStats`) |

The Supabase `vms` table remains the source of truth for VM *metadata* (hostname,
customer, billing/expiry, IPs) — that's unrelated to Proxmox and out of scope here.
`proxmox-proxcy` is only used for *live* status/usage, layered on top in the detail
views. "Real time" is implemented as short-interval polling (`useVMStatus`: 5s,
`useVMStats`: 60s) — there's no push/WebSocket infrastructure in the portal today, so
this is the simplest correct implementation; a future iteration could move to Supabase
Realtime broadcast or SSE if tighter latency is ever needed.

## Proxmox API endpoints used, and why

All requests go through `proxmox-proxcy/src/proxmoxClient.js`, never straight from the
browser. Reference: [Proxmox VE API viewer](https://pve.proxmox.com/pve-docs/api-viewer/).

| Endpoint | Used for |
| --- | --- |
| `GET /nodes/{node}/qemu/{vmid}/status/current` | Live power state + instantaneous CPU/mem/disk/net counters — backs `GET /api/vms/:vmid` and the owned-VM list. |
| `GET /nodes/{node}/qemu/{vmid}/config` | Static VM config shown alongside status on the detail view. |
| `GET /nodes/{node}/qemu/{vmid}/rrddata` | Historical CPU/RAM/disk/net time series (`timeframe=hour\|day\|...`) — backs the usage sparklines/`avg`/`peak` in `GET /api/vms/:vmid/stats`. |
| `GET /cluster/resources?type=vm` | Cluster-wide VM list — backs the admin "all VMs" list (`GET /api/vms` as admin) and the node-resolution fallback for a vmid with no `vm_ownership` row yet. |

No write endpoints (`status/start`, `status/stop`, etc.) were touched by this change —
they already existed in `proxmox-proxcy` and remain ownership-only, unaffected by the
admin bypass described below.

## Environment variables

Names/structure only — never commit real values. See each repo's `.env.example`.

### `apps/portal/.env`

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (for portal auth + direct table access) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client-side, RLS-scoped) |
| `VITE_API_URL` | `proxmox-proxcy` origin, e.g. `http://10.0.111.22:3002`. The portal's only path to Proxmox status/usage data. |

### `proxmox-proxcy/.env`

| Variable | Purpose |
| --- | --- |
| `PROXMOX_URL` | Proxmox VE API base URL |
| `PROXMOX_TOKEN` | Proxmox API token (`PVEAPIToken=...`) — server-side only, never sent to any client |
| `PROXMOX_DEFAULT_NODE` | Default node used by the un-prefixed `/api/vms/*` routes |
| `PORT` | HTTP port this service listens on |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist — **must include the actual deployed portal origin(s)**; verify this after any domain change, the placeholder `https://your-vmp-domain.com` in `.env.example` is not a real value |
| `SUPABASE_URL` (or `SUPABASE_PUBLIC_URL`) | Supabase project URL. `supabaseClient.js` accepts either name — some deployments of this service's `.env` use the `SUPABASE_PUBLIC_URL` naming instead of `SUPABASE_URL`. |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) | Supabase service-role key — server-side only, bypasses RLS, used for the ownership/admin lookups and audit logging. Same fallback-naming note as above. |
| `VNC_TOKEN_TTL_SECONDS` | TTL for VNC console session tokens (console feature, not part of this integration) |

## Authorization model

Every route requires `Authorization: Bearer <supabase-access-token>` — missing/expired
JWT is `401`.

**Customer**: `authorizeVm` checks `public.vm_ownership` for a row matching
`(user_id, vmid)`. No match → `403 Forbidden`. This is enforced entirely server-side in
`proxmox-proxcy`; the portal has no way to bypass it, since it never talks to Proxmox
directly. `GET /api/vms` (list) similarly only ever returns the caller's own owned
vmids for a non-admin caller.

**Admin**: "admin" is determined by looking up `public.team_members`
(`role = 'Admin' AND status = 'Active'`) via the service-role client
(`src/utils/isAdmin.js`) — **not** from any Supabase Auth JWT claim. This matters: the
portal's own role-switcher UI reads `user_metadata.role`, which is client-writable via
`supabase.auth.updateUser()` and must never be trusted as a security boundary.
`team_members` is the table the portal's own RLS policies (`is_staff()`/`is_admin()`)
are built on, so this reuses the system's actual existing trust root rather than
inventing a new one. **Operationally**: a user only gets the admin bypass once they
have an `Active` row in `team_members` with `role = 'Admin'` — the same state that
already grants them the rest of the admin portal.

The admin bypass is intentionally **read-only**, applied only to:
- `GET /api/vms` (list — returns every VM on the cluster instead of just owned ones)
- `GET /api/vms/:vmid` (status + config)
- `GET /api/vms/:vmid/stats` (usage history)

Power actions (start/stop/shutdown/reboot), `DELETE` (terminate), console access, and
task-status all still require the caller to own the VM via `vm_ownership` — admin or
not. (`DELETE` additionally requires `app_metadata.role = 'admin'`, a separate,
pre-existing check unrelated to this integration and out of scope to change here.)

RLS on `vm_ownership`/`team_members` is a backstop, not the primary control —
`proxmox-proxcy` uses the Supabase **service-role** key, which bypasses RLS by design,
so the ownership/admin checks in `authorizeVm.js` / `isAdmin.js` are what actually
enforce tenant isolation.

## Known limitations / follow-ups

- **Disk usage may read 0.** Proxmox only reports `disk`/`maxdisk` usage for a QEMU VM
  if the guest has the QEMU guest agent installed and running; otherwise these fields
  are `0` from Proxmox itself, not a bug in this integration.
- **Polling, not push.** "Real time" means a 5s (status) / 60s (usage history) poll
  interval from the browser, not a server push. Fine for a monitoring dashboard; not
  suitable if sub-second latency is ever required.
- **Admin "all VMs" list is a backend capability, not yet a dedicated admin UI.** The
  admin "VM records" list page (`VMList.tsx`) still lists Supabase-tracked VMs (which
  already covers every provisioned/owned VM); `proxmox-proxcy`'s `GET /api/vms` as
  admin can return literally every VM on the Proxmox cluster (including ones with no
  `vm_ownership` row), which is there for a future full-fleet reconciliation view if
  that's ever needed — it isn't wired into that list page today.
- **`apps/api`** (a separate, disconnected Express/Postgres/Redis scaffold elsewhere in
  this monorepo that also talks to Proxmox) is unrelated to this integration and isn't
  used by the portal — do not confuse it with `proxmox-proxcy`.

## Customer VM Ownership & Operations (Phase 1)

Extends the existing `vm_ownership`/`vms` tables and `proxmox-proxcy` rather than
introducing a parallel schema — see the migrations dated `20260803*` in
`apps/portal/supabase/migrations/` and the `authorizeVmByRecord`/`by-record` routes /
`routes/admin.js` in `proxmox-proxcy`.

### (a) How the real Proxmox vmid is hidden from customers, end to end

- **In the browser**: the customer-facing portal never holds or sends the real Proxmox
  vmid. `vmStore.loadVMs()` queries `vms_customer_safe` (a view, not the base `vms`
  table) for any non-staff caller; that view excludes `assigned_vmid`/`node`/`pmx_type`
  entirely and instead exposes `ownership_record_id` — `vm_ownership.id`, an opaque
  UUID unrelated to the vmid. `CustomerVMDetail.tsx` uses that UUID for every
  proxmox-proxcy call (`useVMStatusByRecord`, `useVMStatsByRecord`, `useVMCredentials`,
  and the power-action calls in `proxmoxApi.ts`).
- **On the wire**: those calls hit `GET/POST /api/vms/by-record/:recordId/...` —
  literally a different URL shape from the admin-only `/api/vms/:vmid/...` routes, so
  the real vmid never appears in a customer-facing request URL, response body, or
  browser network tab.
- **Server-side**: `authorizeVmByRecord` (`proxmox-proxcy/src/middleware/authorizeVmByRecord.js`)
  resolves `(vmid, node)` from `vm_ownership.id = recordId` — the vmid only exists
  inside proxmox-proxcy's own process memory for the duration of that request, used to
  build the Proxmox API call, and is never echoed back in the JSON response.
- **Residual, explicitly-acknowledged gap**: this is enforced by *which query the
  application code runs*, not by a hard database-level column revoke — this schema
  doesn't separate "staff" and "customer" into different Postgres roles (both are the
  `authenticated` role; RLS distinguishes them via `is_staff()`), so a blanket
  `REVOKE SELECT (assigned_vmid, ...) FROM authenticated` would also break ~10 existing
  staff/service code paths that legitimately need those columns (invoicing, expiry
  jobs, quote review, admin/engineer VM creation). A customer who crafts their own
  PostgREST request directly against the base `vms` table (bypassing the app entirely)
  could still read `assigned_vmid`/`node` for their own row, since RLS legitimately
  grants them that row. See the comment block in migration
  `20260803093000_vm_password_encryption_and_customer_safe_view.sql` for the full
  reasoning. Closing that completely needs a staff/customer Postgres role split, which
  is a larger change than this pass — flagged as follow-up work, not attempted here.

### (b) How VM ownership is enforced at every layer

1. **Auth**: every proxmox-proxcy route requires a valid Supabase JWT (`authenticate`
   middleware). No JWT → `401`.
2. **Ownership (customer)**: `authorizeVmByRecord` requires
   `vm_ownership.id = recordId AND user_id = req.user.id` — no match → `404` (not
   `403`), so probing record IDs can't even confirm one exists, per the design brief.
   The `:vmid`-keyed routes (`authorizeVm`) use the equivalent ownership check by the
   real vmid, for admin/internal use.
3. **Ownership (admin)**: bypassed only on read-only routes (status/stats/list/
   credentials... — see the full list in `proxmox-proxcy/README.md`), gated by
   `isAdminUser()` against `team_members`, never a JWT claim.
4. **Database**: `proxmox-proxcy` uses the Supabase **service-role** key, which
   bypasses RLS — so RLS on `vm_ownership`/`vms`/`team_members` is a backstop for
   direct-from-browser access (the portal's own Supabase calls), not the primary
   control for proxmox-proxcy's own requests. The primary control there is the
   ownership row lookup in `authorizeVm`/`authorizeVmByRecord` itself.
5. **Rate limiting**: `vmActionLimiter` (20/min per `req.user.id`) on power actions and
   credential reveals specifically, on top of the existing global 100/min per-IP limit
   — bounds how fast even a legitimately-owned VM can be hammered.
6. **Audit**: every action (start/stop/shutdown/reboot/reset/suspend/resume/console/
   credentials-reveal/admin-bindings-write) is written to `vm_action_audit` with
   user/vmid/node/action/result. Credential actions never log the plaintext password.
7. **A critical prerequisite fixed in this pass, not originally in scope**: nearly
   every RLS policy in this schema (`vms`, `vm_ownership`, `team_members`, `customers`,
   invoices, tickets, ...) is built on `is_admin()`/`is_staff()`, which read
   `public.jwt_role()`. That function used to read the role straight off the Supabase
   JWT's `user_metadata` claim — client-writable via `supabase.auth.updateUser()`, so
   any authenticated customer could grant themselves `role: 'Admin'` and, on their next
   token refresh, pass every one of those RLS checks — a privilege-escalation hole
   affecting the whole app, discovered while auditing this exact authorization chain.
   Fixed in migration `20260803090000_fix_jwt_role_privilege_escalation.sql`:
   `jwt_role()` now resolves from `team_members` (write-protected — only an existing
   admin can insert/update it) instead of the JWT claim, with the same function name so
   every existing policy is fixed without being individually rewritten. Everything in
   this write-up that says "server-side ownership enforcement" depends on that fix
   being applied — without it, RLS itself was not a trustworthy layer.

### (c) VNC access scoping and time limits

Unchanged from the original status-monitoring integration, now also reachable via the
opaque record ID: `GET /api/vms/by-record/:recordId/console` calls Proxmox's
`vncproxy` endpoint server-side, then wraps the result in `vncSessions.createSession()`
— an in-memory session keyed by an **opaque token**, not the raw Proxmox ticket/port/
host. The client only ever receives `{ sessionToken, wsPath }`; the actual noVNC
websocket connects to *proxmox-proxcy itself* at `wsPath` (`src/wsConsoleProxy.js`),
which proxies to the real Proxmox `vncwebsocket` endpoint using the session it holds
server-side. Session lifetime is bounded by `VNC_TOKEN_TTL_SECONDS`. Ownership is
checked the same way as any other by-record route. **Not yet built**: an actual noVNC
viewer component in the portal — today's "Console" button still opens a placeholder
static page (`vnc-console.html`) rather than calling this endpoint; wiring the real
viewer is Phase 2 (needs a noVNC dependency, not currently in `package.json`).

### (d) Password encryption approach chosen, and why

**`pgcrypto`'s `pgp_sym_encrypt`/`pgp_sym_decrypt`**, via two Postgres functions
(`set_vm_password`, `get_vm_password` — migration `20260803094500_add_vm_password_rpc_functions.sql`),
called only by proxmox-proxcy's service-role client, with the symmetric key
(`VM_CREDENTIAL_KEY`) passed as a parameter on every call from proxmox-proxcy's own
`.env` — **never stored in the database**, not even via `ALTER DATABASE ... SET`.

Why this over the alternatives:
- **Supabase Vault** (hosted-only secrets management) isn't available — this is a
  self-hosted Supabase instance.
- **A trigger-based approach** (encrypt transparently on `INSERT`/`UPDATE` using a
  DB-side `current_setting()` key) was considered and rejected: it would require
  storing the key somewhere in the database configuration itself, which conflicts with
  "the key lives outside the DB."
- **KMS-managed application-layer encryption** (e.g. a cloud KMS) isn't available in
  this on-prem/self-hosted deployment; `pgcrypto` with an externally-held key is the
  practical equivalent given the infrastructure that actually exists here.

Consequence: the write path for a VM's password could no longer be a direct
client-side Supabase insert (the key must never reach the browser) — that's *why*
`POST /api/admin/vms/:vmId/bindings` exists as a new proxmox-proxcy endpoint, and why
`vmStore.addVM()` now splits VM creation into a non-sensitive client-side insert
followed by a call to that endpoint for `assigned_vmid`/`node`/`username`/`password`
specifically. Reading a password back is symmetric: only
`GET /api/vms/by-record/:recordId/credentials` can decrypt it, rate-limited and
audit-logged on every reveal, matching copy that already existed in the portal's UI
("Reveal logs an audit event") but wasn't previously backed by anything real.

**Not done in this pass**: backfilling existing plaintext `vms.password` rows into
`password_encrypted` — this sandbox has no network path to the live database. That's a
one-time script the operator needs to run once `VM_CREDENTIAL_KEY` is set, using
`set_vm_password` for each existing row, before relying on `password_encrypted` for
any VM created prior to this migration.

### Deferred to Phase 2/3

- Real noVNC console viewer UI (see (c) above).
- Wiring `reset`/`suspend`/`resume` (now supported by proxmox-proxcy) into the
  customer/admin VM action buttons, and a proper pending/in-progress task-polling UX
  around all power actions (the endpoints return a Proxmox `task`/`upid`; polling it
  via `GET .../task/:upid` to completion is not yet wired into the UI).
- An admin-only view/table for browsing, editing, and auditing
  `assigned_vmid ↔ customer_id` bindings directly (today this only exists as the
  "Add VM Details" creation flow — editing an existing binding has no UI yet). The
  backend (`vm_ownership`, `vm_action_audit`) already supports building this.

## Phase 2 — Power Actions, Console, Go-Live

### Two corrections found in the Phase 1 backend before building on it

Looked at closely rather than taken on faith, per instruction — both fixed before any
frontend was wired on top:

1. **`authorizeVmByRecord` admin bypass was too broad.** It was a single function (not
   a factory like `authorizeVm`), and unconditionally let any verified admin through
   on *every* by-record route — including power actions, console, and credentials, not
   just the read-only status/stats routes the Phase 1 write-up said it was scoped to.
   An ordinary customer was never affected (still fully ownership-checked), but a
   staff account could have started/stopped/reset/consoled into or revealed
   credentials for *any* customer's VM via the record-id path, inconsistent with the
   `:vmid` path's behavior for the same operations. Fixed: `authorizeVmByRecord` is
   now `authorizeVmByRecord({ allowAdminBypass })`, same shape as `authorizeVm`,
   bypass applied only to `GET /by-record/:recordId` and its `/stats` route.
2. **The console route couldn't actually work with a standard noVNC client as
   documented.** The stated design ("never the raw Proxmox ticket") didn't account for
   the RFB protocol's own auth step — the websocket-level ticket authorizes the
   *upgrade*, but the VNC/RFB handshake tunneled inside it needs the same ticket as
   its password, exactly like Proxmox's own web console. `GET .../console` now also
   returns `ticket` in its response, scoped to the one already-authorized,
   single-use, audit-logged session — host and port are still never sent to the
   client.

### What got wired

- **Power actions** — `CustomerVMDetail.tsx`'s buttons now call
  `useVMPowerAction` (`hooks/useVMLiveStatus.ts`), which posts to the `by-record`
  route, polls `.../task/:upid` to completion (2s interval, 90s UI timeout — the
  action itself isn't cancelled server-side if the UI stops waiting, only the button
  re-enables), then force-refetches live status via the existing polling hook's new
  `refetch()`. Button visibility is driven by the *live Proxmox status*
  (`useVMStatusByRecord`), never `vms.power_state` — that column is no longer
  authoritative for anything; `startVM`/`stopVM`/`restartVM` (the old functions that
  only ever flipped it) were removed from `vmStore.ts` outright (confirmed zero other
  callers before deleting). Reset and force-Stop prompt a native confirm (data-loss
  risk); the rest don't. Errors are mapped to generic, customer-safe copy by HTTP
  status (`friendlyActionError` in the hooks file) — the raw backend/Proxmox message
  is never shown.
- **Console** — new `components/vm/VNCConsole.tsx`, using `@novnc/novnc`'s `RFB`
  class (no TypeScript types are published for it; a minimal local declaration lives
  at `src/types/novnc.d.ts`, scoped to the surface actually used — the published
  `@types/novnc__novnc` targets an older, incompatible file layout of the package).
  Fetches a fresh session on every open, never persists the ticket beyond the
  component's local state, disconnects on unmount, and shows plain-language
  connecting/error/disconnected states (node/VM internals never surfaced).
- **`VM_CREDENTIAL_KEY` now fails loudly at boot** (`src/utils/assertEnv.js`, called
  at the top of `src/index.js`) if missing or under 32 characters — `process.exit(1)`
  with a clear message, instead of booting and only failing on the first credential
  reveal/write.
- **Backfill script** (`scripts/backfill-vm-passwords.js`) — dry-run by default,
  `--apply` to actually write. Not run in this session; see checklist below.

### Known integration risk not fully verifiable from here

The VNC ticket-as-RFB-password approach matches Proxmox's own documented client
behavior, but this session has no network path to a real Proxmox server to actually
connect a noVNC client through it end-to-end. This is the single highest-risk
unverified piece in this pass — smoke-test it first, before relying on any of the
rest (see checklist). A second, smaller uncertainty: the exact `status`/`qmpstatus`
string Proxmox reports for a *suspended* QEMU VM couldn't be confirmed without live
access — `CustomerVMDetail.tsx` currently treats `status === 'paused'` or
`qmpstatus === 'paused'` as suspended; confirm this against a real suspended VM and
adjust if Proxmox actually reports something else.

### Go-live checklist, in order

1. **Apply the Phase 1 migrations** to the live Supabase project, in this exact order
   (all three are idempotent — safe to re-run; verified last session by replaying the
   full migration history against a throwaway local Postgres):
   1. `apps/portal/supabase/migrations/20260803090000_fix_jwt_role_privilege_escalation.sql`
   2. `apps/portal/supabase/migrations/20260803093000_vm_password_encryption_and_customer_safe_view.sql`
   3. `apps/portal/supabase/migrations/20260803094500_add_vm_password_rpc_functions.sql`
   (No new migrations in Phase 2 — the admin-bypass fix was proxmox-proxcy code only.)
2. **Reload PostgREST's schema cache** immediately after applying migrations —
   `NOTIFY pgrst, 'reload schema';` against the database, or restart/reload PostgREST,
   depending on how this deployment runs it. New tables/views/functions are invisible
   to PostgREST until this happens, even though they exist in Postgres — this exact
   gap is what caused `vms_customer_safe` to 404 with `PGRST205` in production the
   first time this shipped (see the incident note below). Do not treat this as
   optional or "usually not needed."
3. **Run `npm run smoke:schema`** (`apps/portal/scripts/smoke-check-schema.mjs`) with
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set to the target project. It checks
   `vms_customer_safe`, `get_vm_password`, and `jwt_role` are all actually reachable
   through PostgREST (anon key only — safe to run from anywhere) and exits non-zero if
   any are missing or the cache is stale. **Do not proceed past this step if it
   fails** — this is what turns "someone remembers to reload the cache" into an
   actual, enforced gate instead of a hoped-for manual step.
4. **Set `VM_CREDENTIAL_KEY`** in proxmox-proxcy's `.env` — `openssl rand -base64 32`
   or equivalent, 32+ characters. Restart proxmox-proxcy; it now refuses to boot if
   this is missing or too short, so a bad deploy fails immediately and visibly rather
   than on the first customer credential action.
5. **Run the backfill dry-run**: `node scripts/backfill-vm-passwords.js` (no flags —
   dry-run is the default). Review the printed list of affected VM rows.
6. **Back up the `vms` table**, then **run the backfill for real**:
   `node scripts/backfill-vm-passwords.js --apply`.
7. **Deploy** proxmox-proxcy and the portal (the portal build now needs
   `@novnc/novnc` — a plain `npm install` picks it up; no other new external deps).
8. **Confirm `ALLOWED_ORIGINS`** in proxmox-proxcy's `.env` lists the real deployed
   portal origin(s) — unchanged requirement from Phase 1, worth re-checking here since
   this is the actual go-live.
9. **Smoke test against one real test VM**, in this order (riskiest/least-verifiable
   first):
   1. Console connect, as the owning customer — the RFB ticket handshake is the one
      piece that couldn't be verified from this session at all.
   2. Each power action (start/stop/shutdown/reboot/reset/suspend/resume) as the
      owning customer; confirm the button states/labels track real state afterward,
      including the suspended-detection caveat above.
   3. The same VM's `by-record` routes as a *different* customer account → expect
      `404` on all of them.
   4. An admin account: status/stats for a VM they don't own → succeeds (read bypass);
      power action/console/credentials for that same VM → `403`/`404` (bypass no
      longer applies there, per the fix above).
   5. Credentials reveal as the owning customer; confirm a `credentials_reveal` row
      lands in `vm_action_audit` with no plaintext password anywhere in it.

### Incident: `vms_customer_safe` 404 in production (PGRST205)

Shipped to a live environment before this checklist had step 2/3: `CustomerPortal` →
"My VMs" showed 0 VMs for a customer who owned one, with an unhandled `PGRST205` in
the console. **Root cause**: the migration creating `vms_customer_safe` (step 1 above)
was correct and present in the repo — this was not code referencing a relation that
was never written — but it had never been applied to that target Supabase project, so
the view genuinely didn't exist there yet. This is exactly what the previous session's
own go-live checklist called out as a required manual step ("apply the migrations")
that this environment hadn't done yet when the frontend was tested against it. Two
things fixed as a result, beyond just applying the migration:
- `vmStore.ts`'s `loadVMs()` no longer lets a failed request become an unhandled
  rejection that silently renders as "no VMs yet" — it now sets a `vmsError` state,
  and `CustomerVMListView`/`CustomerDashboard` show a "Couldn't load your VMs — Retry"
  state instead of the empty-state illustration when the load itself failed.
- The schema-cache-reload + `smoke:schema` steps above, so a missing/stale relation is
  caught by an explicit, scriptable gate immediately after migrating, not discovered
  later by a customer.

## Phase 3 — Multi-node & VM migration support

Both Phase 1 and Phase 2 assumed a VM's `vm_ownership.node` value was stable enough
to trust as-is for routing a Proxmox call. In reality a Proxmox cluster is dynamic on
two axes, independently of anything either repo does: which nodes exist (an operator
can add or remove a node at any time), and which node a given vmid currently runs on
(Proxmox — or its own HA manager — can live-migrate a VM to a different node at any
time, for any reason, including every VM on a node at once if that node goes down).
Nothing changed the *shape* of the customer/admin-facing contract here — every route,
response field, and UI flow from Phase 1/2 is unchanged. This phase closes a
correctness gap in how the two repos handle that dynamism, on both sides of the
integration.

### `proxmox-proxcy` side: self-healing node cache

`vm_ownership.node` is a cache — written once at bind time
(`POST /api/admin/vms/:vmId/bindings`) and refreshed cluster-wide every 2 minutes by
`syncVmStatus`. A VM that migrates in between those refreshes previously left every
per-VM route (status, power actions, console, stats, delete) targeting a node the vmid
no longer lived on, failing outright until the next sync tick corrected it. `proxmox-proxcy`
now retries once against the vmid's real current node (re-resolved live from
`/cluster/resources`) when it detects that specific "wrong node" failure, and self-heals
`vm_ownership.node` immediately on a successful retry — see
[proxmox-proxcy's README, "Multi-node & VM migration handling"](../../proxmox-proxy/README.md#multi-node--vm-migration-handling)
for the full mechanism, plus a manual testing guide (no automated test framework exists
in that project). Task-status routes (`.../task/:upid`) don't rely on the cache at
all — a Proxmox UPID encodes the node a task ran on directly in its own string, which
is exact and can't go stale.

This is entirely internal to `proxmox-proxcy` — no response shape changed, so no portal
code needed to change to benefit from it. Every `by-record` and `:vmid` route a portal
hook already calls (`useVMStatusByRecord`, `useVMPowerAction`, etc. in
`hooks/useVMLiveStatus.ts`) is more resilient to a migration happening mid-session with
zero changes on this side.

### Portal side: the node picker itself was the fixed-topology assumption

The backend fix above only helps once a VM is *correctly bound* to a real node in the
first place. Auditing the three portal forms that write `assigned_vmid`/`node` via
`createVMBindings` (`lib/proxmoxApi.ts`) turned up the actual "proxcy only seems to know
one node" symptom described when this phase was scoped — it wasn't in the backend at
all, it was in these forms:

- **`components/admin/AdminDirectVMModal.tsx` had no Proxmox Node field at all.**
  `assigned_vmid` was collected and sent, but `node` was never included in the `addVM()`
  call — meaning `vmStore.addVM()`'s own fallback (`node: vm.node || "pve1"`) silently
  bound *every* VM created through this modal to `"pve1"`, regardless of which node an
  engineer had actually provisioned it on. On anything but a single-node cluster (or a
  cluster where node 1 happens to always be named `pve1`), this bound VMs to the wrong
  node with no error at creation time — it would only surface later, as every
  status/power-action call for that VM failing. Fixed: the field now exists, and
  submission is blocked client-side if `assigned_vmid` is set without a `node`.
- **`components/engineer/EngineerVMCreateForm.tsx`** and **`pages/AdminDirectVMCreate.tsx`**
  (two occurrences) *did* have a node field, but as free text defaulting to the literal
  string `"pve1"` — functional, but with zero connection to what nodes actually exist on
  the live cluster right now, and no protection against a typo silently producing a
  binding to a node that doesn't exist.
- **`components/modals/AdminVMModals.tsx`'s `NewVMModal`** has a `node` field rendered as
  a `<select>` hardcoded to five fake options (`pve-node-01`..`pve-node-05`) — but this
  form never sets `assigned_vmid`, so `vmStore.addVM()`'s binding-write branch never
  runs for it; the field is inert (stored nowhere meaningful), not a live routing bug.
  Left alone in this pass — fixing dead UI has no user-facing effect, and touching it
  would be scope creep unconnected to any actual routing behavior.

**Fix**: `lib/proxmoxApi.ts` gained `listNodes()` (`GET /api/nodes` — already a live,
uncached, cluster-wide call server-side, see above), backing a new
`hooks/useProxmoxNodes.ts` and `components/vm/ProxmoxNodeInput.tsx` — a plain text input
(not a `<select>`) with a live `<datalist>` of real node names for autocomplete. It stays
free text deliberately: a hard dropdown would block an admin/engineer from binding a VM
at all if `proxmox-proxcy` is briefly unreachable when the form happens to be open, which
is exactly the wrong failure mode for a form staff may need during an incident. All three
real (non-inert) node inputs — `AdminDirectVMModal.tsx`, `EngineerVMCreateForm.tsx`, and
both occurrences in `AdminDirectVMCreate.tsx` — now use this component.

### Testing this

- **Backend**: see `proxmox-proxcy`'s README testing section linked above — pure-logic
  checks, a mocked failover run, and a live-cluster migration test, none of which need
  portal changes.
- **Portal — node picker**: open any of the three real VM-binding forms
  (Engineer "Provision VM" task flow, Admin "Direct VM Create" page, Admin "Create VM
  directly" modal) while `proxmox-proxcy` is reachable and confirm typing into the
  Proxmox Node field shows an autocomplete dropdown of real node names (`GET /api/nodes`
  in the browser network tab should return the live list, not a fixture). With
  `proxmox-proxcy` unreachable, confirm the field still accepts manual text entry (no
  hard block) and shows a "Loading nodes…" placeholder rather than an error state.
- **Portal — `AdminDirectVMModal` regression check**: create a VM through this modal with
  an `assigned_vmid` set and the Node field left empty — confirm submission is blocked
  client-side with "Please enter the Proxmox node this VM ID is on" rather than silently
  binding to `pve1`.