# Proxmox integration — VM status monitoring

Scope: this integration covers **VM status and usage monitoring only** (power state,
CPU/RAM/disk/network usage). It does not cover VM creation, deletion, migration,
snapshots, or backups — those remain out of scope until explicitly requested.

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
| Customer "My VMs" list | `CustomerVMListView.tsx` | Supabase `vms` table (hostname, plan, billing) — unchanged by this integration |
| Customer VM detail → Usage | `CustomerVMDetail.tsx` | `proxmox-proxcy` (`useVMStatus`/`useVMStats`) |
| Admin "VM records" list | `VMList.tsx` | Supabase `vms` table — unchanged by this integration |
| Admin VM detail drawer → Usage | `VMDrawer.tsx` | `proxmox-proxcy` (`useVMStatus`/`useVMStats`) |

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
