import React, { createContext, useContext, useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './Signup'
import { SignupSuccess } from './shared/SignupSuccess'
import { TeamLoginScreen } from './TeamLoginScreen'
import Spinner from '../ui/Spinner'

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

interface TeamAuthShellProps {
  children: React.ReactNode
  setRole: (role: string) => void
}



const AuthContext = createContext<AuthContextValue | null>(null)
export const useAuth = () => useContext(AuthContext)


interface AuthShellProps {
  children: React.ReactNode
  setRole: (role: string) => void
}

export const AuthShell: React.FC<AuthShellProps> = ({ children, setRole }) => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState('login')
  const [signupComplete, setSignupComplete] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [justSignedUp, setJustSignedUp] = useState(false)
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = useState(false)
  const initialRoleSetRef = React.useRef(false)

  // Set minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDisplayTimeElapsed(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Don't set user if in signup mode - let completeSignup handle it
        if (mode === 'signup') {
          setLoading(false)
          return
        }

        const userData = session.user.user_metadata
        const userRole = userData.role || 'Customer'

        // Redirect team users to admin portal
        const teamRoles = ['Admin', 'Sales', 'Engineer', 'Finance']
        if (teamRoles.includes(userRole)) {
          // If on customer portal, sign out team members
          if (window.location.pathname.startsWith('/admin') === false) {
            await supabase.auth.signOut()
            setLoading(false)
            return
          }
          if (window.location.pathname !== '/admin') {
            setShouldRedirect(true)
          }
          setLoading(false)
          return
        }

        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: userRole,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Don't set user if in signup mode - let completeSignup handle it
        if (mode === 'signup') {
          setLoading(false)
          return
        }

        const userData = session.user.user_metadata
        const userRole = userData.role || 'Customer'

        // Redirect team users to admin portal
        const teamRoles = ['Admin', 'Sales', 'Engineer', 'Finance']
        if (teamRoles.includes(userRole)) {
          // If on customer portal, sign out team members
          if (window.location.pathname.startsWith('/admin') === false) {
            await supabase.auth.signOut()
            setLoading(false)
            return
          }
          if (window.location.pathname !== '/admin') {
            setShouldRedirect(true)
          }
          setLoading(false)
          return
        }

        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: userRole,
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
  }, [setRole, mode])


  const handleSignout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/')
  }

  const completeSignup = (email: string) => {
    setSignupEmail(email)
    setJustSignedUp(true)
    setUser(null) // Clear user to prevent dashboard from showing
    // Show loading spinner for a moment, then show success page
    setTimeout(() => {
      setSignupComplete(true)
      setJustSignedUp(false)
    }, 800)
  }

  if (shouldRedirect) {
    return <Navigate to="/admin" replace />
  }

  if (signupComplete) {
    return <SignupSuccess email={signupEmail} onContinue={() => { setSignupComplete(false); setMode('login') }} />
  }

  if (justSignedUp || (loading && !minDisplayTimeElapsed)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <Spinner />
      </div>
    )
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


