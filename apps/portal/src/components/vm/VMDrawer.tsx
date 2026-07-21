import React, { useState } from 'react'
import useVMStore from '../../store/vmStore'
import useCustomerStore from '../../store/customerStore'
import Icon from '../../lib/icons'
import { StatusPill, ExpiryCell } from '../ui/ui'

interface VMDrawerProps {
  vmId: string
  onClose: () => void
  openCust: (id: string) => void
  openModal: (kind: string, props?: any) => void
}

const VMDrawer: React.FC<VMDrawerProps> = ({ vmId, onClose, openCust, openModal }) => {
  const { vms, updateVM, getVMRequest, getAddonRequestsForVM } = useVMStore()
  const { customers } = useCustomerStore()
  const v = vms.find((x: any) => x.id === vmId)
  if (!v) return null
  const c = customers.find((c: any) => c.id === v.customer_id)
  const [tab, setTab] = useState('overview')

  // Get data from store instead of fetching directly
  const vmRequest = v.vm_request_id ? getVMRequest(v.vm_request_id) : null
  const addonRequests = getAddonRequestsForVM(v.id)

  const creds = v.username && v.password ? [
    { type: 'SSH', user: v.username, pass: v.password }
  ] : []

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="flex center between mb-2">
            <div className="flex center gap-2 text-sm text-mute">
              <span className="mono">{v.legacy_id || v.id}</span>
              {c && <>
                <span>·</span>
                <a onClick={() => c?.id && openCust(c.id)} style={{ cursor: 'pointer', color: 'var(--accent-strong)' }}>{c?.org_name || c?.name}</a>
              </>}
            </div>
            <div className="flex gap-2">
              <button className="icon-btn" title="Open in Proxmox"><Icon name="external" size={14}/></button>
              <button className="icon-btn" onClick={onClose}><Icon name="x" size={14}/></button>
            </div>
          </div>
          <div className="flex center between">
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{v.hostname}</h2>
              <div className="flex gap-2 mt-2">
                <StatusPill status={v.status}/>
                <StatusPill status={v.task_type || 'new'}/>
                <span className="pill"><Icon name={v.power_state === 'Running' ? 'play' : 'pause'} size={10}/>{v.power_state}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {v.status === 'Active' ? (
                <>
                  <button className="btn" onClick={() => updateVM(v.id, { status: 'Suspended' as any })}><Icon name="pause" size={12}/>Suspend</button>
                  <button className="btn" onClick={() => openModal('terminate', { vm: v })}><Icon name="trash" size={12}/>Terminate</button>
                </>
              ) : (
                <button className="btn primary" onClick={() => updateVM(v.id, { status: 'Active' as any })}><Icon name="play" size={12}/>Activate</button>
              )}
              <button className="btn danger" onClick={() => openModal('delete', { vm: v })}><Icon name="x" size={12}/>Delete</button>
            </div>
          </div>
        </div>

        <div className="tabs">
          {['overview','specs','network','backups','credentials','addons'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'specs' ? 'Specs' : t === 'network' ? 'Network' : t === 'backups' ? 'Backups' : t === 'credentials' ? 'Credentials' : 'Add-ons'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {tab === 'overview' && (
            <div className="flex col gap-4">
              <div className="card">
                <div className="card-body">
                  <div className="grid-2" style={{ gap: 18 }}>
                    <div>
                      <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Specification</div>
                      <dl className="dl mt-3">
                        <dt>vCPU</dt><dd className="tnum">{v.vcpu} cores</dd>
                        <dt>RAM</dt><dd className="tnum">{v.ram_gb} GB</dd>
                        <dt>Storage</dt><dd className="tnum">{v.storage_gb} GB SSD</dd>
                        <dt>OS</dt><dd>{vmRequest?.os_name || vmRequest?.custom_os_name || 'Linux'}</dd>
                        <dt>OS Version</dt><dd>{vmRequest?.os_version || vmRequest?.custom_os_version || '—'}</dd>
                        <dt>Purpose</dt><dd>{vmRequest?.purpose || '—'}</dd>
                      </dl>
                    </div>
                    <div>
                      <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Subscription</div>
                      <dl className="dl mt-3">
                        <dt>VM ID</dt><dd className="mono">{v.legacy_id || v.id}</dd>
                        <dt>Assigned VM ID</dt><dd className="mono">{(v as any).assigned_vmid || vmRequest?.assigned_vmid || '—'}</dd>
                        <dt>Request ID</dt><dd className="mono">{vmRequest?.legacy_id || v.vm_request_id || '—'}</dd>
                        <dt>Request Type</dt><dd>{vmRequest?.request_type || 'paid'}</dd>
                        <dt>Task Type</dt><dd>{v.task_type || 'New'}</dd>
                        <dt>Quantity</dt><dd className="tnum">{vmRequest?.qty || 1}</dd>
                        <dt>Billing Term</dt><dd className="tnum">{vmRequest?.duration ? `${vmRequest.duration} days` : '—'}</dd>
                        <dt>Created</dt><dd className="tnum">{v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                        <dt>Expiry</dt><dd><ExpiryCell date={v.expiry || '—'}/></dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
              {vmRequest?.notes && (
                <div className="card">
                  <div className="card-head"><h3 className="card-title">Request notes</h3></div>
                  <div className="card-body"><p style={{ margin: 0 }}>{vmRequest.notes}</p></div>
                </div>
              )}
            </div>
          )}

          {tab === 'network' && (
            <div className="flex col gap-4">
              <div className="card"><div className="card-body">
                <dl className="dl">
                  <dt>Public IPv4</dt><dd className="mono fw-6">{v.public_ip || '—'}</dd>
                  <dt>Private IPv4</dt><dd className="mono">{v.private_ip || '—'}</dd>
                  <dt>Zone</dt><dd>{vmRequest?.zone || '—'}</dd>
                  <dt>NICs</dt><dd className="mono">{vmRequest?.nics && vmRequest.nics.length > 0 
                    ? vmRequest.nics.map((nic: any) => nic.vlan || nic.label).join(', ')
                    : '—'}</dd>
                  <dt>Public IP Required</dt><dd>{vmRequest?.public_ip_required ? 'Yes' : 'No'}</dd>
                  <dt>Firewall policy</dt><dd className="mono">Default</dd>
                </dl>
              </div></div>
              <div className="card">
                <div className="card-head"><h3 className="card-title">Allowed ports</h3></div>
                <div className="card-body flush">
                  <table className="tbl">
                    <thead><tr><th>Port</th><th>Protocol</th><th>Source</th></tr></thead>
                    <tbody>
                      {vmRequest?.firewall_ports?.map((port: any, idx: number) => (
                        <tr key={idx}>
                          <td className="mono fw-6">{port}</td>
                          <td className="mono">TCP</td>
                          <td className="text-sm">any</td>
                        </tr>
                      ))}
                      {(!vmRequest?.firewall_ports || vmRequest.firewall_ports.length === 0) && (
                        <tr><td colSpan={3}><div className="empty"><div className="sub">No specific firewall ports defined.</div></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'backups' && (
            <div className="card">
              <div className="card-body">
                <dl className="dl">
                  <dt>Backup Enabled</dt><dd>{vmRequest?.backup_enabled ? 'Yes' : 'No'}</dd>
                  <dt>Backup Type</dt><dd>{vmRequest?.backup_enabled ? vmRequest?.backup_type : '—'}</dd>
                </dl>
              </div>
            </div>
          )}

          {tab === 'credentials' && (
            <div className="card">
              <div className="card-body">
                <div style={{ padding: 12, background: 'var(--warn-soft)', borderRadius: 6, fontSize: 12, color: 'oklch(0.4 0.12 75)', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
                  <Icon name="lock" size={14}/>
                  <div>Credentials are encrypted at rest. Access requires proper authorization and is logged.</div>
                </div>
                <table className="tbl">
                  <thead><tr><th>Type</th><th>Username</th><th>Password</th><th></th></tr></thead>
                  <tbody>
                    {creds.map((c: any) => (
                      <tr key={c.type}>
                        <td>{c.type}</td>
                        <td className="mono">{c.user}</td>
                        <td className="mono">••••••••••••••••</td>
                        <td className="right">
                          <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(c.pass); alert('Password copied') }}><Icon name="check" size={11}/>Copy</button>
                        </td>
                      </tr>
                    ))}
                    {creds.length === 0 && (
                      <tr>
                        <td colSpan={4}><div className="empty"><div className="sub">No credentials available.</div></div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'addons' && (
            <div className="card">
              <div className="card-body">
                {addonRequests.length === 0 ? (
                  <div className="empty"><div className="sub">No completed add-on services for this VM.</div></div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>Request ID</th><th>Services</th><th>Package</th><th>Billing Term</th><th>Status</th><th>Completed Date</th></tr></thead>
                    <tbody>
                      {addonRequests.map((ar: any) => (
                        <tr key={ar.id}>
                          <td className="mono fw-6">{ar.legacy_id || ar.id}</td>
                          <td>
                            <div className="flex gap-1">
                              {ar.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                              {ar.ccis_enabled && <span className="pill subtle">CCIS</span>}
                            </div>
                          </td>
                          <td className="text-sm">
                            {[
                              ar.cpfs_enabled && ar.cpfs_package ? `CPFS ${ar.cpfs_package}` : null,
                              ar.ccis_enabled && ar.ccis_package ? `CCIS ${ar.ccis_package}` : null
                            ].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="text-sm">{ar.duration || 'N/A'}</td>
                          <td><StatusPill status={ar.status}/></td>
                          <td className="tnum text-sm">{ar.updated_at ? new Date(ar.updated_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === 'specs' && (
            <div className="card">
              <div className="card-body">
                <div className="grid-2" style={{ gap: 14 }}>
                  <div>
                    <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Instance</div>
                    <dl className="dl">
                      <dt>VM ID</dt><dd className="mono">{v.legacy_id || v.id}</dd>
                      <dt>Hostname</dt><dd>{v.hostname}</dd>
                      <dt>Power state</dt><dd>{v.power_state}</dd>
                      <dt>Status</dt><dd>{v.status}</dd>
                      <dt>Task Type</dt><dd>{v.task_type || 'New'}</dd>
                      <dt>Assigned VM ID</dt><dd>{(v as any).assigned_vmid || vmRequest?.assigned_vmid || '—'}</dd>
                      <dt>Created</dt><dd className="tnum">{v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                      <dt>Updated</dt><dd className="tnum">{v.updated_at ? new Date(v.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                    </dl>
                  </div>
                  <div>
                    <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Hardware</div>
                    <dl className="dl">
                      <dt>vCPU</dt><dd>{v.vcpu} cores</dd>
                      <dt>Memory</dt><dd>{v.ram_gb} GB</dd>
                      <dt>Storage</dt><dd>{v.storage_gb} GB SSD</dd>
                      <dt>OS</dt><dd>{vmRequest?.os_name || vmRequest?.custom_os_name || 'Linux'}</dd>
                      <dt>OS Version</dt><dd>{vmRequest?.os_version || vmRequest?.custom_os_version || '—'}</dd>
                      <dt>Specification Type</dt><dd>{vmRequest?.sizing || 'Standard'}</dd>
                      <dt>Storage Partitions</dt><dd>{vmRequest?.storage_partitions || '—'}</dd>
                    </dl>
                  </div>
                  <div>
                    <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Request Details</div>
                    <dl className="dl">
                      <dt>Request ID</dt><dd className="mono">{vmRequest?.legacy_id || v.vm_request_id || '—'}</dd>
                      <dt>Request Type</dt><dd>{vmRequest?.request_type || 'paid'}</dd>
                      <dt>Request Status</dt><dd>{vmRequest?.status || '—'}</dd>
                      <dt>Quantity</dt><dd className="tnum">{vmRequest?.qty || 1}</dd>
                      <dt>Billing Term</dt><dd className="tnum">{vmRequest?.duration ? `${vmRequest.duration} days` : '—'}</dd>
                      <dt>Request Created</dt><dd className="tnum">{vmRequest?.created_at ? new Date(vmRequest.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                      <dt>Request Updated</dt><dd className="tnum">{vmRequest?.updated_at ? new Date(vmRequest.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                    </dl>
                  </div>
                  <div>
                    <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Addons & Assignment</div>
                    <dl className="dl">
                      <dt>Backup Enabled</dt><dd>{vmRequest?.backup_enabled ? vmRequest.backup_type : 'No'}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VMDrawer
