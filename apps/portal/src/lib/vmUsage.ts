import type { ProxmoxRRDPoint } from './proxmoxApi'

// Shared helpers for turning proxmox-proxcy's rrddata points into the
// percentage/Mbps series the usage widgets (UsageCard/UsageDetailCard) expect.
// Used by both the customer and admin VM detail views.

export const BYTES_PER_GB = 1024 ** 3

export const pctSeries = (
  points: ProxmoxRRDPoint[],
  pick: (p: ProxmoxRRDPoint) => number | null | undefined,
) => points.map(p => Math.round((pick(p) ?? 0) * 100))

export const ramPctSeries = (points: ProxmoxRRDPoint[]) =>
  points.map(p => (p.maxmem ? Math.round(((p.mem ?? 0) / p.maxmem) * 100) : 0))

// Proxmox rrddata reports netin/netout as bytes/sec averages, not cumulative counters.
export const netMbpsSeries = (points: ProxmoxRRDPoint[]) =>
  points.map(p => Math.round(((p.netout ?? 0) * 8) / 1_000_000))

export const avgOf = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
export const peakOf = (arr: number[]) => (arr.length ? Math.max(...arr) : 0)
export const lastOf = (arr: number[], fallback = 0) => (arr.length ? arr[arr.length - 1] : fallback)
