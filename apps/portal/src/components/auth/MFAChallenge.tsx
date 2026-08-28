import React, { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useUIStore from '../../store/uiStore'

interface Props {
  onVerified?: () => void
}

export const MFAChallenge: React.FC<Props> = ({ onVerified }) => {
  const { toast } = useUIStore()
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
    const code = digits.join('')
    if (code.length !== 6) return

    setLoading(true)

    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp?.[0]

    if (!factor) {
      toast('No TOTP factor found', 'bad')
      setLoading(false)
      return
    }

    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (chErr) {
      toast(chErr.message, 'bad')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: ch.id,
      code,
    })

    if (error) {
      toast(error.message, 'bad')
      setLoading(false)
      return
    }

    toast('Verified', 'ok')
    onVerified?.()
    setLoading(false)
  }

  return (
    <div className="card" style={{ width: '100%', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
      <div className="card-body" style={{ padding: '24px 32px 32px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 14, fontWeight: 600 }}>2FA</div>
        <h3 className="card-title" style={{ marginBottom: 8, fontSize: 22 }}>Two Factor Authentication</h3>
        <p className="text-sm text-mute" style={{ marginBottom: 24 }}>Please confirm access to your account by entering the code provided by your authenticator application.</p>

        <form onSubmit={submit} className="flex col gap-3">
          <div className="flex center between" style={{ gap: 10, justifyContent: 'center' }}>
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
                  width: 48,
                  height: 56,
                  textAlign: 'center',
                  fontSize: 18,
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.04)',
                  color: 'var(--text)',
                  border: '1px solid rgba(0,0,0,0.12)',
                }}
              />
            ))}
          </div>

          <p className="text-xs text-mute" style={{ margin: '4px 0 0' }}>Lost access to your authenticator? Contact support.</p>

          <button type="submit" className="btn primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Verifying…' : 'Confirm'}
          </button>
        </form>
      </div>
    </div>
  )
}
