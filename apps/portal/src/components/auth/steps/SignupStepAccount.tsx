import React from 'react'
import Icon from '../../../lib/icons'
import { IaaSCard } from '../shared/IaaSCard'

interface SignupFormState {
  name: string
  email: string
  password: string
  confirmPassword: string
  type: 'Individual' | 'Organization'
}

interface SignupStepAccountProps {
  f: SignupFormState
  set: (k: string, v: any) => void
}

const SignupStepAccount: React.FC<SignupStepAccountProps> = ({ f, set }) => (
  <div className="flex col gap-3">
    <div className="field"><label>Full name <span style={{ color: 'red' }}>*</span></label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="As it appears on your ID" autoFocus /></div>
    <div className="field"><label>Email <span style={{ color: 'red' }}>*</span></label><input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="you@company.com" /></div>
    <div className="grid-2" style={{ gap: 10 }}>
      <div className="field"><label>Password <span style={{ color: 'red' }}>*</span></label><input type="password" value={f.password} onChange={e => set('password', e.target.value)} placeholder="At least 8 characters" /></div>
      <div className="field"><label>Confirm password <span style={{ color: 'red' }}>*</span></label><input type="password" value={f.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} /></div>
    </div>
    <div className="field">
      <label>Account type <span style={{ color: 'red' }}>*</span></label>
      <div className="grid-2" style={{ gap: 10 }}>
        {[
          { id: 'Individual', title: 'Individual', desc: 'Personal use · single contact · simple KYC', icon: 'users', accent: 'oklch(0.6 0.13 250)' },
          { id: 'Organization', title: 'Organization', desc: 'Company · multiple contacts · full KYC + docs', icon: 'building', accent: 'oklch(0.55 0.18 285)' },
        ].map(o => (
          <IaaSCard key={o.id} selected={f.type === o.id} onClick={() => set('type', o.id)} padding={14}>
            <div className="flex center gap-3">
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${o.accent}1a`, color: o.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={o.icon} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fw-7 text-sm">{o.title}</div>
                <div className="text-xs text-mute mt-1" style={{ lineHeight: 1.4 }}>{o.desc}</div>
              </div>
              {f.type === o.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)', flexShrink: 0 }} />}
            </div>
          </IaaSCard>
        ))}
      </div>
    </div>
  </div>
)

export { SignupStepAccount }
