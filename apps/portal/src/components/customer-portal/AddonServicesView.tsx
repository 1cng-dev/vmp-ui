import React, { useState } from 'react'
import Icon from '../../lib/icons'
import { IaaSCard } from './VMHelperComponents'
import { useAddonRequests } from '../../store/addonRequestStore'
import useUIStore from '../../store/uiStore'

interface AddonServicesViewProps {
  myVMs: any[]
}

export const AddonServicesView: React.FC<AddonServicesViewProps> = ({ myVMs }) => {
  const { createAddonRequest } = useAddonRequests()
  const { toast } = useUIStore()
  const [selectedVM, setSelectedVM] = useState<string>('')
  const [cpfsEnabled, setCpfsEnabled] = useState(false)
  const [cpfsPackage, setCpfsPackage] = useState<'standard' | 'premium'>('standard')
  const [ccisEnabled, setCcisEnabled] = useState(false)
  const [ccisPlan, setCcisPlan] = useState<'basic' | 'standard' | 'professional' | 'enterprise' | undefined>(undefined)
  const [duration, setDuration] = useState<number>(12)
  const [customDuration, setCustomDuration] = useState('')
  const [isCustomDuration, setIsCustomDuration] = useState(false)

  const getDurationLabel = (months: number) => {
    const labels: Record<number, string> = {
      1: 'Monthly',
      3: 'Quarterly',
      6: 'Half Yearly',
      12: 'Yearly'
    }
    return labels[months] || `${months} month${months > 1 ? 's' : ''}`
  }

  const canSubmit = () => !!selectedVM && (cpfsEnabled || ccisEnabled)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Add-on Services</h1>
          <p className="page-subtitle">Enhance your VM with additional security and performance services</p>
        </div>
      </div>

      {/* VM Selection */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3 className="card-title">Select VM</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {myVMs.map((vm: any) => (
              <IaaSCard key={vm.id} selected={selectedVM === vm.id} onClick={() => setSelectedVM(vm.id)} padding={14 as any}>
                <div className="flex center between mb-2">
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    <Icon name="server" size={18}/>
                  </div>
                  {selectedVM === vm.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                </div>
                <div className="fw-7 text-sm">{vm.hostname}</div>
                <div className="text-xs text-mute mono">{vm.legacy_id || vm.id}</div>
                <div className="text-xs mt-2"><span className="text-mute">Status:</span> <span className={`fw-6 ${vm.status === 'Active' ? 'text-ok' : 'text-mute'}`}>{vm.status}</span></div>
              </IaaSCard>
            ))}
          </div>
        </div>
      </div>

      {/* Duration Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3 className="card-title">Billing Term</h3></div>
        <div className="card-body">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Billing Term</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[1, 3, 6, 12].map(months => (
                <button
                  key={months}
                  className={`filter-chip ${!isCustomDuration && duration === months ? 'active' : ''}`}
                  onClick={() => { setDuration(months); setIsCustomDuration(false) }}
                >
                  {getDurationLabel(months)}
                </button>
              ))}
              <button
                className={`filter-chip ${isCustomDuration ? 'active' : ''}`}
                onClick={() => setIsCustomDuration(true)}
              >
                <Icon name="plus" size={11} /> Custom
              </button>
            </div>

            {isCustomDuration && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="number"
                  value={customDuration}
                  onChange={e => { setCustomDuration(e.target.value); setDuration(parseInt(e.target.value) || 1) }}
                  placeholder="Enter months"
                  min="1"
                  style={{ width: 120, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CPFS Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="card-title">CPFS (Cloud Protection Firewall Service)</h3>
          <span className={`toggle ${cpfsEnabled ? 'on' : ''}`} onClick={() => setCpfsEnabled(!cpfsEnabled)}/>
        </div>
        {cpfsEnabled && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 12 }}>
              {/* Standard Package */}
              <IaaSCard selected={cpfsPackage === 'standard'} onClick={() => setCpfsPackage('standard')} padding={16 as any}>
                <div className="flex center between mb-2">
                  <h4 className="fw-6">CPFS - Standard Package</h4>
                  {cpfsPackage === 'standard' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>
                  <li>1000 concurrent sessions per second</li>
                  <li>Weekly Report</li>
                </ul>
              </IaaSCard>

              {/* Premium Package */}
              <IaaSCard selected={cpfsPackage === 'premium'} onClick={() => setCpfsPackage('premium')} padding={16 as any}>
                <div className="flex center between mb-2">
                  <h4 className="fw-6">CPFS - Premium Package</h4>
                  {cpfsPackage === 'premium' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>
                  <li>1500 concurrent sessions per second</li>
                  <li>Weekly Report</li>
                </ul>
              </IaaSCard>
            </div>
          </div>
        )}
      </div>

      {/* CCIS Section */}
      <div className="card">
        <div className="card-head">
          <h3 className="card-title">CCIS (Cloud Content Inspection Service)</h3>
          <span className={`toggle ${ccisEnabled ? 'on' : ''}`} onClick={() => setCcisEnabled(!ccisEnabled)}/>
        </div>
        {ccisEnabled && (
          <div className="card-body">
            <div className="grid-4" style={{ gap: 12 }}>
              {[
                { id: 'basic', name: 'Basic Plan', mb: '100 MB' },
                { id: 'standard', name: 'Standard Plan', mb: '500 MB' },
                { id: 'professional', name: 'Professional Plan', mb: '1 GB' },
                { id: 'enterprise', name: 'Enterprise Plan', mb: '5 GB' },
              ].map((plan) => (
                <IaaSCard key={plan.id} selected={ccisPlan === plan.id} onClick={() => setCcisPlan(plan.id as 'basic' | 'standard' | 'professional' | 'enterprise')} padding={16 as any}>
                  <div className="flex center between mb-2">
                    <div className="fw-6 text-sm">{plan.name}</div>
                    {ccisPlan === plan.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                  </div>
                  <div className="text-mute text-xs">{plan.mb}</div>
                </IaaSCard>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex center" style={{ gap: 10, paddingTop: 8, marginTop: 24 }}>
        <div style={{ flex: 1 }}/>
        <button className="btn accent" onClick={async () => {
          try {
            console.log('Submitting add-on request:', { selectedVM, cpfsEnabled, cpfsPackage, ccisEnabled, ccisPlan, duration })
            const vm = myVMs.find((v: any) => v.id === selectedVM)
            console.log('Selected VM:', vm)
            console.log('Customer ID from VM:', vm?.customer_id)
            
            const addonRequest = {
              customer_id: vm?.customer_id,
              vm_id: selectedVM,
              cpfs_enabled: cpfsEnabled,
              cpfs_package: cpfsEnabled ? cpfsPackage : undefined,
              ccis_enabled: ccisEnabled,
              ccis_package: ccisEnabled ? ccisPlan : undefined,
              duration: duration,
              status: 'Pending' as 'Pending',
            }
            console.log('Add-on request data:', addonRequest)
            await createAddonRequest(addonRequest)
            
            toast('Add-on request submitted successfully', 'ok')
            setSelectedVM('')
            setCpfsEnabled(false)
            setCcisEnabled(false)
            setDuration(12)
            setCustomDuration('')
            setIsCustomDuration(false)
          } catch (error: any) {
            console.error('Error submitting add-on request:', error)
            console.error('Error details:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            })
            toast('Failed to submit add-on request: ' + (error.message || 'Unknown error'), 'error')
          }
        }} disabled={!canSubmit()} style={{ padding: '10px 18px', fontSize: 13 }}><Icon name="check" size={13}/>Submit add-on request</button>
      </div>
    </div>
  )
}
