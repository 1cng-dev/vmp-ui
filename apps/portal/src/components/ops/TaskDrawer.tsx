import React, { useState } from 'react'
import useCustomerStore from '../../store/customerStore'
import useTeamStore from '../../store/teamStore'
import useUIStore from '../../store/uiStore'
import useVMRequestStore from '../../store/vmRequestStore'
import Icon from '../../lib/icons'
import { StatusPill } from '../ui/ui'
import EngineerVMCreateForm from '../engineer/EngineerVMCreateForm'
import useTaskStore from '../../store/taskStore'
import useVMStore from '../../store/vmStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import { supabase } from '../../lib/supabase'

interface TaskDrawerProps {
  requestId: string
  onClose: () => void
  userRole?: string
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ requestId, onClose, userRole }) => {
  const { customers, loadCustomers } = useCustomerStore()
  const { team } = useTeamStore()
  const { toast } = useUIStore()
  const { createVMManually } = useTaskStore()
  const { addVM } = useVMStore()
  const { vmRequests, updateVMRequest } = useVMRequestStore()
  const { updateAddonRequest } = useAddonRequestStore()
  const [addonRequests, setAddonRequests] = useState<any[]>([])
  const [showVMFormModal, setShowVMFormModal] = useState(false)

  // Load customers if not loaded yet
  React.useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [customers.length, loadCustomers])

  // Load addon requests
  React.useEffect(() => {
    const loadAddonRequests = async () => {
      const { data, error } = await supabase.from('addon_requests').select('*')
      if (!error && data) {
        setAddonRequests(data)
      }
    }
    loadAddonRequests()
  }, [])

  const t = vmRequests.find((x: any) => x.id === requestId)
  const addonRequest = addonRequests.find((x: any) => x.id === requestId)
  const request = t || addonRequest
  const requestType = t ? 'vm' : 'addon'
  const isUpgrade = requestType === 'vm' && (t?.task_type?.toLowerCase() === 'change-plan')

  // Initialize salesData with default values, will be updated after request is found
  const [salesData, setSalesData] = useState({
    assignee: '—',
    status: 'Pending',
    salesNotes: '',
    eta: '',
    internalNotes: '',
  })

  // Update salesData when request is found
  React.useEffect(() => {
    if (request) {
      setSalesData({
        assignee: requestType === 'vm' ? (t?.assigned_to || '—') : '—',
        status: request.status,
        salesNotes: requestType === 'vm' ? ((t as any)?.salesNotes || '') : '',
        eta: requestType === 'vm' ? ((t as any)?.eta || '') : '',
        internalNotes: requestType === 'vm' ? ((t as any)?.internalNotes || '') : '',
      })
    }
  }, [request, requestType, t])

  if (!request) return null
  const c = customers.find((cust: any) => cust.id === request.customer_id)

  const save = () => {
    if (requestType === 'vm') {
      if (!t) return
      updateVMRequest(t.id, {
        status: salesData.status,
        assigned_to: salesData.assignee !== '—' ? salesData.assignee : null,
      })
    } else {
      const mapped = salesData.status === 'Provisioning' ? 'In Progress' : salesData.status
      updateAddonRequest(request.id, { status: mapped as any })
    }
    toast(`${request.id} updated · customer notified`, 'ok')
  }

  const WF_VM = [
    { label: 'Submitted', team: 'Customer', icon: 'mail', desc: 'Request received via portal' },
    { label: 'Sales review', team: 'Sales', icon: 'shield', desc: 'Review VM request' },
    { label: 'Provisioning', team: 'Engineering', icon: 'server', desc: 'Build VM per specs' },
    { label: 'Network config', team: 'Network', icon: 'shield', desc: 'Configure firewall & ports' },
    { label: 'Testing', team: 'Engineering', icon: 'key', desc: 'Test VM, upload credentials' },
    { label: 'VM Ready ✓', team: 'Customer', icon: 'check', desc: 'Customer notified & can access' },
  ]
  const WF_ADDON = [
    { label: 'Submitted', team: 'Customer', icon: 'mail', desc: 'Request received via portal' },
    { label: 'Sales review', team: 'Sales', icon: 'shield', desc: 'Review & quote approval' },
    { label: 'Provisioning', team: 'Engineering', icon: 'server', desc: 'Enable add-on services' },
    { label: 'Completed ✓', team: 'Customer', icon: 'check', desc: 'Customer notified' },
  ]

  const WF_UPGRADE = WF_ADDON
