import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useUIStore from '../../store/uiStore'
import { CircularSpinner } from '../ui/ui'

interface Props {
  onComplete?: () => void
  onCancel?: () => void
}

export const MFAEnroll: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { toast } = useUIStore()
  const [factor, setFactor] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const setup = async () => {
      const { data: list, error: listErr } = await supabase.auth.mfa.listFactors()
      if (listErr) {
        setMessage(listErr.message)
        return
      }
      const factors = Array.isArray(list) ? list : (list?.totp || [])
      if (factors.length > 0) {
        setMessage('You have reached the 2FA setup limit. Please try again, or wait a moment before attempting again.')
        return
      }

      const friendlyName = `Auth-${Date.now()}`
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })
      if (error) {
        const err = error.message || ''
        if (err.toLowerCase().includes('too_many') || err.toLowerCase().includes('maximum number')) {
          setMessage('You have reached the 2FA setup limit. Please try again, or wait a moment before attempting again.')
        } else {
          setMessage(err)
        }
      } else {
        setFactor(data)
      }
    }
    setup()
  }, [toast])

  useEffect(() => {
    return () => {
      if (factor?.status === 'unverified' && factor?.id) {
        supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
    }
  }, [factor])

  const handleDigit = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1)
    setDigits(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
    if (v && i < 5) inputRefs.current[i + 1]?.focus()
  }

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = Array(6).fill('')
    for (let k = 0; k < text.length; k++) next[k] = text[k]
    setDigits(next)
    inputRefs.current[Math.min(text.length, 5)]?.focus()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullCode = digits.join('')
    if (!factor || fullCode.length !== 6) return

    setLoading(true)

    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (chErr) {
      toast(chErr.message, 'bad')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: ch.id,
      code: fullCode,
    })

    if (error) {
      toast(error.message, 'bad')
      setLoading(false)
      return
    }

    toast('2FA enabled', 'ok')
    onComplete?.()
    setLoading(false)
  }

  if (message) return <p className="text-sm" style={{ color: 'var(--bad)' }}>{message}</p>

  if (!factor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        <CircularSpinner />
      </div>
    )
  }

  const qr = factor.totp?.qr_code || factor.qr_code
  const manual = factor.totp?.secret || factor.secret || ''
  const formatted = manual ? (manual.match(/.{1,4}/g) || []).join('-') : ''

  const copyManual = () => {
    if (!manual) return
    navigator.clipboard.writeText(manual).then(
      () => toast('Copied to clipboard', 'ok'),
      () => toast('Copy failed', 'bad')
    )
  }

  return (
    <form onSubmit={submit} className="card" style={{ width: '100%', margin: 0, background: 'var(--card)', color: 'var(--text)' }}>
      <div className="card-body" style={{ padding: 28 }}>
        <h3 className="card-title" style={{ marginBottom: 4, fontSize: 22 }}>2FA Setup</h3>
        <p className="text-sm text-mute" style={{ marginBottom: 28 }}>Scan with your authenticator app to enable 2FA access.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <div style={{ textAlign: 'center' }}>
            {qr ? (
              <>
                <div style={{ position: 'relative', display: 'inline-block', padding: 8 }}>
                  <img
                    src={qr}
                    alt="TOTP QR"
                    style={{ width: 170, height: 170, display: 'block', borderRadius: 6 }}
                  />
                  <span style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, borderTop: '2px solid var(--good)', borderLeft: '2px solid var(--good)', borderTopLeftRadius: 4 }} />
                  <span style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderTop: '2px solid var(--good)', borderRight: '2px solid var(--good)', borderTopRightRadius: 4 }} />
                  <span style={{ position: 'absolute', bottom: 0, left: 0, width: 14, height: 14, borderBottom: '2px solid var(--good)', borderLeft: '2px solid var(--good)', borderBottomLeftRadius: 4 }} />
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderBottom: '2px solid var(--good)', borderRight: '2px solid var(--good)', borderBottomRightRadius: 4 }} />
                </div>
                <div style={{ width: 170, height: 2, margin: '14px auto 0', background: 'var(--good)', boxShadow: '0 0 10px var(--good)', borderRadius: 1 }} />
                <div className="fw-6 text-sm" style={{ marginTop: 16 }}>Secure Protocol</div>
                <p className="text-xs text-mute" style={{ marginTop: 4 }}>Position your camera within the frame to authorize this session.</p>
              </>
            ) : (
              <p className="text-sm text-mute">QR not available — try again.</p>
            )}
          </div>

          <div className="flex col gap-4">
            <div>
              <div className="text-xs fw-6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-mute)', marginBottom: 8 }}>
                Manual Backup Code
              </div>
              <div
                className="flex center between"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: 'var(--text)',
                  border: '1px solid rgba(0,0,0,0.12)',
                }}
              >
                <span style={{ wordBreak: 'break-all' }}>{formatted}</span>
                <button type="button" className="btn ghost" onClick={copyManual} style={{ padding: '2px 6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-mute)' }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <rect x="3" y="3" width="13" height="13" rx="2" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-mute" style={{ marginTop: 4 }}>Use this code if you're unable to scan the QR graphic.</p>
            </div>

            <div>
              <div className="text-xs fw-6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-mute)', marginBottom: 8 }}>
                Verification Token
              </div>
              <div className="flex center between" style={{ gap: 8 }}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKey(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    required
                    style={{
                      width: 44,
                      height: 50,
                      textAlign: 'center',
                      fontSize: 18,
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.04)',
                      color: 'var(--text)',
                      border: '1px solid rgba(0,0,0,0.12)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <button type="submit" className="btn primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Verifying…' : 'Continue'}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  if (factor?.status === 'unverified' && factor?.id) {
                    supabase.auth.mfa.unenroll({ factorId: factor.id })
                  }
                  onCancel?.()
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
