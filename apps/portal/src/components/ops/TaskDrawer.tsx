import React, { useState } from 'react'
import useCustomerStore from '../../store/customerStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useInvoiceStore from '../../store/invoiceStore'
import useUIStore from '../../store/uiStore'
import useActivityStore from '../../store/activityStore'
import Icon from '../../lib/icons'
import { StatusPill, ExpiryCell, CircularSpinner } from '../ui/ui'
import EngineerVMCreateForm from '../engineer/EngineerVMCreateForm'
import useTaskStore from '../../store/taskStore'
import useVMStore from '../../store/vmStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import useAddonServiceStore from '../../store/addonServiceStore'
import { supabase } from '../../lib/supabase'

interface TaskDrawerProps {
  requestId: string
  onClose: () => void
  userRole?: string
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

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ requestId, onClose, userRole }) => {
  const { customers, loadCustomers } = useCustomerStore()
  const { toast } = useUIStore()
  const { logActivity } = useActivityStore()
  const { createVMManually, updateAddonExpiryForVM } = useTaskStore()
  const { addVM, vms, getVMById, getVMByHostname, updateVM, getVMRequest } = useVMStore()
  const { vmRequests, updateVMRequest } = useVMRequestStore()
  const { addonRequests, updateAddonRequest, deleteAddonRequest, loadAddonRequests } = useAddonRequestStore()
  const { getAddonServicesForVM } = useAddonServiceStore()
  const { invoices } = useInvoiceStore()
  const [showVMFormModal, setShowVMFormModal] = useState(false)
  const [salesData, setSalesData] = useState({
    assignee: '—',
    status: 'Pending',
    salesNotes: '',
    eta: '',
    internalNotes: '',
  })
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // Computed variables - must be before useEffects
  const t = vmRequests.find((x: any) => x.id === requestId)
  const addonRequest = addonRequests.find((x: any) => x.id === requestId)
  const request = t || addonRequest
  const requestType = t ? 'vm' : 'addon'
  const isUpgrade = requestType === 'vm' && (t?.task_type?.toLowerCase() === 'change-plan')
  const isRenewal = requestType === 'vm' && ((t as any)?.task_type === 'Renewal' || (t as any)?.task_type === 'renewal')
  const isSpecChange = t?.spec_changed || false
  const isTrial = requestType === 'vm' && t?.request_type === 'trial'

  // Get VM data for addon requests from store (must be before payment check)
  const addonVMData = React.useMemo(() => {
    if (requestType === 'addon' && (request as any)?.vm_id) {
      return getVMById((request as any).vm_id)
    }
    return null
  }, [requestType, request, getVMById])

  // Check if payment is received for this request (via invoice)
  // Skip payment validation for trial requests only
  // All paid requests (new, renewal, addon) require payment before provisioning
  const invoice = invoices.find((i: any) =>
    requestType === 'vm'
      ? i.vm_request_ids?.includes(requestId)
      : i.addon_request_ids?.includes(requestId)
  )
  // Skip payment check only for trial VMs
  // All other requests (new paid, renewal, addon) require payment before provisioning
  const isPaymentReceived = isTrial ? true : (invoice && invoice.status === 'Payment Received')
  const isBackupChange = t?.backup_changed || false

  // Load customers if not loaded yet
  React.useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [customers.length, loadCustomers])

  // Load addon requests if not loaded yet
  React.useEffect(() => {
    if (addonRequests.length === 0) {
      loadAddonRequests()
    }
  }, [addonRequests.length, loadAddonRequests])

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
                <button className="btn ok" onClick={async () => {
                  setIsActivating(true)
                  await updateAddonRequest(request.id, { operational_status: 'Active' })
                  setIsActivating(false)
                }} disabled={isActivating}>
                  {isActivating ? <CircularSpinner size={12} /> : <><Icon name="play" size={12} />Activate</>}
                </button>
              ) : (
                <button className="btn" onClick={async () => {
                  setIsTerminating(true)
                  await updateAddonRequest(request.id, { operational_status: 'Terminated' })
                  setIsTerminating(false)
                }} disabled={isTerminating}>
                  {isTerminating ? <CircularSpinner size={12} /> : <><Icon name="trash" size={12} />Terminate</>}
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
                                  onClick={async () => {
                                    setIsApproving(true)
                                    await updateVMRequest(t.id, { status: 'In Progress' })
                                    toast('Upgrade approved and sent to Engineering', 'info')
                                    setIsApproving(false)
                                  }}
                                  disabled={!isPaymentReceived || isApproving}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  {isApproving ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Approve & send to Engineering</>}
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
                                setIsCompleting(true)
                                // Apply upgrade changes to the VM when completed
                                let vmId = (t as any)?.vm_id

                                // If vm_id exists, verify VM exists in store
                                if (vmId) {
                                  const currentVM = vms.find((v: any) => v.id === vmId)
                                  if (!currentVM) {
                                    await updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Upgrade completed (could not find VM to apply changes)', 'info')
                                    setIsCompleting(false)
                                    return
                                  }
                                }

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
                                    await updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Upgrade completed and changes applied', 'ok')
                                  } catch (error) {
                                    toast('Failed to apply upgrade changes to VM', 'error')
                                  }
                                } else {
                                  await updateVMRequest(t.id, { status: 'Completed' })
                                  toast('Upgrade completed (could not find VM to apply changes)', 'info')
                                }
                                setIsCompleting(false)
                              }} disabled={isCompleting}>
                                {isCompleting ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Complete & Apply Changes</>}
                              </button>
                            )}
                          </>
                        ) : (t && t.task_type === 'Renewal') ? (
                        <>
                          {active && i === 0 && t && (
                            <>
                              <button 
                                className="btn sm accent mt-2" 
                                onClick={async () => {
                                  setIsApproving(true)
                                  await updateVMRequest(t.id, { status: 'In Progress' })
                                  toast('Renewal approved and sent to Engineering', 'info')
                                  setIsApproving(false)
                                }}
                                disabled={!isPaymentReceived || isApproving}
                                style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                              >
                                {isApproving ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Approve & send to Engineering</>}
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
                              setIsCompleting(true)
                              // Apply renewal expiry extension to the VM when completed
                              let vmId = (t as any).vm_id

                              // If vm_id exists directly, use it to update VM
                              if (vmId) {
                                try {
                                  // Parse duration from string format - handles combined formats like "1 month 14 days"
                                  const parseDuration = (durationStr: string | number | null | undefined): { months: number; days: number } => {
                                    if (!durationStr) return { months: 0, days: 0 };
                                    if (typeof durationStr === 'number') {
                                      return { months: durationStr, days: 0 };
                                    }

                                    const str = String(durationStr).toLowerCase();
                                    let months = 0;
                                    let days = 0;

                                    // Match months
                                    const monthsMatch = str.match(/(\d+)\s*months?/);
                                    if (monthsMatch) {
                                      months = parseInt(monthsMatch[1], 10);
                                    }

                                    // Match days
                                    const daysMatch = str.match(/(\d+)\s*days?/);
                                    if (daysMatch) {
                                      days = parseInt(daysMatch[1], 10);
                                    }

                                    // If no match, try parsing as simple number (assume months)
                                    if (months === 0 && days === 0) {
                                      const num = parseInt(str, 10);
                                      if (!isNaN(num)) {
                                        months = num;
                                      }
                                    }

                                    return { months, days };
                                  };

                                  const parsedRenewalDuration = parseDuration(t.duration)
                                  const renewalMonths = parsedRenewalDuration.months
                                  const renewalDays = parsedRenewalDuration.days

                                  // Get current VM data
                                  const currentVM = vms.find((v: any) => v.id === vmId)
                                  if (!currentVM) {
                                    await updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Renewal completed (could not find VM to extend expiry)', 'info')
                                    setIsCompleting(false)
                                    return
                                  }

                                  // Parse existing VM duration
                                  const parsedExistingDuration = parseDuration(currentVM.duration)
                                  const existingMonths = parsedExistingDuration.months
                                  const existingDays = parsedExistingDuration.days

                                  // Calculate new expiry date
                                  const currentExpiry = currentVM.expiry ? new Date(currentVM.expiry) : new Date()
                                  currentExpiry.setMonth(currentExpiry.getMonth() + renewalMonths)
                                  currentExpiry.setDate(currentExpiry.getDate() + renewalDays)
                                  const newExpiry = currentExpiry.toISOString()

                                  // Calculate new duration by adding renewal to existing
                                  const totalMonths = existingMonths + renewalMonths
                                  const totalDays = existingDays + renewalDays
                                  let newDurationString: string
                                  if (totalMonths > 0 && totalDays > 0) {
                                    newDurationString = `${totalMonths} month${totalMonths > 1 ? 's' : ''} ${totalDays} day${totalDays > 1 ? 's' : ''}`
                                  } else if (totalMonths > 0) {
                                    newDurationString = `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
                                  } else if (totalDays > 0) {
                                    newDurationString = `${totalDays} day${totalDays > 1 ? 's' : ''}`
                                  } else {
                                    newDurationString = String(t.duration || '12 months')
                                  }

                                  // Update VM expiry, end_date, and duration using store
                                  await updateVM(vmId, {
                                    expiry: newExpiry,
                                    end_date: newExpiry,
                                    duration: newDurationString
                                  })

                                  // Update add-on service expiry for this VM (only for this specific renewal request)
                                  await updateAddonExpiryForVM(vmId, renewalMonths, t.id)

                                  await updateVMRequest(t.id, { status: 'Completed' })
                                  toast('Renewal completed and VM expiry extended', 'ok')
                                } catch (error) {
                                  toast('Failed to update VM expiry', 'error')
                                }
                              }

                              // If no direct vm_id, try to find VM by hostname using store
                              else if (!vmId && t.hostname) {
                                try {
                                  const vmData = getVMByHostname(t.hostname)
                                  if (vmData) {
                                    vmId = vmData.id
                                  // Parse duration from string format - handles combined formats like "1 month 14 days"
                                  const parseDuration = (durationStr: string | number | null | undefined): { months: number; days: number } => {
                                    if (!durationStr) return { months: 0, days: 0 };
                                    if (typeof durationStr === 'number') {
                                      return { months: durationStr, days: 0 };
                                    }

                                    const str = String(durationStr).toLowerCase();
                                    let months = 0;
                                    let days = 0;

                                    // Match months
                                    const monthsMatch = str.match(/(\d+)\s*months?/);
                                    if (monthsMatch) {
                                      months = parseInt(monthsMatch[1], 10);
                                    }

                                    // Match days
                                    const daysMatch = str.match(/(\d+)\s*days?/);
                                    if (daysMatch) {
                                      days = parseInt(daysMatch[1], 10);
                                    }

                                    // If no match, try parsing as simple number (assume months)
                                    if (months === 0 && days === 0) {
                                      const num = parseInt(str, 10);
                                      if (!isNaN(num)) {
                                        months = num;
                                      }
                                    }

                                    return { months, days };
                                  };

                                  const parsedRenewalDuration = parseDuration(t.duration)
                                  const renewalMonths = parsedRenewalDuration.months
                                  const renewalDays = parsedRenewalDuration.days

                                  // Parse existing VM duration
                                  const parsedExistingDuration = parseDuration(vmData.duration)
                                  const existingMonths = parsedExistingDuration.months
                                  const existingDays = parsedExistingDuration.days

                                  // Calculate new expiry date
                                  const currentExpiry = vmData.expiry ? new Date(vmData.expiry) : new Date()
                                  currentExpiry.setMonth(currentExpiry.getMonth() + renewalMonths)
                                  currentExpiry.setDate(currentExpiry.getDate() + renewalDays)
                                  const newExpiry = currentExpiry.toISOString()

                                  // Calculate new duration by adding renewal to existing
                                  const totalMonths = existingMonths + renewalMonths
                                  const totalDays = existingDays + renewalDays
                                  let newDurationString: string
                                  if (totalMonths > 0 && totalDays > 0) {
                                    newDurationString = `${totalMonths} month${totalMonths > 1 ? 's' : ''} ${totalDays} day${totalDays > 1 ? 's' : ''}`
                                  } else if (totalMonths > 0) {
                                    newDurationString = `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
                                  } else if (totalDays > 0) {
                                    newDurationString = `${totalDays} day${totalDays > 1 ? 's' : ''}`
                                  } else {
                                    newDurationString = String(t.duration || '12 months')
                                  }

                                  // Update VM expiry, end_date, and duration using store
                                  try {
                                    await updateVM(vmId, {
                                      expiry: newExpiry,
                                      end_date: newExpiry,
                                      duration: newDurationString
                                    })

                                    // Update add-on service expiry for this VM (only for this specific renewal request)
                                    await updateAddonExpiryForVM(vmId, renewalMonths, t.id)

                                    await updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Renewal completed and VM expiry extended', 'ok')
                                  } catch (error) {
                                    toast('Failed to update VM expiry', 'error')
                                  }
                                }
                                } catch (error) {
                                  // Error finding VM by hostname
                                }
                              }

                              if (!vmId) {
                                await updateVMRequest(t.id, { status: 'Completed' })
                                toast('Renewal completed (could not find VM to extend expiry)', 'info')
                              }
                              setIsCompleting(false)
                            }} disabled={isCompleting}>
                              {isCompleting ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Complete & Extend Expiry</>}
                            </button>
                          )}
                        </>
                        ) : isTrialConversion ? (
                          <>
                            {active && i === 0 && t && (
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={async () => {
                                    setIsApproving(true)
                                    await updateVMRequest(t.id, { status: 'In Progress' })
                                    toast('Trial conversion approved and sent to Engineering', 'info')
                                    setIsApproving(false)
                                  }}
                                  disabled={!isPaymentReceived || isApproving}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  {isApproving ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Approve & send to Engineering</>}
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
                                setIsCompleting(true)
                                // Apply trial to paid conversion - update VM expiry
                                let vmId = (t as any).vm_id

                                // If vm_id exists, verify VM exists in store
                                if (vmId) {
                                  const currentVM = vms.find((v: any) => v.id === vmId)
                                  if (!currentVM) {
                                    await updateVMRequest(t.id, { status: 'Completed' })
                                    toast('Trial conversion completed (could not find VM to update)', 'info')
                                    setIsCompleting(false)
                                    return
                                  }
                                }

                                // If no direct vm_id, try to find VM by hostname using store
                                if (!vmId && t.hostname) {
                                  const vmData = getVMByHostname(t.hostname)
                                  if (vmData) {
                                    vmId = vmData.id
                                    // Parse conversion duration from string format
                                    const parseDuration = (durationStr: string | number | null | undefined): { months: number; days: number } => {
                                      if (!durationStr) return { months: 12, days: 0 };
                                      if (typeof durationStr === 'number') {
                                        return { months: durationStr, days: 0 };
                                      }

                                      const str = String(durationStr).toLowerCase();
                                      let months = 0;
                                      let days = 0;

                                      // Match months
                                      const monthsMatch = str.match(/(\d+)\s*months?/);
                                      if (monthsMatch) {
                                        months = parseInt(monthsMatch[1], 10);
                                      }

                                      // Match days
                                      const daysMatch = str.match(/(\d+)\s*days?/);
                                      if (daysMatch) {
                                        days = parseInt(daysMatch[1], 10);
                                      }

                                      // If no match, try parsing as simple number (assume months)
                                      if (months === 0 && days === 0) {
                                        const num = parseInt(str, 10);
                                        if (!isNaN(num)) {
                                          months = num;
                                        }
                                      }

                                      return { months, days };
                                    };

                                    const parsedDuration = parseDuration(t.duration)
                                    const paidMonths = parsedDuration.months || 12

                                    // Calculate new expiry date: trial start + 14 days + paid duration
                                    const startDate = vmData.created_at ? new Date(vmData.created_at) : new Date()
                                    const endDate = new Date(startDate)
                                    // Add 14 days for trial period
                                    endDate.setDate(endDate.getDate() + 14)
                                    // Add paid duration in months
                                    endDate.setMonth(endDate.getMonth() + paidMonths)
                                    endDate.setDate(endDate.getDate() + 1) // Add 1 day to expiry
                                    const newExpiry = endDate.toISOString()

                                    // Calculate total duration (14 days + paid months)
                                    const totalDays = 14 + (paidMonths * 30) // Approximate months to days
                                    // Format as "X months Y days" or just "X days"
                                    let durationString: string
                                    if (paidMonths > 0) {
                                      durationString = `${paidMonths} month${paidMonths > 1 ? 's' : ''} 14 days`
                                    } else {
                                      durationString = `${totalDays} days`
                                    }

                                    // Update VM expiry, duration, end_date, and request_type using store
                                    try {
                                      await updateVM(vmId, {
                                        expiry: newExpiry,
                                        duration: durationString,
                                        end_date: newExpiry, // For paid requests, end_date should match expiry
                                        request_type: 'paid' // Update VM request_type to paid
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

                                      // Log the trial to paid conversion
                                      await logActivity(
                                        `Converted trial VM ${vmData.hostname} to paid with ${durationString} duration`,
                                        'vm',
                                        'Engineer',
                                        {
                                          vmId: vmData.legacy_id || vmData.id,
                                          hostname: vmData.hostname,
                                          customerId: vmData.customer_id,
                                          duration: t.duration || 12,
                                          newExpiry: newExpiry
                                        }
                                      )

                                      await updateVMRequest(t.id, { status: 'Completed' })
                                      toast('Trial converted to paid successfully', 'ok')
                                    } catch (error) {
                                      toast('Failed to convert trial to paid', 'error')
                                      console.error('Error converting trial:', error)
                                    }
                                  }
                                }

                                if (!vmId) {
                                  await updateVMRequest(t.id, { status: 'Completed' })
                                  toast('Conversion completed (could not find VM to update)', 'info')
                                }
                                setIsCompleting(false)
                              }} disabled={isCompleting}>
                                {isCompleting ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Complete Conversion</>}
                              </button>
                            )}
                          </>
                        ) : requestType === 'vm' ? (
                          <>
                            {active && i === 0 && t && userRole !== 'Finance' && (
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={async () => {
                                    setIsProvisioning(true)
                                    await updateVMRequest(t.id, { status: 'Provisioning' })
                                    setIsProvisioning(false)
                                  }}
                                  disabled={!isPaymentReceived || isProvisioning}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  {isProvisioning ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Approve & send to Engineering</>}
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
                                disabled={!isPaymentReceived || (userRole === 'Sales' && i > 1) || isCompleting}
                                style={!isPaymentReceived || (userRole === 'Sales' && i > 1) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                onClick={async () => {
                                  setIsCompleting(true)
                                  const statusMap: Record<number, string> = {
                                    2: 'Network',
                                    3: 'Testing',
                                    4: 'Completed',
                                    5: 'Completed'
                                  }
                                  const newStatus = statusMap[i] || 'In Progress'
                                  await updateVMRequest(t.id, { status: newStatus })
                                  if (newStatus === 'Completed') {
                                    try {
                                      // Get VMs from store that match this request
                                      const matchingVMs = vms.filter(vm => vm.vm_request_id === t.id)

                                      if (matchingVMs.length > 0) {
                                        // Skip end_date update for trial requests (already set correctly in taskStore)
                                        if (t.request_type !== 'trial') {
                                          // Trigger handles start_date automatically, only update end_date here
                                          const startDate = matchingVMs[0].created_at ? new Date(matchingVMs[0].created_at) : new Date()
                                          const endDate = new Date(startDate)
                                          endDate.setMonth(endDate.getMonth() + (t.duration || 12))
                                          endDate.setDate(endDate.getDate() + 1) // Add 1 day to expiry

                                          // Update all VMs associated with this request - only set end_date
                                          for (const vm of matchingVMs) {
                                            await updateVM(vm.id, {
                                              end_date: endDate.toISOString()
                                            })
                                          }
                                        }
                                      } else {
                                        // No VMs found for request
                                      }
                                    } catch (error: any) {
                                      console.error('Error in provisioning completion:', error)
                                      toast('Error: ' + error.message, 'error')
                                    }
                                    toast(`${t?.hostname || 'VM'} provisioning completed`, 'ok')
                                  }
                                  setIsCompleting(false)


                                }}
                              >
                                {isCompleting ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />
                                {i === WF.length - 1 || i === 4 ? 'Complete' : `Mark done → ${WF[i + 1].team}`}</>}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {active && i === 0 && userRole !== 'Finance' && (
                              <>
                                <button 
                                  className="btn sm accent mt-2" 
                                  onClick={async () => {
                                    setIsProvisioning(true)
                                    await updateAddonRequest(request.id, { status: 'In Progress' })
                                    toast('Add-on provisioning started', 'info')
                                    setIsProvisioning(false)
                                  }}
                                  disabled={!isPaymentReceived || isProvisioning}
                                  style={!isPaymentReceived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  {isProvisioning ? <CircularSpinner size={11} /> : <><Icon name="play" size={11} />Start provisioning</>}
                                </button>
                                {!isPaymentReceived && (
                                  <div className="text-xs text-mute mt-1" style={{ color: 'var(--bad)' }}>
                                    Payment must be received before starting provisioning
                                  </div>
                                )}
                              </>
                            )}
                            {active && i === 2 && userRole !== 'Sales' && userRole !== 'Finance' && (
                              <button className="btn sm ok mt-2" onClick={async () => {
                                setIsCompleting(true)
                                // Update addon service with duration, end_date, and expiry from addon request
                                const vmId = (request as any).vm_id
                                if (vmId) {
                                  try {
                                    // Parse addon request duration
                                    let durationMonths = 0
                                    let durationDays = 0
                                    if (request.duration) {
                                      const durationStr = String(request.duration)
                                      const monthsMatch = durationStr.match(/(\d+)\s*months?/i)
                                      const daysMatch = durationStr.match(/(\d+)\s*days?/i)
                                      if (monthsMatch) durationMonths = parseInt(monthsMatch[1])
                                      if (daysMatch) durationDays = parseInt(daysMatch[1])
                                    }

                                    // Calculate new expiry from start date (for addon requests only)
                                    const startDate = (request as any).start_date ? new Date((request as any).start_date) : new Date()
                                    const newExpiry = new Date(startDate)
                                    newExpiry.setMonth(newExpiry.getMonth() + durationMonths)
                                    newExpiry.setDate(newExpiry.getDate() + durationDays)
                                    newExpiry.setDate(newExpiry.getDate() + 1) // Add 1 day to expiry

                                    // Build duration string
                                    const monthText = durationMonths > 0 ? `${durationMonths} month${durationMonths > 1 ? 's' : ''}` : ''
                                    const dayText = durationDays > 0 ? `${durationDays} day${durationDays > 1 ? 's' : ''}` : ''
                                    let durationString: string
                                    if (monthText && dayText) {
                                      durationString = `${monthText} ${dayText}`
                                    } else if (monthText) {
                                      durationString = monthText
                                    } else if (dayText) {
                                      durationString = dayText
                                    } else {
                                      durationString = '0 days'
                                    }

                                    // Check if addon service exists
                                    const { data: existingService } = await supabase
                                      .from('addon_services')
                                      .select('*')
                                      .eq('vm_id', vmId)
                                      .neq('operational_status', 'Terminated')
                                      .order('created_at', { ascending: false })
                                      .limit(1)
                                      .maybeSingle()

                                    if (existingService) {
                                      // Update existing addon service - only update services, preserve existing dates
                                      await supabase
                                        .from('addon_services')
                                        .update({
                                          cpfs_enabled: (request as any).cpfs_enabled || existingService.cpfs_enabled,
                                          cpfs_package: (request as any).cpfs_enabled ? (request as any).cpfs_package : existingService.cpfs_package,
                                          ccis_enabled: (request as any).ccis_enabled || existingService.ccis_enabled,
                                          ccis_package: (request as any).ccis_enabled ? (request as any).ccis_package : existingService.ccis_package,
                                        })
                                        .eq('id', existingService.id)
                                    } else {
                                      // Create new addon service
                                      await supabase
                                        .from('addon_services')
                                        .insert({
                                          vm_id: vmId,
                                          cpfs_enabled: (request as any).cpfs_enabled,
                                          cpfs_package: (request as any).cpfs_package,
                                          ccis_enabled: (request as any).ccis_enabled,
                                          ccis_package: (request as any).ccis_package,
                                          duration: durationString,
                                          start_date: (request as any).start_date,
                                          end_date: newExpiry.toISOString(),
                                          expiry: newExpiry.toISOString()
                                        })
                                    }
                                  } catch (error) {
                                    console.error('Error updating addon service:', error)
                                    toast('Failed to update addon service', 'error')
                                  }
                                }

                                await updateAddonRequest(request.id, { status: 'Completed' })
                                toast('Add-on provisioning completed', 'ok')
                                setIsCompleting(false)
                              }} disabled={isCompleting}>
                                {isCompleting ? <CircularSpinner size={11} /> : <><Icon name="check" size={11} />Complete</>}
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
                  {isRenewal ? (
                    <>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>VM Renewal Details</div>
                      <dl className="dl">
                        <dt>Hostname</dt><dd className="mono">{t?.hostname}</dd>
                        {currentVMData && (
                          <>
                            <dt>VM ID</dt><dd className="mono">{currentVMData.legacy_id || currentVMData.id}</dd>
                          </>
                        )}
                        <dt>Billing Term</dt><dd className="mono">{formatDuration(t?.duration)}</dd>
                        {t?.notes && <><dt>Notes</dt><dd>{t?.notes}</dd></>}
                      </dl>

                      {currentVMData && (
                        <>
                          <div className="divider" />
                          <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Add-on Services</div>
                          {(() => {
                            // For renewal requests, show addon request instead of existing addon services
                            if (isRenewal) {
                              const renewalAddonRequests = addonRequests.filter((ar: any) => 
                                ar.related_entity_id === t?.id && ar.related_entity_type === 'vm_request'
                              )
                              if (renewalAddonRequests.length === 0) {
                                return <div className="text-sm text-mute">No add-on services selected for renewal</div>
                              }
                              return renewalAddonRequests.map((ar: any) => (
                                <div key={ar.id} style={{ marginBottom: 8 }}>
                                  <dl className="dl">
                                    <dt>Request ID</dt><dd className="mono">{ar.legacy_id || ar.id}</dd>
                                    <dt>Services</dt><dd>
                                      <div className="flex gap-1">
                                        {ar.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                                        {ar.ccis_enabled && <span className="pill subtle">CCIS</span>}
                                      </div>
                                    </dd>
                                    <dt>Billing Term</dt><dd className="mono">{formatDuration(ar.duration)}</dd>
                                  </dl>
                                </div>
                              ))
                            } else {
                              // For non-renewal, show existing addon services
                              const addonServices = getAddonServicesForVM(currentVMData.id)
                              if (addonServices.length === 0) {
                                return <div className="text-sm text-mute">No active add-on services for this VM</div>
                              }
                              return addonServices.map((as: any) => (
                                <div key={as.id} style={{ marginBottom: 8 }}>
                                  <dl className="dl">
                                    <dt>Service ID</dt><dd className="mono">{as.legacy_id || as.id}</dd>
                                    <dt>Services</dt><dd>
                                      <div className="flex gap-1">
                                        {as.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                                        {as.ccis_enabled && <span className="pill subtle">CCIS</span>}
                                      </div>
                                    </dd>
                                    <dt>Billing Term</dt><dd className="mono">{formatDuration(as.duration)}</dd>
                                  </dl>
                                </div>
                              ))
                            }
                          })()}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>VM Configuration</div>
                      <div className="grid-2" style={{ gap: 16 }}>
                        <div>
                          <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>General</div>
                          <dl className="dl">
                            <dt>Request ID</dt><dd className="mono">{t?.legacy_id || t?.id}</dd>
                            {isUpgrade && currentVMData && (
                              <>
                                <dt>VM ID</dt><dd className="mono">{currentVMData.legacy_id || currentVMData.id}</dd>
                              </>
                            )}
                            <dt>Hostname</dt><dd className="mono">{t?.hostname}</dd>
                            <dt>Purpose</dt><dd>{t?.purpose || '—'}</dd>
                            <dt>Quantity</dt><dd className="mono">{t?.qty}</dd>
                            {t?.duration && <><dt>Billing Term</dt><dd className="mono">{formatDuration(t?.duration)}</dd></>}
                            <dt>Spec Type</dt><dd className="mono" style={{ color: t?.sizing === 'Standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{t?.sizing}</dd>
                            <dt>OS</dt><dd className="mono">{t?.os_name} {t?.os_version}</dd>
                          </dl>

                          {!isUpgrade || isSpecChange ? (
                            <>
                              <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Compute</div>
                              <dl className="dl">
                                <dt>vCPU</dt><dd className="mono">
                                  {isUpgrade && currentVMData ? (
                                    <>
                                      {currentVMData.vcpu} cores <span style={{ color: 'var(--accent-strong)', margin: '0 4px' }}>→</span> <span style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{t?.vcpu} cores</span>
                                    </>
                                  ) : (
                                    `${t?.vcpu} cores`
                                  )}
                                </dd>
                                <dt>Memory</dt><dd className="mono">
                                  {isUpgrade && currentVMData ? (
                                    <>
                                      {currentVMData.ram_gb} GB <span style={{ color: 'var(--accent-strong)', margin: '0 4px' }}>→</span> <span style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{t?.ram_gb} GB</span>
                                    </>
                                  ) : (
                                    `${t?.ram_gb} GB`
                                  )}
                                </dd>
                                <dt>Storage</dt><dd className="mono">
                                  {isUpgrade && currentVMData ? (
                                    <>
                                      {currentVMData.storage_gb} GB <span style={{ color: 'var(--accent-strong)', margin: '0 4px' }}>→</span> <span style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{t?.storage} GB</span>
                                    </>
                                  ) : (
                                    `${t?.storage} GB`
                                  )}
                                </dd>
                              </dl>
                            </>
                          ) : null}
                        </div>

                        <div>
                          <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Network</div>
                          <dl className="dl">
                            <dt>Zone</dt><dd className="mono">{t?.zone}</dd>
                            <dt>Public IP</dt><dd className="mono">{t?.public_ip_required ? 'Yes' : 'No'}</dd>
                            {t?.nics && t.nics.length > 0 && (
                              <>
                                <dt>NICs</dt>
                                <dd className="mono">{t.nics.map((n: any) => n.description ? `${n.label} (${n.description})` : n.label).join(', ')}</dd>
                              </>
                            )}
                            {t?.firewall_ports && t.firewall_ports.length > 0 && (
                              <>
                                <dt>Firewall Ports (Inbound)</dt>
                                <dd className="mono">{t.firewall_ports.join(', ')}</dd>
                              </>
                            )}
                            <>
                              <dt>Outbound Firewall</dt>
                              <dd className="mono">
                                {t?.firewall_outbound_allow_all ? 'Allow All' : 'Custom'}
                                {t?.firewall_outbound_allow_all
                                  ? ` (${t?.firewall_ports?.join(', ') || 'none'})`
                                  : ` (${t?.firewall_outbound_custom_ports?.join(', ') || 'none'})`}
                              </dd>
                            </>
                          </dl>

                          {t?.storage_partitions && (
                            <>
                              <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Storage</div>
                              <dl className="dl">
                                <dt>Storage Partitions</dt>
                                <dd className="mono">{t.storage_partitions}</dd>
                              </dl>
                            </>
                          )}

                          {(!isUpgrade || isBackupChange) && (
                            <>
                              <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Backup</div>
                              <dl className="dl">
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
                              </dl>
                            </>
                          )}

                          {t?.notes && (
                            <>
                              <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes</div>
                              <dl className="dl">
                                <dt>Notes</dt><dd>{t?.notes}</dd>
                              </dl>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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
                    {(request as any)?.duration && <><dt>Duration</dt><dd className="mono">{formatDuration((request as any)?.duration)}</dd></>}
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
                  try {
                    await createVMManually(t.id, details, addVM)
                    updateVMRequest(t.id, { status: 'Network' })
                    setShowVMFormModal(false)
                    toast('VM records created successfully', 'ok')
                  } catch (error: any) {
                    console.error('Error creating VM records:', error)
                    console.error('Error stack:', error.stack)
                    console.error('Full error details:', JSON.stringify(error, null, 2))

                    // Parse database errors to user-friendly messages
                    let userMessage = 'Unknown error'
                    if (error.message) {
                      if (error.message.includes('duplicate key value violates unique constraint "vms_legacy_id_key"')) {
                        userMessage = 'Legacy ID already exists. Please use a different Legacy ID.'
                      } else if (error.message.includes('duplicate key value violates unique constraint "vms_hostname_unique"')) {
                        userMessage = 'Hostname already exists. Please use a different hostname.'
                      } else if (error.message.includes('duplicate key value violates unique constraint "vms_hostname_key"')) {
                        userMessage = 'Hostname already exists. Please use a different hostname.'
                      } else if (error.message.includes('duplicate key value violates unique constraint')) {
                        // Try to extract the constraint name
                        const constraintMatch = error.message.match(/unique constraint "([^"]+)"/)
                        if (constraintMatch) {
                          userMessage = `Duplicate record detected: ${constraintMatch[1]}. Please check your inputs.`
                        } else {
                          userMessage = 'Duplicate record detected. Please check your inputs.'
                        }
                      } else if (error.message.includes('is already in use')) {
                        userMessage = error.message
                      } else {
                        userMessage = error.message
                      }
                    }

                    toast('Failed to create VM records: ' + userMessage, 'error')
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
