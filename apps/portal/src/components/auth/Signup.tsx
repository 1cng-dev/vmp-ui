// Signup multi-step flow: Account → Personal/Org info → KYC → Payment method → Success

import React, { useState } from 'react'
import useAuthStore from '../../store/authStore'
import Icon from '../../lib/icons'
import { SignupStepAccount } from './steps/SignupStepAccount'
import { SignupStepIndividual } from './steps/SignupStepIndividual'
import { SignupStepOrganization } from './steps/SignupStepOrganization'
import { SignupStepAddress } from './steps/SignupStepAddress'
import { SignupStepKYC } from './steps/SignupStepKYC'
import { SignupStepPayment } from './steps/SignupStepPayment'

interface SignupFormState {
  name: string
  email: string
  password: string
  confirmPassword: string
  type: 'Individual' | 'Organization'
  phone: string
  altPhone: string
  preferredContactMethod: 'Email' | 'Phone call' | 'WhatsApp' | 'Viber'
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  orgName: string
  orgRegNo: string
  orgType: string
  orgIndustry: string
  orgRepTitle: string
  orgEmployees: string
  orgWebsite: string
  nrcOrId: string
  nrcFrontFile: File | null
  nrcBackFile: File | null
  orgCertFile: File | null
  orgTaxIdFile: File | null
  dirIdFile: File | null
  paymentMethod: string
  payerName: string
  payerPhone: string
  agreedToTerms: boolean
}

