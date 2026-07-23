import React, { useState } from 'react'
import useCustomerStore from '../../store/customerStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useInvoiceStore from '../../store/invoiceStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, ExpiryCell } from '../ui/ui'
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
  const { toast } = useUIStore()
  const { createVMManually, updateAddonExpiryForVM } = useTaskStore()
  const { addVM, vms, getVMById, getVMByHostname, updateVM, getVMRequest } = useVMStore()
  const { vmRequests, updateVMRequest } = useVMRequestStore()
  const { addonRequests, updateAddonRequest, deleteAddonRequest } = useAddonRequestStore()
  const { invoices } = useInvoiceStore()
  const [showVMFormModal, setShowVMFormModal] = useState(false)
  const [salesData, setSalesData] = useState({
    assignee: '—',
    status: 'Pending',
    salesNotes: '',
    eta: '',
    internalNotes: '',
  })

  // Computed variables - must be before useEffects
  const t = vmRequests.find((x: any) => x.id === requestId)
  const addonRequest = addonRequests.find((x: any) => x.id === requestId)
  const request = t || addonRequest
  const requestType = t ? 'vm' : 'addon'
  const isUpgrade = requestType === 'vm' && (t?.task_type?.toLowerCase() === 'change-plan')
  const isRenewal = requestType === 'vm' && ((t as any)?.task_type === 'Renewal' || (t as any)?.task_type === 'renewal')
  const isSpecChange = t?.spec_changed || false
  const isTrial = requestType === 'vm' && t?.request_type === 'trial'
  
  // Check if payment is received for this request (via invoice)
  // Skip payment validation for trial requests
  const invoice = invoices.find((i: any) => 
    requestType === 'vm' 
      ? i.vm_request_ids?.includes(requestId)
      : i.addon_request_ids?.includes(requestId)
  )
  const isPaymentReceived = isTrial ? true : (invoice && invoice.status === 'Payment Received')
  const isBackupChange = t?.backup_changed || false

  // Load customers if not loaded yet
  React.useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [customers.length, loadCustomers])

  // Get current VM data from store for change-plan and renewal requests
  const currentVMData = React.useMemo(() => {
    if ((isUpgrade || isRenewal) && t) {
      let vmId = (t as any).vm_id
      // If no direct vm_id, try to find VM by hostname
      if (!vmId && t.hostname) {
        return getVMByHostname(t.hostname)
      } else if (vmId) {
        return getVMById(vmId)
      }
    }
    return null
  }, [isUpgrade, isRenewal, t, getVMById, getVMByHostname])

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

  // Get VM data for addon requests from store
  const addonVMData = React.useMemo(() => {
    if (requestType === 'addon' && (request as any)?.vm_id) {
      return getVMById((request as any).vm_id)
    }
    return null
  }, [requestType, request, getVMById])

  if (!request) return null
  const c = customers.find((cust: any) => cust.id === request.customer_id)

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
  const isTrialConversion = t?.purpose?.includes('Convert trial to paid') || t?.notes?.includes('Trial to paid conversion')

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
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="flex center gap-2 mb-2">
              <span className="mono text-sm text-mute">{request.legacy_id || request.id}</span>
              <span className="pill accent"><span className="dot" />Customer-submitted</span>
              {requestType === 'addon' && <span className="pill warn">Add-on Service</span>}
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {requestType === 'vm' ? (t?.hostname || 'VM') : `Add-on Request for ${addonVMData?.legacy_id || addonVMData?.hostname || (request as any)?.vm_id}`}
            </h2>
            <div className="flex gap-2 mt-2">
              <StatusPill status={salesData.status} />
              {requestType === 'vm' && <span className="pill subtle">{t?.task_type}</span>}
              {requestType === 'vm' && <span className="pill subtle">{t?.request_type === 'trial' ? 'Trial' : 'Paid'}</span>}
              <span className="pill subtle"><Icon name="building" size={10} />{c?.org_name || c?.name}</span>
              <span className="pill subtle">Created {new Date(request.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {requestType === 'addon' && userRole === 'Admin' && (
            <div className="flex gap-2">
              {(request as any)?.operational_status === 'Terminated' ? (
                <button className="btn ok" onClick={() => updateAddonRequest(request.id, { operational_status: 'Active' })}>
                  <Icon name="play" size={12} />Activate
                </button>
              ) : (
                <button className="btn" onClick={() => updateAddonRequest(request.id, { operational_status: 'Terminated' })}>
                  <Icon name="trash" size={12} />Terminate
                </button>
              )}
              <button className="btn danger" onClick={async () => {
                if (confirm('Are you sure you want to delete this add-on request? This cannot be undone.')) {
                  try {
                    await deleteAddonRequest(request.id)
                    toast('Add-on request deleted', 'ok')
                    onClose()
                  } catch (error) {
                    toast('Failed to delete add-on request', 'error')
                    console.error('Error deleting add-on request:', error)
                  }
                }
              }}>
                <Icon name="trash" size={12} />Delete
              </button>
            </div>
          )}
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
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={() => { updateVMRequest(t.id, { status: 'In Progress' }); toast('Upgrade approved and sent to Engineering', 'info') }}
                                  disabled={!isPaymentReceived}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  <Icon name="check" size={11} />Approve & send to Engineering
                                </button>
                                {!isPaymentReceived && (
                                  <div className="text-xs text-mute mt-1" style={{ color: 'var(--bad)' }}>
                                    Payment must be received before starting provisioning
                                  </div>
                                )}
                              </>
                            )}
                            {active && i === 2 && t && userRole !== 'Sales' && (
                              <button className="btn sm ok mt-2" onClick={async () => {
                                // Apply upgrade changes to the VM when completed
                                let vmId = (t as any)?.vm_id

                                // If no direct vm_id, try to find VM by hostname using store
                                if (!vmId && t.hostname) {
                                  const vmData = getVMByHostname(t.hostname)
                                  if (vmData) {
                                    vmId = vmData.id
                                  }
                                }

                                if (vmId) {
                                  try {
                                    await updateVM(vmId, {
                                      vcpu: t.vcpu,
                                      ram_gb: t.ram_gb,
                                      storage_gb: t.storage
                                    })
                                    updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Upgrade completed and changes applied', 'ok')
                                  } catch (error) {
                                    toast('Failed to apply upgrade changes to VM', 'error')
                                    console.error('Error applying upgrade:', error)
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
                        ) : (t && t.task_type === 'Renewal') ? (
                        <>
                          {active && i === 0 && t && (
                            <>
                              <button 
                                className="btn sm accent mt-2" 
                                onClick={() => { updateVMRequest(t.id, { status: 'In Progress' }); toast('Renewal approved and sent to Engineering', 'info') }}
                                disabled={!isPaymentReceived}
                                style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              >
                                <Icon name="check" size={11} />Approve & send to Engineering
                              </button>
                              {!isPaymentReceived && (
                                <div className="text-xs text-mute mt-1" style={{ color: 'var(--bad)' }}>
                                  Payment must be received before starting provisioning
                                </div>
                              )}
                            </>
                          )}
                          {active && i === 2 && t && userRole !== 'Sales' && (
                            <button className="btn sm ok mt-2" onClick={async () => {
                              // Apply renewal expiry extension to the VM when completed
                              let vmId = (t as any).vm_id

                              // If no direct vm_id, try to find VM by hostname using store
                              if (!vmId && t.hostname) {
                                const vmData = getVMByHostname(t.hostname)
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

                                  // Calculate new end_date as created_at + 1 day + new total duration (same as expiry calculation)
                                  const startDate = vmData.created_at ? new Date(vmData.created_at) : new Date()
                                  const newEndDate = new Date(startDate)
                                  newEndDate.setDate(newEndDate.getDate() + 1) // Add 1 day to match expiry calculation
                                  newEndDate.setMonth(newEndDate.getMonth() + newDuration)

                                  // Update VM expiry, end_date, and duration using store
                                  try {
                                    await updateVM(vmId, {
                                      expiry: newExpiry,
                                      end_date: newEndDate.toISOString(),
                                      duration: newDuration
                                    })
                                    
                                    // Update add-on service expiry for this VM
                                    await updateAddonExpiryForVM(vmId, renewalDuration)
                                    
                                    updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Renewal completed and VM expiry extended', 'ok')
                                  } catch (error) {
                                    toast('Failed to update VM expiry', 'error')
                                    console.error('Error updating expiry:', error)
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
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={() => { updateVMRequest(t.id, { status: 'In Progress' }); toast('Trial conversion approved and sent to Engineering', 'info') }}
                                  disabled={!isPaymentReceived}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  <Icon name="check" size={11} />Approve & send to Engineering
                                </button>
                                {!isPaymentReceived && (
                                  <div className="text-xs text-mute mt-1" style={{ color: 'var(--bad)' }}>
                                    Payment must be received before starting provisioning
                                  </div>
                                )}
                              </>
                            )}
                            {active && i === 2 && t && userRole !== 'Sales' && (
                              <button className="btn sm ok mt-2" onClick={async () => {
                                // Apply trial to paid conversion - update VM expiry
                                let vmId = (t as any).vm_id

                                // If no direct vm_id, try to find VM by hostname using store
                                if (!vmId && t.hostname) {
                                  const vmData = getVMByHostname(t.hostname)
                                  if (vmData) {
                                    vmId = vmData.id
                                    // Calculate new expiry date using same logic as other flows
                                    const startDate = vmData.created_at ? new Date(vmData.created_at) : new Date()
                                    startDate.setDate(startDate.getDate() + 1) // Add 1 day

                                    const endDate = new Date(startDate)
                                    endDate.setMonth(endDate.getMonth() + (t.duration || 12))
                                    const newExpiry = endDate.toISOString()

                                    // Update VM expiry, duration, and end_date using store
                                    try {
                                      await updateVM(vmId, {
                                        expiry: newExpiry,
                                        duration: t.duration || 12,
                                        end_date: newExpiry // For paid requests, end_date should match expiry
                                      })

                                      // Update the original VM request from trial to paid
                                      if (vmData.vm_request_id) {
                                        const vmRequest = getVMRequest(vmData.vm_request_id)
                                        if (vmRequest) {
                                          await supabase.from('vm_requests').update({
                                            request_type: 'paid'
                                          }).eq('id', vmData.vm_request_id)
                                        }
                                      }

                                      updateVMRequest(t.id, { status: 'Completed' })
                                      toast('Trial converted to paid successfully', 'ok')
                                    } catch (error) {
                                      toast('Failed to convert trial to paid', 'error')
                                      console.error('Error converting trial:', error)
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
                            {active && i === 0 && t && userRole !== 'Finance' && (
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={() => updateVMRequest(t.id, { status: 'Provisioning' })}
                                  disabled={!isPaymentReceived}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  <Icon name="check" size={11} />Approve & send to Engineering
                                </button>
                                {!isPaymentReceived && (
                                  <div className="text-xs text-mute mt-1" style={{ color: 'var(--bad)' }}>
                                    Payment must be received before starting provisioning
                                  </div>
                                )}
                              </>
                            )}
                            {active && i === 2 && t && !(t as any).createdVmId && (t as any).task_type !== 'Renewal' && userRole !== 'Sales' && userRole !== 'Finance' && (
                              <button 
                                className="btn sm primary mt-2" 
                                onClick={() => setShowVMFormModal(true)}
                                disabled={!isPaymentReceived}
                                style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              >
                                <Icon name="plus" size={11} />Add VM Details
                              </button>
                            )}
                            {active && t && i > 0 && i !== 2 && (i !== WF.length - 1 && i !== 4 || t.status !== 'Completed') && userRole !== 'Finance' && (
                              <button
                                className="btn sm accent mt-2"
                                disabled={!isPaymentReceived || (userRole === 'Sales' && i > 1)}
                                style={!isPaymentReceived || (userRole === 'Sales' && i > 1) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                onClick={async () => {
                                  const statusMap: Record<number, string> = {
                                    2: 'Network',
                                    3: 'Testing',
                                    4: 'Completed',
                                    5: 'Completed'
                                  }
                                  const newStatus = statusMap[i] || 'In Progress'
                                  updateVMRequest(t.id, { status: newStatus })
                                  if (newStatus === 'Completed') {
                                    try {
                                      console.log('Provisioning completed for request:', t.id)
                                      // Get VMs from store that match this request
                                      const matchingVMs = vms.filter(vm => vm.vm_request_id === t.id)
                                      console.log('VM Data result:', matchingVMs)

                                      if (matchingVMs.length > 0) {
                                        // Skip end_date update for trial requests (already set correctly in taskStore)
                                        if (t.request_type !== 'trial') {
                                          // Trigger handles start_date automatically, only update end_date here
                                          const startDate = matchingVMs[0].created_at ? new Date(matchingVMs[0].created_at) : new Date()
                                          const endDate = new Date(startDate)
                                          endDate.setDate(endDate.getDate() + 1) // Add 1 day
                                          endDate.setMonth(endDate.getMonth() + (t.duration || 12))

                                          // Update all VMs associated with this request - only set end_date
                                          for (const vm of matchingVMs) {
                                            await updateVM(vm.id, {
                                              end_date: endDate.toISOString()
                                            })
                                          }
                                        }
                                      } else {
                                        console.log('No VMs found for request:', t.id)
                                      }
                                    } catch (error: any) {
                                      console.error('Error in provisioning completion:', error)
                                      toast('Error: ' + error.message, 'error')
                                    }
                                    toast(`${t?.hostname || 'VM'} provisioning completed`, 'ok')
                                  }


                                }}
                              >
                                <Icon name="check" size={11} />
                                {i === WF.length - 1 || i === 4 ? 'Complete' : `Mark done → ${WF[i + 1].team}`}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {active && i === 0 && userRole !== 'Finance' && (
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={() => { updateAddonRequest(request.id, { status: 'In Progress' }); toast('Add-on provisioning started', 'info') }}
                                  disabled={!isPaymentReceived}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  <Icon name="play" size={11} />Start provisioning
                                </button>
                                {!isPaymentReceived && (
                                  <div className="text-xs text-mute mt-1" style={{ color: 'var(--bad)' }}>
                                    Payment must be received before starting provisioning
                                  </div>
                                )}
                              </>
                            )}
                            {active && i === 2 && userRole !== 'Sales' && userRole !== 'Finance' && (
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
                    <dt>Contact Person</dt><dd>{c?.name}</dd>
                    <dt>Email</dt><dd className="mono text-sm">{c?.email}</dd>
                  </dl>
                </div>
                <div>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Request type</div>
                  <dl className="dl">
                    <dt>Type</dt><dd>{requestType === 'vm' ? t?.task_type : 'Add-on Service'}</dd>
                    <dt>Plan</dt><dd>{requestType === 'vm' ? (t?.request_type === 'trial' ? '14-day Trial' : 'Paid') : ((request as any)?.duration || '—')}</dd>
                    <dt>Submitted</dt><dd className="tnum">{new Date(request.created_at).toLocaleDateString()}</dd>
                  </dl>
                </div>
              </div>
              <div className="divider" />
              {requestType === 'vm' ? (
                <>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>VM Configuration</div>
                  <dl className="dl">
                    <dt>Request ID</dt><dd className="mono">{t?.legacy_id || t?.id}</dd>
                    {(isUpgrade || isRenewal) && currentVMData && (
                      <>
                        <dt>VM ID</dt><dd className="mono">{currentVMData.legacy_id || currentVMData.id}</dd>
                      </>
                    )}
                    <dt>Hostname</dt><dd className="mono">{t?.hostname}</dd>
                    <dt>Purpose</dt><dd>{t?.purpose || '—'}</dd>
                    {!isUpgrade || isSpecChange ? (
                      <>
                        <dt>vCPU</dt><dd className="mono">{t?.vcpu} cores</dd>
                        <dt>Memory</dt><dd className="mono">{t?.ram_gb} GB</dd>
                        <dt>Storage</dt><dd className="mono">{t?.storage} GB</dd>
                      </>
                    ) : null}
                    <dt>Quantity</dt><dd className="mono">{t?.qty}</dd>
                    <dt>Spec Type</dt><dd className="mono" style={{ color: t?.sizing === 'Standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{t?.sizing}</dd>
                    <dt>OS</dt><dd className="mono">{t?.os_name} {t?.os_version}</dd>
                    <dt>Zone</dt><dd className="mono">{t?.zone}</dd>
                    {t?.duration && <><dt>Billing Term</dt><dd className="mono">{t?.duration === 1 ? 'Monthly' : t?.duration === 3 ? 'Quarterly' : t?.duration === 6 ? 'Half Yearly' : t?.duration === 12 ? 'Yearly' : `${t?.duration} months`}</dd></>}
                    {(!isUpgrade || isBackupChange) && (
                      <>
                        <dt>Backup</dt>
                        <dd className="mono">
                          {isUpgrade && currentVMData ? (
                            <>
                              {currentVMData.backup_enabled ? `${currentVMData.backup_type === 'daily' ? 'Daily' : 'Weekly'} Backup` : 'Disabled'}
                              <span style={{ color: 'var(--accent-strong)', margin: '0 4px' }}>→</span>
                              <span style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>
                                {t?.backup_enabled ? `${t?.backup_type === 'daily' ? 'Daily' : 'Weekly'} Backup` : 'Disabled'}
                              </span>
                            </>
                          ) : (
                            t?.backup_enabled ? `${t?.backup_type === 'daily' ? 'Daily' : 'Weekly'} Backup` : 'Disabled'
                          )}
                        </dd>
                      </>
                    )}
                    {t?.notes && (
                      <>
                        <dt>Notes</dt><dd>{t?.notes}</dd>
                      </>
                    )}
                  </dl>
                </>
              ) : (
                <>
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Add-on Services</div>
                  <dl className="dl">
                    <dt>VM</dt><dd className="mono">{addonVMData ? `${addonVMData.legacy_id || addonVMData.id} · ${addonVMData.hostname}` : 'Loading...'}</dd>
                    {(request as any)?.cpfs_enabled && (
                      <>
                        <dt>CPFS</dt><dd className="mono">Cloud Parallel File System - {(request as any)?.cpfs_package || 'standard'}</dd>
                      </>
                    )}
                    {(request as any)?.ccis_enabled && (
                      <>
                        <dt>CCIS</dt><dd className="mono">Cloud Container Image Service - {(request as any)?.ccis_package || 'standard'}</dd>
                      </>
                    )}
                    {(request as any)?.duration && <><dt>Duration</dt><dd className="mono">{(request as any)?.duration || '—'}</dd></>}
                    {(request as any)?.start_date && <><dt>Start Date</dt><dd className="mono tnum">{new Date((request as any)?.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>}
                    {(request as any)?.end_date && <><dt>End Date</dt><dd className="mono tnum">{new Date((request as any)?.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></>}
                    {(request as any)?.expiry && <><dt>Expiry</dt><dd><ExpiryCell date={(request as any)?.expiry || ''} /></dd></>}
                    {(request as any)?.notes && <><dt>Notes</dt><dd>{(request as any)?.notes}</dd></>}
                  </dl>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* VM Details Modal */}
      {showVMFormModal && t && (
        <div className="modal-overlay" onClick={() => setShowVMFormModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Add VM Details</h3>
              <button className="icon-btn" onClick={() => setShowVMFormModal(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body" style={{ paddingRight: 16 }}>
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
