import React from 'react'
import Icon from '../../../lib/icons'
import { AuthLayout } from './AuthLayout'

interface VerifyEmailNoticeProps {
  email: string
  onContinue: () => void
}

const VerifyEmailNotice: React.FC<VerifyEmailNoticeProps> = ({ email, onContinue }) => (
  <AuthLayout>
    <div style={{ width: 'min(480px, 100%)', textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--info-soft)', color: 'var(--info)',
        margin: '0 auto 24px',
        display: 'grid', placeItems: 'center',
      }}>
        <Icon name="mail" size={32} />
      </div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Check your inbox</h1>
      <p className="text-sm text-mute mt-3" style={{ lineHeight: 1.6 }}>
        We sent a verification link to <strong>{email}</strong>. Click the link to verify your email, then come back here to upload your KYC documents and finish signup.
      </p>
      <button className="btn primary mt-4" onClick={onContinue} style={{ padding: '10px 22px', fontSize: 13 }}>
        Continue to sign in
        <Icon name="chevron-right" size={12} />
      </button>
    </div>
  </AuthLayout>
)

export { VerifyEmailNotice }