const SignupScreen: React.FC<{ onComplete: (email: string) => void; onSwitchToLogin: () => void }> = ({ onComplete, onSwitchToLogin }) => {
  const { signUp } = useAuthStore()
  const [step, setStep] = useState(1)
  const [f, setF] = useState<SignupFormState>({
    name: '', email: '', password: '', confirmPassword: '',
    type: 'Individual',
    phone: '', altPhone: '',
    preferredContactMethod: 'Email',
    address: '', city: 'Yangon', state: 'Yangon Region', postalCode: '11181', country: 'Myanmar',
    orgName: '', orgRegNo: '', orgType: 'Private Limited', orgIndustry: 'Technology',
    orgRepTitle: '', orgEmployees: '1-10', orgWebsite: '',
    nrcOrId: '', nrcFrontFile: null, nrcBackFile: null,
    orgCertFile: null, orgTaxIdFile: null, dirIdFile: null,
    paymentMethod: 'KBZ Pay', payerName: '', payerPhone: '',
    agreedToTerms: false,
  })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: any) => { setF(x => ({ ...x, [k]: v })); setErr('') }

  const totalSteps = 5
  const stepLabels = ['Account', f.type === 'Individual' ? 'Personal info' : 'Organization', 'Address', 'KYC', 'Payment']

  const validateStep1 = () => {
    if (!f.name.trim()) return 'Enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return 'Enter a valid email'
    if (f.password.length < 8) return 'Password must be at least 8 characters'
    if (f.password !== f.confirmPassword) return 'Passwords do not match'
    return null
  }
  const validateStep2 = () => {
    if (!f.phone.trim()) return 'Enter your phone number'
    if (f.type === 'Organization') {
      if (!f.orgName.trim()) return 'Enter organization name'
      if (!f.orgRegNo.trim()) return 'Enter organization registration number'
    }
    return null
  }
  const validateStep3 = () => f.address.trim() ? null : 'Enter your address'
  const validateStep4 = () => {
    if (!f.nrcOrId.trim()) return f.type === 'Individual' ? 'Enter your NRC / ID number' : 'Enter representative\'s NRC / ID'
    if (!f.nrcFrontFile || !f.nrcBackFile) return 'Upload both sides of your ID'
    if (f.type === 'Organization') {
      if (!f.orgCertFile) return 'Upload company registration certificate'
      if (!f.orgTaxIdFile) return 'Upload tax registration document'
    }
    return null
  }
  const validators: Array<(() => string | null) | null> = [null, validateStep1, validateStep2, validateStep3, validateStep4, () => f.agreedToTerms ? null : 'You must accept the terms to continue']

  const next = async () => {
    const v = validators[step]?.()
    if (v) { setErr(v); return }
    if (step < totalSteps) setStep(step + 1)
    else await submit()
  }

  const submit = async () => {
    setLoading(true)
    setErr('')
    
    const result = await signUp({
      email: f.email,
      password: f.password,
      name: f.name,
      type: f.type,
      phone: f.phone,
      customerData: {
        email: f.email,
        account_type: f.type,
        name: f.name,
        phone: f.phone,
        alt_phone: f.altPhone,
        preferred_contact_method: f.preferredContactMethod,
        address: f.address,
        city: f.city,
        state: f.state,
        postal_code: f.postalCode,
        country: f.country,
        org_name: f.type === 'Organization' ? f.orgName : undefined,
        org_reg_no: f.type === 'Organization' ? f.orgRegNo : undefined,
        org_type: f.type === 'Organization' ? f.orgType : undefined,
        org_industry: f.type === 'Organization' ? f.orgIndustry : undefined,
        org_rep_title: f.type === 'Organization' ? f.orgRepTitle : undefined,
        org_employees: f.type === 'Organization' ? f.orgEmployees : undefined,
        org_website: f.type === 'Organization' ? f.orgWebsite : undefined,
        nrc_or_id: f.nrcOrId,
        kyc_status: 'Pending',
        payment_method: f.paymentMethod as 'KBZ Pay' | 'AYA Bank' | 'CB Bank' | 'Yoma Bank',
        payer_name: f.payerName,
        payer_phone: f.payerPhone,
        status: 'Active',
        agreed_to_terms: f.agreedToTerms,
        nrcFrontFile: f.nrcFrontFile,
        nrcBackFile: f.nrcBackFile,
        orgCertFile: f.orgCertFile,
        orgTaxIdFile: f.orgTaxIdFile,
        dirIdFile: f.dirIdFile,
      }
    })
    
    if (!result.success) {
      setErr(result.error || 'Failed to create account')
      setLoading(false)
      return
    }
    
    setLoading(false)
    onComplete(f.email)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid var(--line)', background: 'var(--surface)',
        padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div className="flex center gap-3">
          <div className="brand-mark" style={{ width: 32, height: 32, fontSize: 14, borderRadius: 7 }}>V</div>
          <div>
            <div className="fw-7 text-sm">VPS Myanmar</div>
            <div className="text-xs text-mute" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cloud infrastructure</div>
          </div>
        </div>
        <div style={{ flex: 1 }}/>
        <div className="text-sm text-mute">Already have an account?</div>
        <button className="btn" onClick={onSwitchToLogin}><Icon name="logout" size={12}/>Sign in</button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 360px', gap: 0, overflow: 'hidden' }}>
        {/* Left: stepper with gradient hero */}
        <div style={{ borderRight: '1px solid var(--line)', background: 'linear-gradient(180deg, var(--surface-2), var(--surface))', padding: '32px 24px', overflowY: 'auto', position: 'relative' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent), oklch(0.55 0.18 285))',
            borderRadius: 14, padding: '20px 18px', color: 'white', marginBottom: 24,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }}/>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Icon name="server" size={20}/>
              <h1 style={{ margin: '10px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Create your account</h1>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, opacity: 0.9, lineHeight: 1.5 }}>5 quick steps to start deploying cloud VMs in Myanmar.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stepLabels.map((label, i) => {
              const n = i + 1
              const done = n < step
              const active = n === step
              return (
                <div key={label} style={{ position: 'relative' }}>
                  <div
                    onClick={() => n < step && setStep(n)}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'center',
                      padding: '10px 12px', borderRadius: 8,
                      background: active ? 'var(--surface)' : 'transparent',
                      border: active ? '1px solid var(--accent)' : '1px solid transparent',
                      cursor: n < step ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: done ? 'var(--accent)' : active ? 'var(--accent-soft)' : 'var(--surface-3)',
                      color: done ? 'var(--accent-fg)' : active ? 'var(--accent-strong)' : 'var(--ink-3)',
                      display: 'grid', placeItems: 'center',
                      fontWeight: 700, fontSize: 12, flexShrink: 0,
                      transition: 'all 0.25s',
                    }}>{done ? <Icon name="check" size={13}/> : n}</div>
                    <div>
                      <div className="fw-6 text-sm" style={{ color: active ? 'var(--ink)' : done ? 'var(--ink-2)' : 'var(--ink-3)' }}>{label}</div>
                      <div className="text-xs text-mute">{done ? 'Completed' : active ? 'In progress' : 'Pending'}</div>
                    </div>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div style={{ position: 'absolute', left: 26, top: 48, width: 1, height: 16, background: n < step ? 'var(--accent)' : 'var(--line)' }}/>
                  )}
                </div>
              )
            })}
          </div>

          <div className="divider"/>
          <div className="text-xs text-mute" style={{ lineHeight: 1.6 }}>
            <div className="fw-6 mb-1" style={{ color: 'var(--ink-2)' }}>Need help?</div>
            Contact us at <span className="mono">support@vpsmm.co</span> or visit our docs.
          </div>
        </div>

        {/* Middle: form */}
        <div style={{ overflowY: 'auto', padding: '40px 56px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="flex center between mb-3">
              <div>
                <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Step {step} of {totalSteps}</div>
                <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{stepLabels[step-1]}</h2>
              </div>
              <div className="text-xs text-mute tnum">{Math.round((step / totalSteps) * 100)}% complete</div>
            </div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
              <div style={{ width: `${(step / totalSteps) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s' }}/>
            </div>

            {err && (
              <div style={{ padding: '12px 14px', background: 'var(--bad-soft)', color: 'var(--bad)', borderRadius: 8, fontSize: 12.5, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="alert" size={14} style={{ marginTop: 1, flexShrink: 0 }}/>
                <div>{err}</div>
              </div>
            )}

            <div className="card" style={{ animation: 'fadeIn 0.25s ease-out' }}>
              <div className="card-body" style={{ padding: 28 }}>
                {step === 1 && <SignupStepAccount f={f} set={set}/>}
                {step === 2 && (f.type === 'Individual' ? <SignupStepIndividual f={f} set={set}/> : <SignupStepOrganization f={f} set={set}/>)}
                {step === 3 && <SignupStepAddress f={f} set={set}/>}
                {step === 4 && <SignupStepKYC f={f} set={set}/>}
                {step === 5 && <SignupStepPayment f={f} set={set}/>}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}><Icon name="chevron-left" size={11}/>Back</button>}
              <div style={{ flex: 1 }}/>
              <button className="btn ghost" onClick={onSwitchToLogin}>Cancel</button>
              <button className="btn primary" onClick={next} disabled={loading} style={{ padding: '9px 18px', fontSize: 13 }}>
                {loading ? 'Creating account...' : step < totalSteps ? <>Continue<Icon name="chevron-right" size={11}/></> : <><Icon name="check" size={12}/>Create account</>}
              </button>
            </div>
          </div>
        </div>

        {/* Right: summary panel (IaaS-style cart) */}
        <div style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface)', padding: '32px 24px', overflowY: 'auto' }}>
          <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Account summary</div>
          <div className="flex col gap-2 text-sm">
            <div className="flex between"><span className="text-mute">Type</span><span className="fw-6">{f.type}</span></div>
            <div className="flex between"><span className="text-mute">Name</span><span className="fw-6" style={{ textAlign: 'right', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || <span className="text-mute">—</span>}</span></div>
            <div className="flex between"><span className="text-mute">Email</span><span className="fw-6 mono" style={{ textAlign: 'right', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email || <span className="text-mute">—</span>}</span></div>
            {f.type === 'Organization' && f.orgName && (
              <div className="flex between"><span className="text-mute">Company</span><span className="fw-6" style={{ textAlign: 'right', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.orgName}</span></div>
            )}
            {f.phone && <div className="flex between"><span className="text-mute">Phone</span><span className="fw-6 mono">{f.phone}</span></div>}
            {f.city && <div className="flex between"><span className="text-mute">City</span><span className="fw-6">{f.city}</span></div>}
            {f.nrcOrId && <div className="flex between"><span className="text-mute">ID #</span><span className="fw-6 mono" style={{ fontSize: 11 }}>{f.nrcOrId}</span></div>}
            {f.paymentMethod && step === 5 && <div className="flex between"><span className="text-mute">Payment</span><span className="fw-6">{f.paymentMethod}</span></div>}
          </div>

          <div className="divider"/>
          <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>What you'll get</div>
          <div className="flex col gap-2 text-xs">
            {[
              ['shield', 'KYC-verified account'],
              ['server', 'Deploy VMs in 24h'],
              ['invoice', 'Pay in MMK (KBZ/AYA/CB/Yoma)'],
              ['mail', 'Local support 9am-6pm'],
            ].map(([icon, text]) => (
              <div key={text} className="flex center gap-2">
                <Icon name={icon} size={12} style={{ color: 'var(--accent-strong)' }}/>
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="divider"/>
          <div style={{ padding: 12, background: 'var(--ok-soft)', borderRadius: 8, fontSize: 11.5, color: 'var(--ok)', display: 'flex', gap: 8 }}>
            <Icon name="lock" size={12} style={{ marginTop: 2, flexShrink: 0 }}/>
            <div>Your data is encrypted and used solely for account verification.</div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

export { SignupScreen }
