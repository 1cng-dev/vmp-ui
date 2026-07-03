import React, { useState, useEffect } from 'react'
import useUIStore from '../../store/uiStore'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './shared/AuthLayout'

const ResetPasswordScreen: React.FC = () => {
    const { toast } = useUIStore()
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Supabase automatically handles the token from the URL
        // We just need to check if we have a session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                toast('Invalid or expired reset link', 'bad')
                window.location.href = '/login'
            }
        })
    }, [])

    const submit = async (e: React.FormEvent) => {
        e?.preventDefault()
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

            await supabase.auth.signOut()

            localStorage.removeItem('ims-auth-token')

            window.location.href = '/login'
        }
    }

    return (
        <AuthLayout>
            <div style={{ width: 'min(420px, 100%)' }}>
                <div className="text-center mb-4">
                    <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Set new password</h1>
                    <p className="text-sm text-mute mt-2">Enter your new password below</p>
                </div>

                <form onSubmit={submit} className="card">
                    <div className="card-body" style={{ padding: 24 }}>
                        <div className="flex col gap-3">
                            <div className="field">
                                <label>New Password</label>
                                <input type="password" autoFocus required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                            </div>
                            <button type="submit" className="btn primary" disabled={!password || loading} style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}>
                                {loading ? 'Updating…' : 'Update password'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </AuthLayout>
    )
}

export { ResetPasswordScreen }