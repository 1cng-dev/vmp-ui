import React, { useEffect, useState } from 'react'
import useVMStore from '../../store/vmStore'
import useAddonServiceStore from '../../store/addonServiceStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, ExpiryCell } from '../ui/ui'
import { InfoCard, UsageCard, UsageDetailCard } from './VMHelperComponents'
import { CustUpgradeModal, CustConvertToPaidModal } from '../modals/CustomerVMModals'
import { useVMStatusByRecord, useVMStatsByRecord, useVMCredentials, useVMPowerAction } from '../../hooks/useVMLiveStatus'
import { BYTES_PER_GB, pctSeries, ramPctSeries, netMbpsSeries, avgOf, peakOf, lastOf } from '../../lib/vmUsage'
import type { PowerAction } from '../../lib/proxmoxApi'
import VNCConsole from '../vm/VNCConsole'

const ACTION_LABELS: Record<PowerAction, string> = {
  start: 'Starting…',
  stop: 'Force stopping…',
  shutdown: 'Stopping…',
  reboot: 'Restarting…',
  reset: 'Resetting…',
  suspend: 'Suspending…',
  resume: 'Resuming…',
}

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
  const { vms, getVMRequest } = useVMStore()
  const { getAddonServicesForVM } = useAddonServiceStore()
  const { toast } = useUIStore()
  const vm = vms.find((v: any) => v.id === initialVm.id) || initialVm
  const [tab, setTab] = useState('overview')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [convertToPaidOpen, setConvertToPaidOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)

  // Get data from store instead of fetching directly
  const vmRequest = vm.vm_request_id ? getVMRequest(vm.vm_request_id) : null
  const addonServices = getAddonServicesForVM(vm.id)

  // Live usage from proxmox-proxcy (never Proxmox directly). recordId is the
  // opaque vm_ownership.id from vms_customer_safe — the real Proxmox vmid
  // never reaches this browser. Undefined until the VM is actually
  // provisioned on Proxmox — hooks no-op then.
  const recordId: string | undefined = (vm as any).ownership_record_id || undefined
  const { status: liveStatus, error: statusError, refetch: refetchStatus } = useVMStatusByRecord(recordId)
  const { data: statsData, error: statsError } = useVMStatsByRecord(recordId, 'day')
  const liveError = statusError || statsError

  const { credentials, loading: credsLoading, error: credsError, reveal: revealCreds, hide: hideCreds } =
    useVMCredentials(recordId)

  // Power state now comes from Proxmox itself (via the status poll above),
  // never the vms.power_state column — that column can drift from reality
  // (it's only updated by admin actions elsewhere) and isn't ground truth.
  const proxmoxStatus = liveStatus?.status
  const statusKnown = !!proxmoxStatus
  const isRunning = proxmoxStatus === 'running'
  // Proxmox's exact status string for a suspended VM couldn't be verified
  // without live access to a real cluster — checking both status and
  // qmpstatus for 'paused' as the best available signal. Confirm this
  // against a real suspended VM during smoke testing (see go-live checklist).
  const isSuspended = proxmoxStatus === 'paused' || (liveStatus as any)?.qmpstatus === 'paused'
  const isStopped = statusKnown && !isRunning && !isSuspended
  const displayPowerState = !statusKnown ? vm.power_state : isRunning ? 'Running' : isSuspended ? 'Suspended' : 'Stopped'

  const { pending: actionPending, error: actionError, run: runPowerAction, clearError: clearActionError } =
    useVMPowerAction(recordId, refetchStatus)

  useEffect(() => {
    if (!moreMenuOpen) return
    const close = () => setMoreMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [moreMenuOpen])

  const handleAction = (action: PowerAction, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    runPowerAction(action)
  }

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
            <span className="pill"><Icon name={isRunning ? 'play' : 'pause'} size={10} />{displayPowerState}</span>
          </div>
        </div>
        <div className="page-actions">
          {vm.status !== 'Terminated' && (
            <>
              {!statusKnown && (
                <button className="btn" disabled><Icon name="refresh" size={12} />Loading status…</button>
              )}
              {isStopped && (
                <button className="btn primary" onClick={() => handleAction('start')} disabled={!!actionPending}>
                  <Icon name="play" size={12} />{actionPending === 'start' ? ACTION_LABELS.start : 'Start'}
                </button>
              )}
              {isRunning && (
                <>
                  <button className="btn" onClick={() => handleAction('shutdown')} disabled={!!actionPending}>
                    <Icon name="pause" size={12} />{actionPending === 'shutdown' ? ACTION_LABELS.shutdown : 'Stop'}
                  </button>
                  <button className="btn" onClick={() => handleAction('reboot')} disabled={!!actionPending}>
                    <Icon name="refresh" size={12} />{actionPending === 'reboot' ? ACTION_LABELS.reboot : 'Restart'}
                  </button>
                </>
              )}
              {isSuspended && (
                <button className="btn primary" onClick={() => handleAction('resume')} disabled={!!actionPending}>
                  <Icon name="sun" size={12} />{actionPending === 'resume' ? ACTION_LABELS.resume : 'Resume'}
                </button>
              )}
              {(isRunning || isSuspended) && (
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <button className="btn" onClick={() => setMoreMenuOpen(v => !v)} disabled={!!actionPending}>
                    <Icon name="more" size={12} />More
                  </button>
                  {moreMenuOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: 36, zIndex: 20,
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      borderRadius: 8, boxShadow: 'var(--shadow)',
                      minWidth: 200, padding: 4,
                    }}>
                      {isRunning && (
                        <button className="nav-item" onClick={() => { setMoreMenuOpen(false); handleAction('suspend') }}>
                          <Icon name="moon" size={13} />Suspend
                        </button>
                      )}
                      {isRunning && (
                        <button className="nav-item" onClick={() => { setMoreMenuOpen(false); handleAction('reset', 'Reset performs a hard restart, like pressing the physical reset button. Unsaved data may be lost. Continue?') }}>
                          <Icon name="alert" size={13} />Reset (hard restart)
                        </button>
                      )}
                      <button className="nav-item" style={{ color: 'var(--bad)' }} onClick={() => { setMoreMenuOpen(false); handleAction('stop', 'Force stop immediately powers off the VM without a graceful shutdown. Unsaved data may be lost. Continue?') }}>
                        <Icon name="x" size={13} />Force stop
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button className="btn" onClick={() => setConsoleOpen(true)} disabled={!isRunning} title={isRunning ? 'Open VNC console' : 'Start the VM to open console'}>
                <Icon name="terminal" size={12} />Console
              </button>
              {vmRequest?.request_type === 'trial' && <button className="btn primary" onClick={() => setConvertToPaidOpen(true)}><Icon name="credit-card" size={12} />Convert to Paid</button>}
              {vmRequest?.request_type !== 'trial' && <button className="btn" onClick={() => setUpgradeOpen(true)}><Icon name="arrow-up" size={12} />Change Plan</button>}
              <button className="btn accent" onClick={onRenew}><Icon name="refresh" size={12} />Renew</button>
            </>
          )}
        </div>

        {upgradeOpen && <CustUpgradeModal vm={vm} onClose={() => setUpgradeOpen(false)} me={me} />}
        {convertToPaidOpen && <CustConvertToPaidModal vm={vm} onClose={() => setConvertToPaidOpen(false)} />}
        {consoleOpen && recordId && (
          <VNCConsole recordId={recordId} vmName={vm.hostname} onClose={() => setConsoleOpen(false)} />
        )}
      </div>

      {actionError && (
        <div style={{ padding: 10, background: 'var(--warn-soft)', borderRadius: 8, fontSize: 12, color: 'oklch(0.4 0.12 75)', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span><Icon name="alert" size={13} /> {actionError}</span>
          <button className="btn sm ghost" onClick={clearActionError}><Icon name="x" size={11} /></button>
        </div>
      )}

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
            {credsError && (
              <div style={{ padding: 10, background: 'var(--warn-soft)', borderRadius: 8, fontSize: 12, color: 'oklch(0.4 0.12 75)', marginBottom: 12 }}>
                <Icon name="alert" size={13} /> {credsError}
              </div>
            )}
            <table className="tbl">
              <thead><tr><th>Type</th><th>Username</th><th>Password</th><th></th></tr></thead>
              <tbody>
                {!recordId ? (
                  <tr><td colSpan={4}><div className="empty"><div className="sub">Not provisioned on Proxmox yet.</div></div></td></tr>
                ) : !credentials ? (
                  <tr>
                    <td>SSH</td>
                    <td className="mono">••••••••</td>
                    <td className="mono">••••••••••••••••</td>
                    <td className="right"></td>
                  </tr>
                ) : (
                  <tr>
                    <td>SSH</td>
                    <td className="mono">{credentials.username || '—'}</td>
                    <td className="mono">{credentials.password || '—'}</td>
                    <td className="right">
                      {credentials.password && (
                        <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(credentials.password!); toast('Password copied', 'ok') }}><Icon name="check" size={11} />Copy</button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex gap-2 mt-3">
              {!credentials ? (
                <button className="btn" onClick={revealCreds} disabled={!recordId || credsLoading}>
                  <Icon name="eye" size={12} />{credsLoading ? 'Revealing…' : 'Reveal'}
                </button>
              ) : (
                <button className="btn" onClick={hideCreds}><Icon name="eye" size={12} />Hide</button>
              )}
              <button className="btn" onClick={() => toast('Password rotation requested — Sales will contact you', 'info')}><Icon name="refresh" size={12} />Request rotation</button>
            </div>
          </div>
        )}

        {tab === 'specs' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 14 }}>
              <InfoCard icon="server" title="Instance" mono rows={[
                ['VM ID', vm.legacy_id || vm.id],
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
