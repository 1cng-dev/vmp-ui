import React, { useState } from 'react'
import useVMStore from '../../store/vmStore'
import useAddonServiceStore from '../../store/addonServiceStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, ExpiryCell } from '../ui/ui'
import { InfoCard, UsageCard, UsageDetailCard } from './VMHelperComponents'
import { CustUpgradeModal, CustConvertToPaidModal } from '../modals/CustomerVMModals'
import { useVMStatus, useVMStats } from '../../hooks/useVMLiveStatus'
import { BYTES_PER_GB, pctSeries, ramPctSeries, netMbpsSeries, avgOf, peakOf, lastOf } from '../../lib/vmUsage'

interface CustomerVMDetailProps {
  vm: any
  onClose: () => void
  onRenew: () => void
  me: any
}

// Helper function to format duration string
// If duration already has units (e.g., "14 days", "1 month"), return as-is
// If it's a number, convert to string with units
const formatDuration = (duration: string | number | undefined | null): string => {
  if (!duration) return 'N/A'

  // If it's already a string with units, return as-is
  if (typeof duration === 'string') {
    // Check if it already has units (day/days/month/months)
    if (duration.match(/^\d+\s+(day|days|month|months)$/)) {
      return duration
    }
    // Otherwise, parse and format it (for old format like "5 months 29 days")
    const monthsMatch = duration.match(/(\d+)\s*months?/i)
    const daysMatch = duration.match(/(\d+)\s*days?/i)

    const months = monthsMatch ? parseInt(monthsMatch[1]) : 0
    const days = daysMatch ? parseInt(daysMatch[1]) : 0

    if (months === 0 && days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`
    } else if (months > 0 && days === 0) {
      return `${months} month${months > 1 ? 's' : ''}`
    } else if (months > 0 && days > 0) {
      return `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`
    }
    return duration
  }

  // If it's a number, treat as months (backward compatibility)
  const numMonths = parseInt(String(duration))
  if (numMonths === 1) return '1 month'
  if (numMonths === 3) return '3 months'
  if (numMonths === 6) return '6 months'
  if (numMonths === 12) return '12 months'
  return `${numMonths} month${numMonths > 1 ? 's' : ''}`
}

export const CustomerVMDetail: React.FC<CustomerVMDetailProps> = ({ vm: initialVm, onClose, onRenew, me }) => {
  const { vms, startVM, stopVM, restartVM, getVMRequest } = useVMStore()
  const { getAddonServicesForVM } = useAddonServiceStore()
  const { toast } = useUIStore()
  const vm = vms.find((v: any) => v.id === initialVm.id) || initialVm
  const [tab, setTab] = useState('overview')
  const [revealCreds, setRevealCreds] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [convertToPaidOpen, setConvertToPaidOpen] = useState(false)

  // Get data from store instead of fetching directly
  const vmRequest = vm.vm_request_id ? getVMRequest(vm.vm_request_id) : null
  const addonServices = getAddonServicesForVM(vm.id)

  const isRunning = vm.power_state === 'Running'

  // Live usage from proxmox-proxcy (never Proxmox directly). assignedVmid is
  // undefined until the VM is actually provisioned on Proxmox — hooks no-op then.
  const assignedVmid: number | undefined = (vm as any).assigned_vmid
  const { status: liveStatus, error: statusError } = useVMStatus(assignedVmid)
  const { data: statsData, error: statsError } = useVMStats(assignedVmid, 'day')
  const liveError = statusError || statsError

  const cpu = pctSeries(statsData, p => p.cpu)
  const ram = ramPctSeries(statsData)
  const net = netMbpsSeries(statsData)

  const cpuNow = liveStatus?.cpu != null ? Math.round(liveStatus.cpu * 100) : lastOf(cpu)
  const ramMaxBytes = liveStatus?.maxmem || (vm.ram_gb ? vm.ram_gb * BYTES_PER_GB : 0)
  const ramUsedBytes = liveStatus?.mem ?? 0
  const ramNow = ramMaxBytes ? Math.round((ramUsedBytes / ramMaxBytes) * 100) : lastOf(ram)
  const ramUsedGB = ramMaxBytes ? Math.round((ramNow / 100) * (ramMaxBytes / BYTES_PER_GB)) : 0
  const netNow = lastOf(net)

  // Proxmox reports 0 for VM disk usage without a QEMU guest agent in the guest.
  const diskTotalGB = vm.storage_gb || Math.round((liveStatus?.maxdisk || 0) / BYTES_PER_GB)
  const diskGB = Math.round((liveStatus?.disk || 0) / BYTES_PER_GB)
  const diskPct = diskTotalGB ? Math.round((diskGB / diskTotalGB) * 100) : 0

  const creds = vm.username && vm.password ? [
    { type: 'SSH', user: vm.username, pass: vm.password }
  ] : []

  const openConsole = () => {
    const params = new URLSearchParams({
      name: vm.hostname, id: vm.id, ip: vm.public_ip || '203.81.64.10',
      os: 'linux', vcpu: String(vm.vcpu), ram: String(vm.ram_gb), storage: String(vm.storage_gb),
      running: vm.power_state === 'Running' ? '1' : '0',
    })
    window.open(`vnc-console.html?${params.toString()}`, '_blank', 'noopener,width=1180,height=760')
    toast(`Opening VNC console for ${vm.hostname}…`, 'info')
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12} />Back to VMs</button>
            <span className="mono text-xs text-mute">{vm.legacy_id || vm.id}</span>
          </div>
          <h1 className="page-title">{vm.hostname}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={vm.status} expiry={vm.expiry} />
            <StatusPill status={vm.task_type || 'new'} />
            <span className="pill"><Icon name={vm.power_state === 'Running' ? 'play' : 'pause'} size={10} />{vm.power_state}</span>
          </div>
        </div>
        <div className="page-actions">
          {vm.status !== 'Terminated' && (
            <>
              {isRunning
                ? <button className="btn" onClick={() => stopVM(vm.id)}><Icon name="pause" size={12} />Stop</button>
                : <button className="btn primary" onClick={() => startVM(vm.id)}><Icon name="play" size={12} />Start</button>
              }
              <button className="btn" onClick={() => restartVM(vm.id)} disabled={!isRunning}><Icon name="refresh" size={12} />Restart</button>
              <button className="btn" onClick={openConsole} disabled={!isRunning} title={isRunning ? 'Open VNC console in new tab' : 'Start the VM to open console'}><Icon name="terminal" size={12} />Console<Icon name="external" size={10} /></button>
              {vmRequest?.request_type === 'trial' && <button className="btn primary" onClick={() => setConvertToPaidOpen(true)}><Icon name="credit-card" size={12} />Convert to Paid</button>}
              {vmRequest?.request_type !== 'trial' && <button className="btn" onClick={() => setUpgradeOpen(true)}><Icon name="arrow-up" size={12} />Change Plan</button>}
              <button className="btn accent" onClick={onRenew}><Icon name="refresh" size={12} />Renew</button>
            </>
          )}
        </div>

        {upgradeOpen && <CustUpgradeModal vm={vm} onClose={() => setUpgradeOpen(false)} me={me} />}
        {convertToPaidOpen && <CustConvertToPaidModal vm={vm} onClose={() => setConvertToPaidOpen(false)} />}
      </div>

      {liveError && (
        <div style={{ padding: 10, background: 'var(--warn-soft)', borderRadius: 8, fontSize: 12, color: 'oklch(0.4 0.12 75)', marginBottom: 12 }}>
          <Icon name="alert" size={13} /> Live usage unavailable: {liveError}
        </div>
      )}
      <div className="grid-4 mb-4">
        <UsageCard label="CPU" value={`${cpuNow}%`} data={cpu} color="var(--accent)" />
        <UsageCard label="RAM" value={`${ramNow}%`} data={ram} color="var(--info)" sub={ramMaxBytes ? `${ramUsedGB} / ${Math.round(ramMaxBytes / BYTES_PER_GB)} GB` : undefined} />
        <UsageCard label="Storage" value={`${diskPct}%`} data={[diskPct, diskPct, diskPct, diskPct]} color="oklch(0.55 0.18 285)" sub={diskTotalGB ? `${diskGB} / ${diskTotalGB} GB` : undefined} />
        <UsageCard label="Network out" value={`${netNow} Mbps`} data={net} color="var(--ok)" />
      </div>

      <div className="card">
        <div className="tabs">
          {['overview', 'specs', 'network', 'backups', 'credentials', 'usage', 'addons'].map(t => {
            const label = t === 'addons' ? 'Add-on Services' : t.charAt(0).toUpperCase() + t.slice(1)
            return (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {label}
              </button>
            )
          })}
        </div>

        {tab === 'overview' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 14 }}>
              <InfoCard icon="cpu" title="Specification" rows={[
                ['vCPU', `${vm.vcpu} cores`],
                ['Memory', `${vm.ram_gb} GB`],
                ['Storage', `${vm.storage_gb} GB SSD`],
                ['OS', (vm as any).os_name || 'Linux'],
                ['Purpose', (vm as any).purpose || '—'],
              ]} />
              <InfoCard icon="invoice" title="Subscription" rows={[
                ['VM ID', vm.legacy_id || vm.id],
                ['Assigned VM ID', (vm as any).assigned_vmid || '—'],
                ['Proxmox Node', (vm as any).node || '—'],
                ['VM Type', (vm as any).pmx_type || '—'],
                ['Task Type', vm.task_type || 'New'],
                ['Billing Term', (vm as any).duration || '—'],
                ['Created', new Date(vm.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
                ['Expires', vm.expiry ? new Date(vm.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
              ]} />
            </div>
          </div>
        )}

        {tab === 'network' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Network details</div>
                <dl className="dl">
                  <dt>Public IPv4</dt><dd className="mono fw-6">{vm.public_ip || '—'}</dd>
                  <dt>Private IPv4</dt><dd className="mono">{vm.private_ip || '—'}</dd>
                  <dt>Zone</dt><dd className="mono">{vmRequest?.zone || (vm as any).zone || '—'}</dd>
                  <dt>NICs</dt><dd className="mono">{(() => {
                    try {
                      const src = vmRequest?.nics ?? (vm as any).nics
                      const arr = Array.isArray(src) ? src : (typeof src === 'string' ? JSON.parse(src) : [])
                      return arr && arr.length > 0
                        ? arr.map((nic: any) => nic?.description ? `${nic.label} (${nic.description})` : nic.label).join(', ')
                        : '—'
                    } catch {
                      return '—'
                    }
                  })()}</dd>
                </dl>
              </div>
              <div>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Firewall — Inbound</div>
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-body flush">
                    <table className="tbl">
                      <thead><tr><th>Port</th><th>Protocol</th><th>Source</th></tr></thead>
                      <tbody>
                        {(() => {
                          try {
                            const src = vmRequest?.firewall_ports ?? (vm as any).firewall_ports
                            const arr = Array.isArray(src) ? src : (typeof src === 'string' ? JSON.parse(src) : [])
                            if (!arr || arr.length === 0) {
                              return (
                                <>
                                  <tr><td className="mono fw-6">443</td><td className="mono">TCP</td><td className="text-sm">any (HTTPS)</td></tr>
                                  <tr><td className="mono fw-6">80</td><td className="mono">TCP</td><td className="text-sm">any (HTTP)</td></tr>
                                  <tr><td className="mono fw-6">22</td><td className="mono">TCP</td><td className="text-sm">trusted-admin</td></tr>
                                </>
                              )
                            }
                            return arr.map((port: any, idx: number) => (
                              <tr key={idx}>
                                <td className="mono fw-6">{port}</td>
                                <td className="mono">TCP</td>
                                <td className="text-sm">any</td>
                              </tr>
                            ))
                          } catch {
                            return (
                              <>
                                <tr><td className="mono fw-6">443</td><td className="mono">TCP</td><td className="text-sm">any (HTTPS)</td></tr>
                                <tr><td className="mono fw-6">80</td><td className="mono">TCP</td><td className="text-sm">any (HTTP)</td></tr>
                                <tr><td className="mono fw-6">22</td><td className="mono">TCP</td><td className="text-sm">trusted-admin</td></tr>
                              </>
                            )
                          }
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Firewall — Outbound</div>
                  <div className="card" style={{ borderColor: 'var(--line)' }}>
                    <div className="card-body flush">
                      <table className="tbl">
                        <thead><tr><th>Policy</th><th>Ports</th></tr></thead>
                        <tbody>
                          <tr>
                            <td className="fw-6">
                              {(vm as any).firewall_outbound_allow_all ? 'Allow All (Inbound Ports)' : 'Custom'}
                            </td>
                            <td className="mono">
                              {(vm as any).firewall_outbound_allow_all
                                ? (() => {
                                    try {
                                      const src = vmRequest?.firewall_ports ?? (vm as any).firewall_ports
                                      const arr = Array.isArray(src) ? src : (typeof src === 'string' ? JSON.parse(src) : [])
                                      return arr?.join(', ') || '—'
                                    } catch {
                                      return '—'
                                    }
                                  })()
                                : (vm as any).firewall_outbound_custom_ports?.join(', ') || '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'backups' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <InfoCard icon="shield" title="Backup Configuration" rows={[
                ['Backup Enabled', (vm as any).backup_enabled ? 'Yes' : 'No'],
                ['Backup Type', (vm as any).backup_enabled ? (vm as any).backup_type : '—'],
              ]} />
            </div>
          </div>
        )}

        {tab === 'credentials' && (
          <div className="card-body">
            <div style={{ padding: 12, background: 'var(--warn-soft)', borderRadius: 6, fontSize: 12, color: 'oklch(0.4 0.12 75)', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
              <Icon name="lock" size={14} />
              <div>Credentials are encrypted at rest. Reveal logs an audit event.</div>
            </div>
            <table className="tbl">
              <thead><tr><th>Type</th><th>Username</th><th>Password</th><th>Last accessed</th><th></th></tr></thead>
              <tbody>
                {creds.map((c: any) => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td className="mono">{c.user}</td>
                    <td className="mono">{revealCreds ? c.pass : '••••••••••••••••'}</td>
                    <td className="text-sm text-mute">2 days ago</td>
                    <td className="right">
                      <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(c.pass); toast('Password copied', 'ok') }}><Icon name="check" size={11} />Copy</button>
                    </td>
                  </tr>
                ))}
                {creds.length === 0 && (
                  <tr>
                    <td colSpan={5}><div className="empty"><div className="sub">No credentials available.</div></div></td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex gap-2 mt-3">
              <button className="btn" onClick={() => setRevealCreds(!revealCreds)}><Icon name="eye" size={12} />{revealCreds ? 'Hide' : 'Reveal'} all</button>
              <button className="btn" onClick={() => toast('Password rotation requested — Sales will contact you', 'info')}><Icon name="refresh" size={12} />Request rotation</button>
            </div>
          </div>
        )}

        {tab === 'specs' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 14 }}>
              <InfoCard icon="server" title="Instance" mono rows={[
                ['VM ID', vm.legacy_id || vm.id],
                ['Assigned VM ID', (vm as any).assigned_vmid || '—'],
                ['Proxmox Node', (vm as any).node || '—'],
                ['VM Type', (vm as any).pmx_type || '—'],
                ['Hostname', vm.hostname],
                ['Power state', vm.power_state],
                ['Request ID', vmRequest?.legacy_id || vm.vm_request_id],
                ['Request Type', vmRequest?.request_type || 'paid'],
                ['Status', vmRequest?.status || '—'],
                ['Duration', (vm as any).duration || '—'],
                ['Start Date', (vm as any).start_date ? new Date((vm as any).start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
                ['End Date', (vm as any).end_date ? new Date((vm as any).end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
                ['Expiry', vm.expiry ? new Date(vm.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
              ]} />
              <InfoCard icon="cpu" title="Hardware" rows={[
                ['vCPU', `${vm.vcpu} cores`],
                ['Memory', `${vm.ram_gb} GB`],
                ['Storage', `${vm.storage_gb} GB SSD`],
                ['OS', (vm as any).os_name || 'Linux'],
                ['OS Version', (vm as any).os_version || '—'],
                ['Specification Type', (vm as any).sizing || 'Standard'],
              ]} />
            </div>
            <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 8, marginTop: 14, color: 'var(--info)' }}>
              <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>Need a different spec? Use <strong>Upgrade</strong> or <strong>Change plan</strong> above — your account manager will confirm with a quote.</div>
            </div>
          </div>
        )}

        {tab === 'usage' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <UsageDetailCard label="CPU" data={cpu} color="var(--accent)" unit="%" avg={avgOf(cpu)} peak={peakOf(cpu)} />
              <UsageDetailCard label="RAM" data={ram} color="var(--info)" unit="%" avg={avgOf(ram)} peak={peakOf(ram)} />
              <UsageDetailCard label="Network out" data={net} color="var(--ok)" unit=" Mbps" avg={avgOf(net)} peak={peakOf(net)} />
              <div className="card" style={{ borderColor: 'var(--line)' }}>
                <div className="card-body">
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Storage</div>
                  <div className="flex center between mb-2">
                    <span className="tnum fw-7" style={{ fontSize: 24 }}>{diskGB} GB</span>
                    <span className="text-sm text-mute tnum">of {diskTotalGB} GB</span>
                  </div>
                  <div className="bar"><div className="fill" style={{ width: `${diskPct}%`, background: 'oklch(0.55 0.18 285)' }} /></div>
                  <div className="flex between text-xs mt-2"><span className="text-mute">Used</span><span className="text-mute tnum">{diskPct}%</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'addons' && (
          <div className="card-body">
            {addonServices.length === 0 ? (
              <div className="empty">
                <div className="title">No add-on services</div>
                <div className="sub">No active add-on services for this VM. Contact your account manager to add services.</div>
              </div>
            ) : (
              <div className="grid-2" style={{ gap: 14 }}>
                {addonServices.map((as: any) => (
                  <div key={as.id}>
                    <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>{as.legacy_id || as.id}</div>
                    <dl className="dl">
                      <dt>Services</dt>
                      <dd>
                        <div className="flex gap-1">
                          {as.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                          {as.ccis_enabled && <span className="pill subtle">CCIS</span>}
                        </div>
                      </dd>
                      <dt>Package</dt><dd>{[
                        as.cpfs_enabled && as.cpfs_package ? `CPFS ${as.cpfs_package}` : null,
                        as.ccis_enabled && as.ccis_package ? `CCIS ${as.ccis_package}` : null
                      ].filter(Boolean).join(', ') || '—'}</dd>
                      <dt>Duration</dt><dd>{formatDuration(as.duration)}</dd>
                      {as.start_date && <><dt>Start Date</dt><dd className="tnum">{new Date(as.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>}
                      {as.end_date && <><dt>End Date</dt><dd className="tnum">{new Date(as.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>}
                      {as.expiry && <><dt>Expiry</dt><dd><ExpiryCell date={as.expiry || ''} /></dd></>}
                      <dt>Status</dt><dd><StatusPill status={as.status}/></dd>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
