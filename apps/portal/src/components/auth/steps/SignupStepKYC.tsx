import React from 'react'
import Icon from '../../../lib/icons'

interface SignupStepKYCProps {
  f: any
  set: (k: string, v: any) => void
}

const SignupStepKYC: React.FC<SignupStepKYCProps> = ({ f, set }) => {

  const uploadField = (key: string, label: string, hint: string) => {
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Store the File object, don't upload yet
      set(key, file)
    }

    return (
      <div>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id={`upload-${key}`}
        />
        <button
          type="button"
          onClick={() => document.getElementById(`upload-${key}`)?.click()}
          style={{
            padding: '14px 16px',
            border: `1.5px dashed ${f[key] ? 'var(--ok)' : 'var(--line-strong)'}`,
            background: f[key] ? 'var(--ok-soft)' : 'var(--surface-2)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', width: '100%',
            textAlign: 'left',
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 8, background: f[key] ? 'var(--ok)' : 'var(--surface-3)', color: f[key] ? 'white' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={f[key] ? 'check' : 'attach'} size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-6 text-sm" style={{ color: f[key] ? 'var(--ok)' : 'var(--ink)' }}>{f[key] ? 'Uploaded ✓' : label}</div>
            <div className="text-xs text-mute">{hint}</div>
          </div>
        </button>
      </div>
    )
  }
  return (
    <div className="flex col gap-3">
      <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Know your customer (KYC)</div>
      <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 6, fontSize: 12, color: 'var(--info)', display: 'flex', gap: 8 }}>
        <Icon name="lock" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
        <div>Documents are encrypted, used solely for verification, and reviewed within 1 business day. We meet Myanmar AML / KYC requirements.</div>
      </div>

      <div className="field">
        <label>{f.type === 'Individual' ? 'NRC / National ID number' : 'Representative\'s NRC / ID number'} <span style={{ color: 'red' }}>*</span></label>
        <input value={f.nrcOrId} onChange={e => set('nrcOrId', e.target.value)} placeholder="e.g. 12/XXXXX(N)123456" style={{ fontFamily: 'var(--mono)' }} autoFocus />
      </div>

      <div className="text-xs text-mute fw-6 mt-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Identity documents <span style={{ color: 'red' }}>*</span></div>
      <div className="grid-2" style={{ gap: 10 }}>
        {uploadField('nrcFrontFile', 'Upload NRC front', 'JPG or PDF · max 5 MB')}
        {uploadField('nrcBackFile', 'Upload NRC back', 'JPG or PDF · max 5 MB')}
      </div>

      {f.type === 'Organization' && (
        <>
          <div className="text-xs text-mute fw-6 mt-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Organization documents <span style={{ color: 'red' }}>*</span></div>
          <div className="grid-2" style={{ gap: 10 }}>
            {uploadField('orgCertFile', 'Company registration certificate', 'Form 26 / DICA / MyCO printout')}
            {uploadField('orgTaxIdFile', 'Tax registration document', 'IRD letter or TIN certificate')}
          </div>
          <div className="grid-2" style={{ gap: 10 }}>
            {uploadField('dirIdFile', 'Director\'s ID (optional)', 'Required for amounts > MMK 5M/mo')}            <div />
          </div>
        </>
      )}
    </div>
  )
}

export { SignupStepKYC }
