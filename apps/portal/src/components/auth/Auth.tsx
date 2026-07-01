import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './Signup'
import { SignupSuccess } from './shared/SignupSuccess'

interface User {
  id: string
  email: string
  role: string
  name: string
  avatar: string
  customerId?: string
}

interface AuthContextValue {
  user: User | null
  signout: () => void
}


const AuthContext = createContext<AuthContextValue | null>(null)
export const useAuth = () => useContext(AuthContext)


interface AuthShellProps {
  children: React.ReactNode
  setRole: (role: string) => void
}

export const AuthShell: React.FC<AuthShellProps> = ({ children, setRole }) => {
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState('login')
  const [signupComplete, setSignupComplete] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const initialRoleSetRef = React.useRef(false)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userData = session.user.user_metadata
        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: userData.role || 'Customer',
          name: userData.name || session.user.email!,
          avatar: userData.name || session.user.email!,
          customerId: userData.customerId,
        })
        if (!initialRoleSetRef.current) {
          setRole(userData.role || 'Customer')
          initialRoleSetRef.current = true
        }
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userData = session.user.user_metadata
        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: userData.role || 'Customer',
          name: userData.name || session.user.email!,
          avatar: userData.name || session.user.email!,
          customerId: userData.customerId,
        })
        if (!initialRoleSetRef.current) {
          setRole(userData.role || 'Customer')
          initialRoleSetRef.current = true
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setRole])


  const handleSignout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setMode('login')
  }

  const completeSignup = (email: string) => {
    setSignupEmail(email)
    setSignupComplete(true)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (signupComplete) {
    return <SignupSuccess email={signupEmail} onContinue={() => { setSignupComplete(false); setMode('login') }} />
  }
  if (!user) {
    return mode === 'login'
      ? <LoginScreen onSwitchToSignup={() => setMode('signup')} prefillEmail={signupEmail} />
      : <SignupScreen onComplete={completeSignup} onSwitchToLogin={() => setMode('login')} />
  }

  return (
    <AuthContext.Provider value={{ user, signout: handleSignout }}>
      {children}
    </AuthContext.Provider>
  )
}
