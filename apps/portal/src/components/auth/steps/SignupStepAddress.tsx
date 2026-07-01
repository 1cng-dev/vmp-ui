import React from 'react'

interface SignupFormState {
  address: string
  city: string
  state: string
  postalCode: string
  country: string
}

interface SignupStepAddressProps {
  f: SignupFormState
  set: (k: string, v: any) => void
}

const SignupStepAddress: React.FC<SignupStepAddressProps> = ({ f, set }) => (
  <div className="flex col gap-3">
    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Address</div>
    <div className="field"><label>Street address <span style={{ color: 'red' }}>*</span></label><input value={f.address} onChange={e => set('address', e.target.value)} placeholder="Building, street, township" autoFocus /></div>
    <div className="grid-3" style={{ gap: 10 }}>
      <div className="field"><label>City</label><input value={f.city} onChange={e => set('city', e.target.value)} /></div>
      <div className="field"><label>State / Region</label>
        <select value={f.state} onChange={e => set('state', e.target.value)}>
          <option>Yangon Region</option><option>Mandalay Region</option><option>Naypyidaw</option><option>Sagaing Region</option><option>Bago Region</option><option>Magway Region</option><option>Tanintharyi Region</option><option>Ayeyarwady Region</option><option>Shan State</option><option>Kachin State</option><option>Kayah State</option><option>Kayin State</option><option>Mon State</option><option>Rakhine State</option><option>Chin State</option>
        </select>
      </div>
      <div className="field"><label>Postal code</label><input value={f.postalCode} onChange={e => set('postalCode', e.target.value)} style={{ fontFamily: 'var(--mono)' }} /></div>
    </div>
    <div className="field">
      <label>Country</label>
      <input value={f.country} onChange={e => set('country', e.target.value)} disabled style={{ background: 'var(--surface-3)' }} />
      <div className="hint">VPS Myanmar currently serves customers within Myanmar.</div>
    </div>
  </div>
)

export { SignupStepAddress }