export const TeamAuthShell: React.FC<TeamAuthShellProps> = ({ children, setRole }) => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = useState(false)
  const [roleLoaded, setRoleLoaded] = useState(false)
  const loginSyncInFlightRef = React.useRef(false)
  const lastSyncedUserIdRef = React.useRef<string | null>(null)

  // Set minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDisplayTimeElapsed(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const updateTeamMemberLogin = async (userId: string, userData: any, email: string) => {
    if (loginSyncInFlightRef.current || lastSyncedUserIdRef.current === userId) {
      return
    }

    loginSyncInFlightRef.current = true

    try {
      // Check if team member exists
      const { data: existingMember, error: fetchError } = await supabase
        .from('team_members')
        .select('user_id, name, email, role, team')
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchError) {
        throw fetchError
      }

      if (existingMember) {
        // Use database role as source of truth
        const dbRole = existingMember.role
        const dbTeam = existingMember.team
        
        // Update last_login_at and sync metadata
        const { error: updateError } = await supabase
          .from('team_members')
          .update({ 
            last_login_at: new Date().toISOString(),
            name: userData.name || existingMember.name,
            email: email || existingMember.email,
            role: dbRole,
            team: dbTeam
          })
          .eq('user_id', userId)

        if (updateError) {
          throw updateError
        }
      } else {
        // Create team member record if it doesn't exist
        const { error: insertError } = await supabase
          .from('team_members')
          .insert({
            user_id: userId,
            email: email || userData.email,
            name: userData.name,
            role: userData.role || 'Admin',
            team: userData.team || 'Management',
            status: 'Active',
            last_login_at: new Date().toISOString()
          })

        if (insertError) {
          throw insertError
        }
      }

      lastSyncedUserIdRef.current = userId
    } catch (error) {
      console.error('Failed to update team member login:', error)
    } finally {
      loginSyncInFlightRef.current = false
    }
  }

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const userData = session.user.user_metadata

        // Fetch role from database (source of truth)
        const { data: teamMember, error } = await supabase
          .from('team_members')
          .select('role, name, team')
          .eq('user_id', session.user.id)
          .maybeSingle()

        // If database fetch fails, keep existing user and don't sign out
        if (error) {
          console.error('Failed to fetch team member role:', error)
          setLoading(false)
          return
        }

        // Only sign out if role is explicitly invalid, not if fetch failed
        if (!teamMember?.role) {
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        const userRole = teamMember.role

        // Validate role - only allow team roles, reject Customer
        const allowedRoles = ['Admin', 'Sales', 'Engineer', 'Finance']
        if (!allowedRoles.includes(userRole)) {
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: userRole,
          name: teamMember?.name || userData.name || session.user.email!,
          avatar: teamMember?.name || userData.name || session.user.email!,
          customerId: userData.customerId,
        })

        setRole(userRole)
        setRoleLoaded(true)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event !== 'SIGNED_IN' && _event !== 'SIGNED_OUT') {
        return
      }
      
      // Prevent processing if session is null and user is already null (avoid redundant updates)
      if (!session && !user) {
        return
      }

      if (session?.user) {
        const userData = session.user.user_metadata

        // Fetch role from database (source of truth)
        const { data: teamMember, error } = await supabase
          .from('team_members')
          .select('role, name, team')
          .eq('user_id', session.user.id)
          .maybeSingle()

        // If database fetch fails, keep existing user and don't sign out
        if (error) {
          console.error('Failed to fetch team member role:', error)
          setLoading(false)
          return
        }

        // Only sign out if role is explicitly invalid, not if fetch failed
        if (!teamMember?.role) {
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        const userRole = teamMember.role

        // Validate role - only allow team roles, reject Customer
        const allowedRoles = ['Admin', 'Sales', 'Engineer', 'Finance']
        if (!allowedRoles.includes(userRole)) {
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        // Update team member record on login
        if (_event === 'SIGNED_IN' && lastSyncedUserIdRef.current !== session.user.id) {
          await updateTeamMemberLogin(session.user.id, userData, session.user.email!)
        }

        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: userRole,
          name: teamMember?.name || userData.name || session.user.email!,
          avatar: teamMember?.name || userData.name || session.user.email!,
          customerId: userData.customerId,
        })
        setRole(userRole)
        setRoleLoaded(true)
      } else {
        console.log('[AuthStateChange] Processing SIGNED_OUT')
        setUser(null)
        lastSyncedUserIdRef.current = null
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignout = async () => {
    await supabase.auth.signOut()
    await supabase.auth.signOut({ scope: 'global' })
    setUser(null)
    lastSyncedUserIdRef.current = null
    navigate('/admin')
  }

  if (loading && !minDisplayTimeElapsed) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <Spinner />
      </div>
    )
  }

  if (!user || !roleLoaded) {
    return <TeamLoginScreen />
  }

  return (
    <AuthContext.Provider value={{ user, signout: handleSignout }}>
      {children}
    </AuthContext.Provider>
  )
}
