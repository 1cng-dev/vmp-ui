import React, { useState, useEffect } from 'react'
import useUIStore from '../../store/uiStore'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './shared/AuthLayout'
import { useSystemSettingsStore } from '../../store/systemSettingsStore'
import Spinner from '../../components/ui/Spinner'

const ResetPasswordScreen: React.FC = () => {
    const { toast } = useUIStore()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [redirecting, setRedirecting] = useState(false)
    const [checkingSession, setCheckingSession] = useState(true)

    useEffect(() => {
        // Supabase automatically handles the token from the URL
        // We just need to check if we have a session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setCheckingSession(false)
            if (!session) {
                setRedirecting(true)
                toast('Invalid or expired reset link', 'bad')
                setTimeout(() => {
                    window.location.href = '/login'
                }, 1500)
            }
        })
    }, [])

    const validatePassword = () => {
        if (password.length < 8) return 'Password must be at least 8 characters'
        if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one special character'
        if (password !== confirmPassword) return 'Passwords do not match'
        return null
    }

    const submit = async (e: React.FormEvent) => {
        e?.preventDefault()

        const validationError = validatePassword()
        if (validationError) {
            toast(validationError, 'bad')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.updateUser({
            password: password
        })

        if (error) {
            toast(error.message, 'bad')
            setLoading(false)
        } else {
            toast('Password updated successfully', 'good')
            setLoading(false)
            setRedirecting(true)

            await supabase.auth.signOut()

            localStorage.removeItem('ims-auth-token')

            // Show loading spinner before redirect
            setTimeout(() => {
                window.location.href = '/login'
            }, 1500)
        }
    }

    return (
        <>
            {(redirecting || checkingSession) && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', zIndex: 9999 }}>
                    <Spinner size={96} />
                </div>
            )}
            {!checkingSession && !redirecting && (
                <AuthLayout>
                    <div style={{ width: 'min(420px, 100%)' }}>
                        <div className="text-center mb-4">
                            {(() => { const { settings } = useSystemSettingsStore(); return settings?.logo_url ? (
                              <img src={`${settings.logo_url}?v=${settings.updated_at}`} alt="Logo" style={{ width: 96, height: 96, objectFit: 'contain', margin: '0 auto 16px', display: 'block', borderRadius: 12 }} />
                            ) : (
                              <div className="brand-mark" style={{ width: 96, height: 96, fontSize: 36, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
                            )})()}
                            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Set new password</h1>
                            <p className="text-sm text-mute mt-2">Enter your new password below</p>
                        </div>

                        <form onSubmit={submit} className="card">
                            <div className="card-body" style={{ padding: 24 }}>
                                <div className="flex col gap-3">
                                    <div className="field">
                                        <label>New Password</label>
                                        <input type="password" autoFocus required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 chars, 1 uppercase, 1 special" />
                                    </div>
                                    <div className="field">
                                        <label>Confirm Password</label>
                                        <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                                    </div>
                                    <button type="submit" className="btn primary" disabled={!password || !confirmPassword || loading} style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}>
                                        {loading ? 'Updating…' : 'Update password'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </AuthLayout>
            )}
        </>
    )
}

export { ResetPasswordScreen }