const isRenewal = requestType === 'vm' && (t?.task_type === 'Renewal' || t?.task_type === 'renewal')
  const isTrialConversion = t?.purpose?.includes('Convert trial to paid') || t?.notes?.includes('Trial to paid conversion')
  
  // Determine what was changed by checking notes
  const specChanged = t?.notes?.includes('Change Plan from:')
  const backupOnlyChange = t?.notes?.includes('Backup service') && !specChanged
  const backupChanged = specChanged || backupOnlyChange

  const WF = isUpgrade || isRenewal ? WF_UPGRADE : (isTrialConversion ? WF_UPGRADE : (requestType === 'vm' ? WF_VM : WF_ADDON))
  const vmStatus = (t?.status as any) || 'Pending'
  const wfStage = isUpgrade || isRenewal || isTrialConversion
    ? (vmStatus === 'Pending' ? 0 : vmStatus === 'In Progress' ? 2 : vmStatus === 'Completed' ? WF.length - 1 : 0)
    : (requestType === 'vm'
      ? (vmStatus === 'Pending' ? 0 : vmStatus === 'In Progress' ? 1 : vmStatus === 'Provisioning' ? 2 : vmStatus === 'Network' ? 3 : vmStatus === 'Testing' ? 4 : vmStatus === 'Completed' ? 5 : 0)
      : (request.status === 'Pending' ? 0 : request.status === 'In Progress' ? 2 : request.status === 'Completed' ? WF.length - 1 : 0))

  
  const teamColor: Record<string, string> = {
    Customer: 'var(--info)',
    Sales: 'oklch(0.6 0.16 30)',
    'VPS Portal': 'var(--accent)',
    Engineering: 'var(--ok)',
    Network: 'oklch(0.55 0.17 285)'
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 'min(860px, 95vw)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="flex center gap-2 mb-2">
            <span className="mono text-sm text-mute">{request.legacy_id || request.id}</span>
            <span className="pill accent"><span className="dot" />Customer-submitted</span>
            {requestType === 'addon' && <span className="pill warn">Add-on Service</span>}
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {requestType === 'vm' ? (t?.hostname || 'VM') : `Add-on Request for VM ${request.vm_id}`}
          </h2>
          <div className="flex gap-2 mt-2">
            <StatusPill status={salesData.status} />
            {requestType === 'vm' && <span className="pill subtle">{t?.task_type}</span>}
            {requestType === 'vm' && <span className="pill subtle">{t?.request_type === 'trial' ? 'Trial' : 'Paid'}</span>}
            <span className="pill subtle"><Icon name="building" size={10} />{c?.org_name || c?.name}</span>
            <span className="pill subtle">Created {new Date(request.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {/* Workflow stage tracker */}
          <div className="card mb-4">
            <div className="card-head">
              <h3 className="card-title">Provisioning workflow</h3>
              <span className="pill accent"><span className="dot" />Step {Math.min(wfStage + 1, WF.length)} of {WF.length}</span>
            </div>
            <div className="card-body">
              <div className="flex col gap-2">
                {WF.map((w, i) => {
                  const active = i === wfStage
                  const color = teamColor[w.team] || 'var(--ink-3)'
                  return (
                    <div key={w.label} className="flex center gap-3" style={{ opacity: i <= wfStage ? 1 : 0.4 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: i < wfStage ? 'var(--ok)' : i === wfStage ? 'var(--accent)' : 'var(--surface-3)', color: i <= wfStage ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', fontSize: 11 }}>
                        {i < wfStage ? <Icon name="check" size={11} /> : <Icon name={w.icon} size={11} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="flex center gap-2">
                          <div className="fw-6 text-sm">{w.label}</div>
                          <span className="pill subtle" style={{ fontSize: 9.5, background: `${color}1a`, color }}>{w.team}</span>
                          {active && <span className="pill warn" style={{ fontSize: 9.5 }}>Current</span>}
                        </div>
                        <div className="text-xs text-mute mt-1">{w.desc}</div>
                        {isUpgrade ? (
                          <>
                            {active && i === 0 && t && (
                              <button className="btn sm accent mt-2" onClick={() => { updateVMRequest(t.id, { status: 'In Progress' }); toast('Upgrade approved and sent to Engineering', 'info') }}>
                                <Icon name="check" size={11} />Approve & send to Engineering
                              </button>
                            )}
                            {active && i === 2 && t && userRole !== 'Sales' && (
                              <button className="btn sm ok mt-2" onClick={async () => {
                                // Apply upgrade changes to the VM when completed
                                let vmId = t.vm_id

                                // If no direct vm_id, try to find VM by hostname
                                if (!vmId && t.hostname) {
                                  const { data: vmData } = await supabase.from('vms').select('id').eq('hostname', t.hostname).single()
                                  if (vmData) {
                                    vmId = vmData.id
                                  }
                                }

                                if (vmId) {
                                  const { error } = await supabase.from('vms').update({
                                    vcpu: t.vcpu,
                                    ram_gb: t.ram_gb,
                                    storage_gb: t.storage
                                  }).eq('id', vmId)
                                  if (error) {
                                    toast('Failed to apply upgrade changes to VM', 'error')
                                    console.error('Error applying upgrade:', error)
                                  } else {
                                    updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Upgrade completed and changes applied', 'ok')
                                  }
                                } else {
                                  updateVMRequest(t.id, { status: 'Completed' })
                                  toast('Upgrade completed (could not find VM to apply changes)', 'info')
                                }
                              }}>
                                <Icon name="check" size={11} />Complete & Apply Changes
                              </button>
                            )}
                          </>
                        ) : (t.task_type === 'Renewal' || t.task_type === 'renewal') ? (
                          <>
                            {active && i === 0 && t && (
                              <button className="btn sm accent mt-2" onClick={() => { updateVMRequest(t.id, { status: 'In Progress' }); toast('Renewal approved and sent to Engineering', 'info') }}>
                                <Icon name="check" size={11} />Approve & send to Engineering
                              </button>
                            )}
                            {active && i === 2 && t && userRole !== 'Sales' && (
                              <button className="btn sm ok mt-2" onClick={async () => {
                                // Apply renewal expiry extension to the VM when completed
                                let vmId = (t as any).vm_id

                                // If no direct vm_id, try to find VM by hostname
                                if (!vmId && t.hostname) {
                                  const { data: vmData } = await supabase.from('vms').select('id, expiry, duration, vm_request_id').eq('hostname', t.hostname).single()
                                  if (vmData) {
                                    vmId = vmData.id
                                    // Calculate new expiry date
                                    const currentExpiry = vmData.expiry ? new Date(vmData.expiry) : new Date()
                                    currentExpiry.setMonth(currentExpiry.getMonth() + (t.duration || 12))
                                    const newExpiry = currentExpiry.toISOString()

                                    // Calculate new duration (existing duration + renewal duration)
                                    const currentDuration = vmData.duration || 0
                                    const renewalDuration = t.duration || 12
                                    const newDuration = currentDuration + renewalDuration

                                    // Update VM expiry and duration
                                    const { error } = await supabase.from('vms').update({
                                      expiry: newExpiry,
                                      duration: newDuration
                                    }).eq('id', vmId)
                                    if (error) {
                                      toast('Failed to update VM expiry', 'error')
                                      console.error('Error updating expiry:', error)
                                    } else {
                                      updateVMRequest(t.id, { status: 'Completed' })
                                      toast('Renewal completed and VM expiry extended', 'ok')
                                    }
                                  }
                                }

                                if (!vmId) {
                                  updateVMRequest(t.id, { status: 'Completed' })
                                  toast('Renewal completed (could not find VM to extend expiry)', 'info')
                                }
                              }}>
                                <Icon name="check" size={11} />Complete & Extend Expiry
                              </button>
                            )}
                          </>
                        ) : isTrialConversion ? (
                          <>
                            {active && i === 0 && t && (
                              <button className="btn sm accent mt-2" onClick={() => { updateVMRequest(t.id, { status: 'In Progress' }); toast('Trial conversion approved and sent to Engineering', 'info') }}>
                                <Icon name="check" size={11} />Approve & send to Engineering
                              </button>
                            )}
                            {active && i === 2 && t && userRole !== 'Sales' && (
                              <button className="btn sm ok mt-2" onClick={async () => {
                                // Apply trial to paid conversion - update VM expiry
                                let vmId = (t as any).vm_id

                                // If no direct vm_id, try to find VM by hostname
                                if (!vmId && t.hostname) {
                                  const { data: vmData } = await supabase.from('vms').select('id, expiry, duration, vm_request_id').eq('hostname', t.hostname).single()
                                  if (vmData) {
                                    vmId = vmData.id
                                    // Calculate new expiry date from current date
                                    const startDate = new Date()
                                    startDate.setDate(startDate.getDate() + 1) // Start from next day
                                    
                                    const durationMonths = t.duration || 12
                                    const expiryDate = new Date(startDate)
                                    expiryDate.setMonth(expiryDate.getMonth() + durationMonths)
                                    const newExpiry = expiryDate.toISOString()

                                    // Update VM expiry, duration, and billing_term
                                    const { error } = await supabase.from('vms').update({
                                      expiry: newExpiry,
                                      duration: t.duration || 12,
                                      billing_term: (t as any).billing_term
                                    }).eq('id', vmId)
                                    
                                    if (error) {
                                      toast('Failed to convert trial to paid', 'error')
                                      console.error('Error converting trial:', error)
                                    } else {
                                      // Update the original VM request from trial to paid
                                      if (vmData.vm_request_id) {
                                        await supabase.from('vm_requests').update({
                                          request_type: 'paid'
                                        }).eq('id', vmData.vm_request_id)
                                      }
                                      
                                      updateVMRequest(t.id, { status: 'Completed' })
                                      toast('Trial converted to paid successfully', 'ok')
                                    }
                                  }
                                }

                                if (!vmId) {
                                  updateVMRequest(t.id, { status: 'Completed' })
                                  toast('Conversion completed (could not find VM to update)', 'info')
                                }
                              }}>
                                <Icon name="check" size={11} />Complete Conversion
                              </button>
                            )}
                          </>
                        ) : requestType === 'vm' ? (
                          <>
                            {active && i === 0 && t && (
                              <button className="btn sm accent mt-2" onClick={() => updateVMRequest(t.id, { status: 'Provisioning' })}>
                                <Icon name="check" size={11} />Approve & send to Engineering
                              </button>
                            )}
                            {active && i === 2 && t && !(t as any).createdVmId && (t as any).task_type !== 'Renewal' && userRole !== 'Sales' && (
                              <button className="btn sm primary mt-2" onClick={() => setShowVMFormModal(true)}>
                                <Icon name="plus" size={11} />Add VM Details
                              </button>
                            )}
                            {active && t && i > 0 && i !== 2 && (i !== WF.length - 1 && i !== 4 || t.status !== 'Completed') && (
                              <button
                                className="btn sm accent mt-2"
                                onClick={() => {
                                  const statusMap: Record<number, string> = {
                                    2: 'Network',
                                    3: 'Testing',
                                    4: 'Completed',
                                    5: 'Completed'
                                  }
                                  const newStatus = statusMap[i] || 'In Progress'
                                  updateVMRequest(t.id, { status: newStatus })
                                  if (newStatus === 'Completed') {
                                    toast(`${t?.hostname || 'VM'} provisioning completed`, 'ok')
                                  }
                                }}
                                disabled={userRole === 'Sales' && i > 1}
                                style={userRole === 'Sales' && i > 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              >
                                <Icon name="check" size={11} />
                                {i === WF.length - 1 || i === 4 ? 'Complete' : `Mark done → ${WF[i + 1].team}`}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {active && i === 0 && (
                              <button className="btn sm accent mt-2" onClick={() => { updateAddonRequest(request.id, { status: 'In Progress' }); toast('Add-on provisioning started', 'info') }}>
                                <Icon name="play" size={11} />Start provisioning
                              </button>
                            )}
                            {active && i === 2 && (
                              <button className="btn sm ok mt-2" onClick={() => { updateAddonRequest(request.id, { status: 'Completed' }); toast('Add-on provisioning completed', 'ok') }}>
                                <Icon name="check" size={11} />Complete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Customer info card */}
          <div className="card mb-4">
            <div className="card-head"><h3 className="card-title">Customer info</h3></div>
            <div className="card-body">
              <div className="grid-2" style={{ gap: 16 }}>
                <div>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Customer</div>
                  <dl className="dl">
                    <dt>Customer</dt><dd>{c?.org_name || c?.name}</dd>
                    <dt>Contact</dt><dd>{c?.name}</dd>
                    <dt>Email</dt><dd className="mono text-sm">{c?.email}</dd>
                  </dl>
                </div>
                <div>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Request type</div>
                  <dl className="dl">
                    <dt>Type</dt><dd>{requestType === 'vm' ? t?.task_type : 'Add-on Service'}</dd>
                    <dt>Plan</dt><dd>{requestType === 'vm' ? (t?.request_type === 'trial' ? '14-day Trial' : 'Paid') : (request.duration ? `${request.duration} months` : '—')}</dd>
                    <dt>Submitted</dt><dd className="tnum">{new Date(request.created_at).toLocaleDateString()}</dd>
                  </dl>
                </div>
              </div>
              <div className="divider" />
              {requestType === 'vm' ? (
                <>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>VM Configuration</div>
                  <dl className="dl">
                    <dt>Hostname</dt><dd className="mono">{t?.hostname}</dd>
                    <dt>Purpose</dt><dd>{t?.purpose || '—'}</dd>
                    {specChanged && (
                      <>
                        <dt>vCPU</dt><dd className="mono">{t?.vcpu} cores</dd>
                        <dt>Memory</dt><dd className="mono">{t?.ram_gb} GB</dd>
                        <dt>Storage</dt><dd className="mono">{t?.storage} GB</dd>
                      </>
                    )}
                    <dt>Quantity</dt><dd className="mono">{t?.qty}</dd>
                    <dt>Spec Type</dt><dd className="mono" style={{ color: t?.sizing === 'Standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{t?.sizing}</dd>
                    <dt>OS</dt><dd className="mono">{t?.os_name} {t?.os_version}</dd>
                    <dt>Zone</dt><dd className="mono">{t?.zone}</dd>
                    {t?.duration && <><dt>Duration</dt><dd className="mono">{t?.duration} months</dd></>}
                    {backupChanged && <><dt>Backup</dt><dd className="mono">{t?.backup_enabled ? `${t?.backup_type === 'daily' ? 'Daily' : 'Weekly'} Backup` : 'Disabled'}</dd></>}
                  </dl>
                </>
              ) : (
                <>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Add-on Services</div>
                  <dl className="dl">
                    <dt>VM ID</dt><dd className="mono">{request.vm_id}</dd>
                    {request.cpfs_enabled && (
                      <>
                        <dt>CPFS</dt><dd className="mono">Cloud Parallel File System - {request.cpfs_package || 'standard'}</dd>
                      </>
                    )}
                    {request.ccis_enabled && (
                      <>
                        <dt>CCIS</dt><dd className="mono">Cloud Container Image Service - {request.ccis_package || 'standard'}</dd>
                      </>
                    )}
                    {request.duration && <><dt>Duration</dt><dd className="mono">{request.duration} months</dd></>}
                    {request.notes && <><dt>Notes</dt><dd>{request.notes}</dd></>}
                  </dl>
                </>
              )}
            </div>
          </div>

          {/* Sales workspace */}
          <div className="card mb-4">
            <div className="card-head">
              <h3 className="card-title">Sales workspace</h3>
              <button className="btn sm accent" onClick={save}><Icon name="check" size={11} />Save changes</button>
            </div>
            <div className="card-body">
              <div className="flex col gap-3">
                <div className="field">
                  <label>Assigned person</label>
                  <select value={salesData.assignee} onChange={e => setSalesData({ ...salesData, assignee: e.target.value })}>
                    <option value="—">— Unassigned —</option>
                    {team.map((m: any) => <option key={m.id} value={m.name}>{m.name} · {m.role}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <div className="flex gap-2 wrap">
                    {['Pending', 'In Progress', 'Provisioning', 'Completed'].map(s => (
                      <button key={s}
                        className={`filter-chip ${salesData.status === s ? 'active' : ''}`}
                        onClick={() => setSalesData({ ...salesData, status: s })}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Quote / ETA</label>
                  <input value={salesData.eta} onChange={e => setSalesData({ ...salesData, eta: e.target.value })} placeholder="e.g. MMK 540,000 · ready by 31 May" />
                </div>
                <div className="field">
                  <label>Customer-facing notes</label>
                  <input value={salesData.salesNotes} onChange={e => setSalesData({ ...salesData, salesNotes: e.target.value })} placeholder="Will be shown to customer" />
                </div>
                <div className="field">
                  <label>Internal notes (not visible to customer)</label>
                  <textarea rows={3} value={salesData.internalNotes} onChange={e => setSalesData({ ...salesData, internalNotes: e.target.value })} placeholder="Migration risks, pricing context, engineering hand-off…" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions - only for VM requests */}
          {requestType === 'vm' && t && (
            <div className="card">
              <div className="card-head"><h3 className="card-title">Quick actions</h3></div>
              <div className="card-body">
                <div className="flex gap-2 wrap">
                  <button className="btn" onClick={() => toast(`Email sent to ${c?.email}`, 'ok')}><Icon name="mail" size={12} />Email customer</button>
                  <button className="btn" onClick={() => toast('Quote PDF generated', 'ok')}><Icon name="invoice" size={12} />Generate quote</button>
                  <button className="btn" onClick={() => { setSalesData({ ...salesData, status: 'In Progress' }); updateVMRequest(t.id, { status: 'In Progress' }); toast('Request moved to In Progress', 'info'); }}><Icon name="play" size={12} />Start work</button>
                  <button className="btn" onClick={() => toast('Customer notified — request needs more info', 'warn')}><Icon name="alert" size={12} />Request more info</button>
                  <button className="btn accent" onClick={() => { updateVMRequest(t.id, { status: 'Completed' }); toast('Marked done · customer notified', 'ok'); }}><Icon name="check" size={12} />Mark done</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VM Details Modal */}
      {showVMFormModal && t && (
        <div className="modal-overlay" onClick={() => setShowVMFormModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Add VM Details</h3>
              <button className="icon-btn" onClick={() => setShowVMFormModal(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <EngineerVMCreateForm
                task={t as any}
                onSubmit={async (details) => {
                  console.log('VM form submitted with details:', details)
                  try {
                    console.log('Calling createVMManually for task:', t)
                    await createVMManually(t as any, details, addVM)
                    console.log('createVMManually completed successfully')
                    updateVMRequest(t.id, { status: 'Network' })
                    setShowVMFormModal(false)
                    toast('VM records created successfully', 'ok')
                  } catch (error: any) {
                    console.error('Error creating VM records:', error)
                    console.error('Error stack:', error.stack)
                    toast('Failed to create VM records: ' + (error.message || 'Unknown error'), 'error')
                  }
                }}
              />
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowVMFormModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
