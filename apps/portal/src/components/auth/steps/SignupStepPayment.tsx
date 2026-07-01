import React from 'react'
import Icon from '../../../lib/icons'
import { IaaSCard } from '../shared/IaaSCard'

interface SignupFormState {
  paymentMethod: string
  payerName: string
  payerPhone: string
  agreedToTerms: boolean
  name: string
  phone: string
}

interface SignupStepPaymentProps {
  f: SignupFormState
  set: (k: string, v: any) => void
}

const SignupStepPayment: React.FC<SignupStepPaymentProps> = ({ f, set }) => (
  <div className="flex col gap-3">
    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preferred payment method</div>
    <div className="text-xs text-mute" style={{ marginTop: -4 }}>You won't be charged now — you'll select & pay when you deploy your first VM.</div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {[
        { id: 'KBZ Pay', logo: 'K', accent: 'oklch(0.55 0.18 30)', desc: 'Mobile wallet · QR scan' },
        { id: 'AYA Bank', logo: 'A', accent: 'oklch(0.55 0.16 230)', desc: 'Direct bank transfer' },
        { id: 'CB Bank', logo: 'C', accent: 'oklch(0.55 0.17 285)', desc: 'Direct bank transfer' },
        { id: 'Yoma Bank', logo: 'Y', accent: 'oklch(0.55 0.15 155)', desc: 'Direct bank transfer' },
      ].map(p => (
        <IaaSCard key={p.id} selected={f.paymentMethod === p.id} onClick={() => set('paymentMethod', p.id)} padding={14}>
          <div className="flex center gap-2">
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${p.accent}1a`, color: p.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15 }}>{p.logo}</div>
            <div style={{ flex: 1 }}>
              <div className="fw-7 text-sm">{p.id}</div>
              <div className="text-xs text-mute">{p.desc}</div>
            </div>
            {f.paymentMethod === p.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }} />}
          </div>
        </IaaSCard>
      ))}
    </div>

    <div className="grid-2 mt-2" style={{ gap: 10 }}>
      <div className="field"><label>Payer name (on account)</label><input value={f.payerName} onChange={e => set('payerName', e.target.value)} placeholder={f.name || 'Account holder'} /></div>
      <div className="field"><label>Payer phone</label><input value={f.payerPhone} onChange={e => set('payerPhone', e.target.value)} placeholder={f.phone || '+95 9 ...'} style={{ fontFamily: 'var(--mono)' }} /></div>
    </div>

    <div className="divider" />
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="checkbox" checked={f.agreedToTerms} onChange={e => set('agreedToTerms', e.target.checked)} style={{ marginTop: 3 }} />
      <div className="text-sm">
        I agree to the <a style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Terms of Service</a> and <a style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Privacy Policy</a>, and confirm the information provided is accurate. <span style={{ color: 'red' }}>*</span>
      </div>
    </label>
  </div>
)

export { SignupStepPayment }
