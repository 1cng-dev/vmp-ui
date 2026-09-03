import { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { TeamMember } from '../types'
import useActivityStore from './activityStore'

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
  addMember: (member: Omit<TeamMember, 'id' | 'last' | 'status'>) => Promise<{ password: string }>
  updateMember: (id: string, patch: any) => Promise<void>
  removeMember: (id: string) => Promise<void>
  resetPassword: (id: string, password: string) => Promise<void>
  subscribeToTeam: () => () => void
}

const TeamContext = createContext<TeamStoreValue | null>(null)

export const TeamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const { logActivity } = useActivityStore()

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

      // Collect all unique invited_by IDs
      const invitedByIds = new Set((data || []).map((m: any) => m.invited_by).filter(Boolean))

      // Fetch all inviters from team_members table
      const invitersMap = new Map()
      if (invitedByIds.size > 0) {
        const { data: inviters } = await supabase
          .from('team_members')
          .select('user_id, name, staff_code')
          .in('user_id', Array.from(invitedByIds))
        if (inviters) {
          inviters.forEach((inviter: any) => {
            invitersMap.set(inviter.user_id, inviter)
          })
        }
      }

      // Map database fields to interface fields and format last_login_at
      const mappedData = (data || []).map((member: any) => {
        let invited_by_name = null
        if (member.invited_by) {
          const inviter = invitersMap.get(member.invited_by)
          if (inviter) {
            invited_by_name = `${inviter.name} (${inviter.staff_code})`
          }
        }

        return {
          ...member,
          id: member.user_id,
          last: member.last_login_at ? formatDate(member.last_login_at) : '-',
          invited_by_name
        }
      })

      setTeam(mappedData)
    } finally {
      if (shouldShowSpinner) setTeamLoading(false)
    }
  }, [team.length])

  const addMember = useCallback(async (member: any) => {
    const authUser = await supabase.auth.getUser()
    const invitedBy = authUser.data.user?.id

    // Generate temporary password that meets validation requirements
    const generateTempPassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
      let password = ''
      for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return password
    }
    const tempPassword = generateTempPassword()

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

    // Ensure the role is set in auth metadata (double-check)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: member.role,
        team: member.team,
        name: member.name
      }
    })

    // Create team_members record with the user_id (no invite token needed)
    const { error } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        email: member.email,
        name: member.name,
        role: member.role,
        team: member.team,
        status: 'Active', // Set to Active directly since they can login with temp password
        invited_by: invitedBy,
        force_password_change: true
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add member:', error)
      throw error
    }

    // Log activity for team member addition
    const { data: { user } } = await supabase.auth.getUser()
    let actorName = 'System'
    if (user) {
      const { data: staff } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', user.id)
        .single()
      if (staff) {
        actorName = `${staff.name} (${staff.staff_code})`
      } else {
        actorName = user.user_metadata?.name || user.email || 'System'
      }
    }

    await logActivity(
      `Added team member ${member.name} (${member.role})`,
      'role',
      actorName,
      { memberId: userId, name: member.name, role: member.role, team: member.team }
    )

    await loadTeam()
    
    // Return the temporary password to show to the admin
    return { password: tempPassword }
  }, [loadTeam, logActivity])

  const updateMember = useCallback(async (id: string, patch: any) => {
    const previousMember = team.find(m => m.id === id)
    // Update team_members table
    const { error } = await supabase
      .from('team_members')
      .update(patch)
      .eq('user_id', id)

    if (error) {
      console.error('Failed to update member in team_members:', error)
      throw error
    }

    // Log activity for role changes
    if (patch.role && previousMember && patch.role !== previousMember.role) {
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
        } else {
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }

      await logActivity(
        `Changed team member ${previousMember.name} role from ${previousMember.role} to ${patch.role}`,
        'role',
        actorName,
        { memberId: id, name: previousMember.name, previousRole: previousMember.role, newRole: patch.role, team: previousMember.team }
      )
    }

    // If role or name is being updated, also update auth metadata using admin client
    if (patch.role || patch.name || patch.team) {
      // Get current member data to preserve existing metadata
      const { data: member } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', id)
        .single()

      if (member) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
              role: patch.role || member.role,
              team: patch.team || member.team,
              name: patch.name || member.name
            }
          })
        } catch (authError) {
          console.error('Failed to update auth metadata:', authError)
          // Don't throw here, just log the error - the DB update succeeded
        }
      }
    }

    await loadTeam()
  }, [loadTeam, team, logActivity])

  const removeMember = useCallback(async (id: string) => {
    const previousMember = team.find(m => m.id === id)
    
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

    // Log activity for team member removal
    const { data: { user } } = await supabase.auth.getUser()
    let actorName = 'System'
    if (user) {
      const { data: staff } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', user.id)
        .single()
      if (staff) {
        actorName = `${staff.name} (${staff.staff_code})`
      } else {
        actorName = user.user_metadata?.name || user.email || 'System'
      }
    }

    if (previousMember) {
      await logActivity(
        `Removed team member ${previousMember.name}`,
        'role',
        actorName,
        { memberId: previousMember.id, name: previousMember.name, role: previousMember.role, team: previousMember.team }
      )
    }

    await loadTeam()
  }, [loadTeam, team, logActivity])


  const resetPassword = useCallback(async (id: string, password: string) => {
    const previousMember = team.find(m => m.id === id)
    // Update user's password using admin client with admin-provided password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: password
    })

    if (error) {
      console.error('Failed to reset password:', error)
      throw error
    }

    // Log activity for password reset
    const { data: { user } } = await supabase.auth.getUser()
    let actorName = 'System'
    if (user) {
      const { data: staff } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', user.id)
        .single()
      if (staff) {
        actorName = `${staff.name} (${staff.staff_code})`
      } else {
        actorName = user.user_metadata?.name || user.email || 'System'
      }
    }

    if (previousMember) {
      await logActivity(
        `Reset password for team member ${previousMember.name}`,
        'role',
        actorName,
        { memberId: previousMember.id, name: previousMember.name, role: previousMember.role, team: previousMember.team }
      )
    }
  }, [team, logActivity])

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

