import React, { useState } from 'react'
import useVMStore from '../../store/vmStore'
import useCustomerStore from '../../store/customerStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, ExpiryCell } from '../ui/ui'

interface VMDrawerProps {
  vmId: string
  onClose: () => void
  openCust: (id: string) => void
  openModal: (kind: string, props?: any) => void
  userRole?: string
}

const VMDrawer: React.FC<VMDrawerProps> = ({ vmId, onClose, openCust, openModal, userRole }) => {
  const { vms, updateVM, getVMRequest, getAddonRequestsForVM } = useVMStore()
  const { customers } = useCustomerStore()
  const { updateAddonRequest, addonRequests: allAddonRequests } = useAddonRequestStore()
  const { toast } = useUIStore()
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

  const handleActivate = async () => {
    // Find all add-on requests for this VM
    const vmAddonRequests = allAddonRequests.filter(a => a.vm_id === v.id && a.status === 'Completed')
    
    // Activate all associated add-on services
    for (const addon of vmAddonRequests) {
      await updateAddonRequest(addon.id, { operational_status: 'Active' })
    }
    
    // Activate the VM and set power state to Running
    updateVM(v.id, { status: 'Active' as any, power_state: 'Running' as any })
    
    const addonCount = vmAddonRequests.length
    const message = addonCount > 0 
      ? `VM ${v.hostname} activated along with ${addonCount} associated add-on service(s)`
      : `VM ${v.hostname} activated`
    
    toast(message, 'ok')
  }

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
                <StatusPill status={v.status} expiry={v.expiry}/>
                <StatusPill status={v.task_type || 'new'}/>
                <span className="pill"><Icon name={v.power_state === 'Running' ? 'play' : 'pause'} size={10}/>{v.power_state}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {v.status === 'Active' && userRole !== 'Sales' && userRole !== 'Finance' ? (
                <button className="btn" onClick={() => openModal('terminate', { vm: v })}><Icon name="trash" size={12}/>Terminate</button>
              ) : (
                v.status !== 'Active' && <button className="btn primary" onClick={handleActivate}><Icon name="play" size={12}/>Activate</button>
              )}
              {userRole !== 'Sales' && userRole !== 'Finance' && <button className="btn danger" onClick={() => openModal('delete', { vm: v })}><Icon name="x" size={12}/>Delete</button>}
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
                        <dt>OS</dt><dd>{(v as any).os_name || 'Linux'}</dd>
                        <dt>OS Version</dt><dd>{(v as any).os_version || '—'}</dd>
                        <dt>Purpose</dt><dd>{(v as any).purpose || '—'}</dd>
                      </dl>
                    </div>
                    <div>
                      <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Subscription</div>
                      <dl className="dl mt-3">
                        <dt>VM ID</dt><dd className="mono">{v.legacy_id || v.id}</dd>
                        <dt>Assigned VM ID</dt><dd className="mono">{(v as any).assigned_vmid || '—'}</dd>
                        <dt>Request ID</dt><dd className="mono">{vmRequest?.legacy_id || v.vm_request_id || '—'}</dd>
                        <dt>Request Type</dt><dd>{vmRequest?.request_type || 'paid'}</dd>
                        <dt>Task Type</dt><dd>{v.task_type || 'New'}</dd>
                        <dt>Duration</dt><dd className="tnum">{(v as any).duration ? `${(v as any).duration} month${(v as any).duration > 1 ? 's' : ''}` : '—'}</dd>
                        <dt>Quantity</dt><dd className="tnum">{(v as any).qty || 1}</dd>
                        <dt>Billing Term</dt><dd className="tnum">{(v as any).duration ? ((v as any).duration === 1 ? 'Monthly' : (v as any).duration === 3 ? 'Quarterly' : (v as any).duration === 6 ? 'Half Yearly' : (v as any).duration === 12 ? 'Yearly' : `${(v as any).duration} month${(v as any).duration > 1 ? 's' : ''}`) : '—'}</dd>
                        <dt>Start Date</dt><dd className="tnum">{(v as any).start_date ? new Date((v as any).start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
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
                  <dt>Zone</dt><dd>{(v as any).zone || '—'}</dd>
                  <dt>NICs</dt><dd className="mono">{(v as any).nics && ((v as any).nics as any).length > 0 
                    ? (typeof (v as any).nics === 'string' ? JSON.parse((v as any).nics) : (v as any).nics).map((nic: any) => nic.vlan || nic.label).join(', ')
                    : '—'}</dd>
                  <dt>Public IP Required</dt><dd>{(v as any).public_ip_required ? 'Yes' : 'No'}</dd>
                  <dt>Firewall policy</dt><dd className="mono">Default</dd>
                </dl>
              </div></div>
              <div className="card">
                <div className="card-head"><h3 className="card-title">Allowed ports</h3></div>
                <div className="card-body flush">
                  <table className="tbl">
                    <thead><tr><th>Port</th><th>Protocol</th><th>Source</th></tr></thead>
                    <tbody>
                      {(v as any).firewall_ports?.map((port: any, idx: number) => (
                        <tr key={idx}>
                          <td className="mono fw-6">{port}</td>
                          <td className="mono">TCP</td>
                          <td className="text-sm">any</td>
                        </tr>
                      ))}
                      {(!(v as any).firewall_ports || (v as any).firewall_ports.length === 0) && (
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
                  <dt>Backup Enabled</dt><dd>{(v as any).backup_enabled ? 'Yes' : 'No'}</dd>
                  <dt>Backup Type</dt><dd>{(v as any).backup_enabled ? (v as any).backup_type : '—'}</dd>
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
                  <div className="grid-2" style={{ gap: 14 }}>
                    {addonRequests.map((ar: any) => (
                      <div key={ar.id}>
                        <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>{ar.legacy_id || ar.id}</div>
                        <dl className="dl">
                          <dt>Services</dt>
                          <dd>
                            <div className="flex gap-1">
                              {ar.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                              {ar.ccis_enabled && <span className="pill subtle">CCIS</span>}
                            </div>
                          </dd>
                          <dt>Package</dt><dd>{[
                            ar.cpfs_enabled && ar.cpfs_package ? `CPFS ${ar.cpfs_package}` : null,
                            ar.ccis_enabled && ar.ccis_package ? `CCIS ${ar.ccis_package}` : null
                          ].filter(Boolean).join(', ') || '—'}</dd>
                          <dt>Duration</dt><dd>{ar.duration || 'N/A'}</dd>
                          {ar.start_date && <><dt>Start Date</dt><dd className="tnum">{new Date(ar.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>}
                          {ar.end_date && <><dt>End Date</dt><dd className="tnum">{new Date(ar.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>}
                          {ar.expiry && <><dt>Expiry</dt><dd><ExpiryCell date={ar.expiry || ''} /></dd></>}
                          <dt>Status</dt><dd><StatusPill status={ar.status}/></dd>
                          <dt>Completed</dt><dd className="tnum">{ar.updated_at ? new Date(ar.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                        </dl>
                      </div>
                    ))}
                  </div>
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
                      <dt>Assigned VM ID</dt><dd>{(v as any).assigned_vmid || '—'}</dd>
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
                      <dt>OS</dt><dd>{(v as any).os_name || 'Linux'}</dd>
                      <dt>OS Version</dt><dd>{(v as any).os_version || '—'}</dd>
                      <dt>Specification Type</dt><dd>{(v as any).sizing || 'Standard'}</dd>
                      <dt>Storage Partitions</dt><dd>{(v as any).storage_partitions || '—'}</dd>
                    </dl>
                  </div>
                  <div>
                    <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Request Details</div>
                    <dl className="dl">
                      <dt>Request ID</dt><dd className="mono">{vmRequest?.legacy_id || v.vm_request_id || '—'}</dd>
                      <dt>Request Type</dt><dd>{vmRequest?.request_type || 'paid'}</dd>
                      <dt>Request Status</dt><dd>{vmRequest?.status || '—'}</dd>
                      <dt>Quantity</dt><dd className="tnum">{(v as any).qty || 1}</dd>
                      <dt>Billing Term</dt><dd className="tnum">{(v as any).duration ? ((v as any).duration === 1 ? 'Monthly' : (v as any).duration === 3 ? 'Quarterly' : (v as any).duration === 6 ? 'Half Yearly' : (v as any).duration === 12 ? 'Yearly' : `${(v as any).duration} month${(v as any).duration > 1 ? 's' : ''}`) : '—'}</dd>
                      <dt>Request Created</dt><dd className="tnum">{vmRequest?.created_at ? new Date(vmRequest.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                      <dt>Request Updated</dt><dd className="tnum">{vmRequest?.updated_at ? new Date(vmRequest.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
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
