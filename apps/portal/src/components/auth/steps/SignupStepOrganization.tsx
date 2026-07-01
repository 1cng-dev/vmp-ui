import React from 'react'

interface SignupFormState {
  orgName: string
  orgRegNo: string
  orgType: string
  orgIndustry: string
  orgRepTitle: string
  orgEmployees: string
  orgWebsite: string
  phone: string
  altPhone: string
}

interface SignupStepOrganizationProps {
  f: SignupFormState
  set: (k: string, v: any) => void
}

const SignupStepOrganization: React.FC<SignupStepOrganizationProps> = ({ f, set }) => (
  <div className="flex col gap-3">
    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Organization details</div>
    <div className="field"><label>Organization name <span style={{ color: 'red' }}>*</span></label><input value={f.orgName} onChange={e => set('orgName', e.target.value)} placeholder="Mandalay Logistics Co., Ltd" autoFocus /></div>
    <div className="grid-2" style={{ gap: 10 }}>
      <div className="field"><label>Registration number <span style={{ color: 'red' }}>*</span></label><input value={f.orgRegNo} onChange={e => set('orgRegNo', e.target.value)} placeholder="e.g. 12345678" style={{ fontFamily: 'var(--mono)' }} /></div>
      <div className="field"><label>Organization type</label>
        <select value={f.orgType} onChange={e => set('orgType', e.target.value)}>
          <option>Private Limited</option><option>Public Limited</option><option>Partnership</option><option>Sole Proprietorship</option><option>NGO / Non-profit</option><option>Government</option>
        </select>
      </div>
    </div>
    <div className="grid-2" style={{ gap: 10 }}>
      <div className="field"><label>Industry</label>
        <select value={f.orgIndustry} onChange={e => set('orgIndustry', e.target.value)}>
          <option>Technology</option><option>Finance</option><option>Retail / E-commerce</option><option>Manufacturing</option><option>Logistics</option><option>Healthcare</option><option>Education</option><option>Hospitality</option><option>Media</option><option>Other</option>
        </select>
      </div>
      <div className="field"><label>Employees</label>
        <select value={f.orgEmployees} onChange={e => set('orgEmployees', e.target.value)}>
          <option>1-10</option><option>11-50</option><option>51-200</option><option>201-1000</option><option>1000+</option>
        </select>
      </div>
    </div>
    <div className="grid-2" style={{ gap: 10 }}>
      <div className="field"><label>Your title</label><input value={f.orgRepTitle} onChange={e => set('orgRepTitle', e.target.value)} placeholder="e.g. CTO, IT Manager" /></div>
      <div className="field"><label>Website (optional)</label><input value={f.orgWebsite} onChange={e => set('orgWebsite', e.target.value)} placeholder="example.com" /></div>
    </div>
    <div className="grid-2" style={{ gap: 10 }}>
      <div className="field"><label>Phone <span style={{ color: 'red' }}>*</span></label><input value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+95 9 ..." style={{ fontFamily: 'var(--mono)' }} /></div>
      <div className="field"><label>Alternate phone</label><input value={f.altPhone} onChange={e => set('altPhone', e.target.value)} placeholder="+95 9 ..." style={{ fontFamily: 'var(--mono)' }} /></div>
    </div>
  </div>
)

export { SignupStepOrganization }
