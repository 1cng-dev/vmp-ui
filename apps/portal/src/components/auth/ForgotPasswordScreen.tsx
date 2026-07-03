import React, { useState } from 'react'
import useUIStore from '../../store/uiStore'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './shared/AuthLayout'

interface ForgotPasswordScreenProps {
    onBackToLogin: () => void
    userType: 'customer' | 'team'
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBackToLogin, userType }) => {
    const { toast } = useUIStore()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e?.preventDefault()
        setLoading(true)

        const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-user-role', {
            body: { email, userType }
        })

        if (validationError || !validationData?.valid) {
            toast(validationData?.reason || 'Error validating email', 'bad')
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        })

        if (error) {
            toast(error.message, 'bad')
            setLoading(false)
        } else {
            setSuccess(true)
            setLoading(false)
        }
    }

    if (success) {
        return (
            <AuthLayout>
                <div style={{ width: 'min(420px, 100%)' }}>
                    <div className="text-center mb-4">
                        <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Check your email</h1>
                        <p className="text-sm text-mute mt-2">We sent a password reset link to {email}</p>
                    </div>
                    <button onClick={onBackToLogin} className="btn primary" style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}>
                        Back to login
                    </button>
                </div>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout>
            <div style={{ width: 'min(420px, 100%)' }}>
                <div className="text-center mb-4">
                    <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Forgot password?</h1>
                    <p className="text-sm text-mute mt-2">Enter your email to receive a reset link</p>
                </div>

                <form onSubmit={submit} className="card">
                    <div className="card-body" style={{ padding: 24 }}>
                        <div className="flex col gap-3">
                            <div className="field">
                                <label>Email</label>
                                <input type="email" autoFocus required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                            </div>
                            <button type="submit" className="btn primary" disabled={!email || loading} style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}>
                                {loading ? 'Sending…' : 'Send reset link'}
                            </button>
                        </div>
                    </div>
                </form>

                <div className="text-center text-sm text-mute mt-3">
                    <a onClick={onBackToLogin} style={{ color: 'var(--accent-strong)', cursor: 'pointer', fontWeight: 600 }}>Back to login</a>
                </div>
            </div>
        </AuthLayout>
    )
}

export { ForgotPasswordScreen }