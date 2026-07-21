import { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { TeamMember } from '../types'

// Helper function to format timestamp to relative time
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export interface TeamStoreValue {
  team: TeamMember[]
  teamLoading: boolean
  loadTeam: () => Promise<void>
  addMember: (member: Omit<TeamMember, 'id' | 'last' | 'status'>) => Promise<void>
  updateMember: (id: string, patch: any) => Promise<void>
  removeMember: (id: string) => Promise<void>
  resetPassword: (id: string, password: string) => Promise<void>
  subscribeToTeam: () => () => void
}

const TeamContext = createContext<TeamStoreValue | null>(null)

export const TeamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  const loadTeam = useCallback(async () => {
    const shouldShowSpinner = team.length === 0
    try {
      if (shouldShowSpinner) setTeamLoading(true)
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load team:', error)
        return
      }

      // Map database fields to interface fields and format last_login_at
      const mappedData = (data || []).map((member: any) => ({
        ...member,
        id: member.user_id,
        last: member.last_login_at ? formatDate(member.last_login_at) : '-'
      }))

      setTeam(mappedData)
    } finally {
      if (shouldShowSpinner) setTeamLoading(false)
    }
  }, [team.length])

  const addMember = useCallback(async (member: any) => {
    const authUser = await supabase.auth.getUser()
    const invitedBy = authUser.data.user?.id
    const invitedByName = authUser.data.user?.user_metadata?.name || authUser.data.user?.email || 'System'

    // Generate temporary password (user never sees this)
    const tempPassword = Math.random().toString(36).slice(-12)

    // Create Supabase auth user first
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: member.role,
        team: member.team,
        name: member.name
      }
    })

    if (userError) {
      console.error('Failed to create auth user:', userError)
      throw userError
    }

    const userId = userData.user.id

    // Generate invite token
    const inviteToken = crypto.randomUUID()

    // Create team_members record with the user_id
    const { error } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        email: member.email,
        name: member.name,
        role: member.role,
        team: member.team,
        status: 'Inactive', // Set to Inactive until they accept the invite
        invited_by: invitedBy,
        invited_by_name: invitedByName,
        invite_token: inviteToken,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add member:', error)
      throw error
    }

    // Generate invite token and direct link
    const inviteLink = `${window.location.origin}/setup-password?token=${inviteToken}`
    console.log('Invite token generated:', inviteToken)
    console.log('Direct invite link:', inviteLink)
    console.log('About to save to database with user_id:', userId, 'and invite_token:', inviteToken)

    // Call Edge Function to send Resend email with direct link
    const { error: emailError } = await supabase.functions.invoke('send-invite', {
      body: {
        email: member.email,
        name: member.name,
        role: member.role,
        team: member.team,
        inviteToken: inviteToken,
        inviteLink: inviteLink // Send direct link to edge function
      }
    })

    if (emailError) {
      console.error('Failed to send invite email:', emailError)
      throw emailError
    }

    await loadTeam()
    console.log('Team reloaded after invite')
  }, [loadTeam])

  const updateMember = useCallback(async (id: string, patch: any) => {
    const { error } = await supabase
      .from('team_members')
      .update(patch)
      .eq('user_id', id)

    if (error) {
      console.error('Failed to update member:', error)
      throw error
    }

    await loadTeam()
  }, [loadTeam])

  const removeMember = useCallback(async (id: string) => {
    // Delete from team_members table first
    const { error: dbError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', id)

    if (dbError) {
      console.error('Failed to remove member from team_members:', dbError)
      throw dbError
    }

    // Delete from auth.users using admin client
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      console.error('Failed to delete auth user:', authError)
      throw authError
    }

    await loadTeam()
  }, [loadTeam])


  const resetPassword = useCallback(async (id: string, password: string) => {
    // Update user's password using admin client with admin-provided password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: password
    })

    if (error) {
      console.error('Failed to reset password:', error)
      throw error
    }
  }, [])

  const subscribeToTeam = useCallback(() => {
    const channelName = `team-changes-${Date.now()}`
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        loadTeam()
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }, [loadTeam])

  const value: TeamStoreValue = {
    team,
    teamLoading,
    loadTeam,
    addMember,
    updateMember,
    removeMember,
    resetPassword,
    subscribeToTeam,
  }

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  )
}

export const useTeamStore = (): TeamStoreValue => {
  const context = useContext(TeamContext)
  if (!context) {
    throw new Error('useTeamStore must be used within TeamProvider')
  }
  return context
}

