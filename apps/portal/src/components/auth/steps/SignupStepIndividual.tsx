import React from 'react'

interface SignupStepIndividualProps {
  f: any
  set: (k: string, v: any) => void
}

const SignupStepIndividual: React.FC<SignupStepIndividualProps> = ({ f, set }) => (
  <div className="flex col gap-3">
    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Personal information</div>
    <div className="grid-2" style={{ gap: 10 }}>
      <div className="field"><label>Phone number <span style={{ color: 'red' }}>*</span></label><input value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+95 9 ..." style={{ fontFamily: 'var(--mono)' }} autoFocus /></div>
      <div className="field"><label>Alternate phone (optional)</label><input value={f.altPhone} onChange={e => set('altPhone', e.target.value)} placeholder="+95 9 ..." style={{ fontFamily: 'var(--mono)' }} /></div>
    </div>
    <div className="field">
      <label>Preferred contact method</label>
      <div className="flex gap-2">
        {['Email', 'Phone call', 'WhatsApp', 'Viber'].map(m => (
          <button 
            key={m} 
            type="button" 
            className="filter-chip" 
            onClick={() => set('preferredContactMethod', m)} 
            style={{ 
              borderColor: f.preferredContactMethod === m ? 'var(--accent)' : 'var(--line)',
              background: f.preferredContactMethod === m ? 'var(--accent-soft)' : 'transparent'
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="hint">We'll use this for renewal and provisioning notifications.</div>
    </div>
  </div>
)

export { SignupStepIndividual }
