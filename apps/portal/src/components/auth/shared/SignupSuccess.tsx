import React from 'react'
import Icon from '../../../lib/icons'
import { AuthLayout } from './AuthLayout'

interface SignupSuccessProps {
  email: string
  onContinue: () => void
}

const SignupSuccess: React.FC<SignupSuccessProps> = ({ email, onContinue }) => (
  <AuthLayout>
    <div style={{ width: 'min(480px, 100%)', textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--ok-soft)', color: 'var(--ok)',
        margin: '0 auto 24px',
        display: 'grid', placeItems: 'center',
        animation: 'pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <Icon name="check" size={36} stroke={2.5} />
      </div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Account created!</h1>
      <p className="text-sm text-mute mt-3" style={{ lineHeight: 1.6 }}>
        Your credentials are saved. KYC documents are under review. We'll email <strong>{email}</strong> within <strong>1 business day</strong> once verified — then you can deploy your first VM.
      </p>
      {email && (
        <div className="card mt-3" style={{ background: 'var(--info-soft)', borderColor: 'transparent' }}>
          <div className="card-body" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left' }}>
            <Icon name="key" size={14} style={{ marginTop: 2, color: 'var(--info)' }} />
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--info)' }}>
              You can sign in immediately with <span className="mono fw-7">{email}</span> and the password you just chose. Your account stays in "Under review" until KYC is verified.
            </div>
          </div>
        </div>
      )}
      <div className="card mt-4" style={{ background: 'var(--surface-2)' }}>
        <div className="card-body" style={{ padding: 18 }}>
          <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>What's next</div>
          <div className="flex col gap-3 text-left">
            {[
              ['1', 'Sign in to your account', 'Use the email + password you just registered'],
              ['2', 'KYC verification', 'Our team reviews your documents within 1 business day'],
              ['3', 'Deploy your first VM', 'Once approved, request a trial or paid VM'],
            ].map(([n, t, d]) => (
              <div key={n} className="flex gap-3" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{n}</div>
                <div>
                  <div className="fw-6 text-sm">{t}</div>
                  <div className="text-xs text-mute mt-1">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <button className="btn primary mt-4" onClick={onContinue} style={{ padding: '10px 22px', fontSize: 13 }}>
        Continue to sign in
        <Icon name="chevron-right" size={12} />
      </button>
      <style>{`@keyframes pop { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  </AuthLayout>
)

export { SignupSuccess }
