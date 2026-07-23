import { useState, useCallback } from 'react'
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
  addMember: (member: Omit<TeamMember, 'id' | 'last' | 'status'>) => Promise<{ password: string }>
  updateMember: (id: string, patch: any) => Promise<void>
  removeMember: (id: string) => Promise<void>
  resetPassword: (id: string, password: string) => Promise<void>
}

const useTeamStore = (): TeamStoreValue => {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    
    const MIN_LOADING_TIME = 400 // 400ms minimum loading time
    const startTime = Date.now()
    
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Failed to load team:', error)
      setTeamLoading(false)
      return
    }
    
    // Map database fields to interface fields and format last_login_at
    const mappedData = (data || []).map((member: any) => ({
      ...member,
      id: member.user_id,
      last: member.last_login_at ? formatDate(member.last_login_at) : '-'
    }))
    
    setTeam(mappedData)
    
    // Ensure minimum loading time
    const elapsedTime = Date.now() - startTime
    const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
    
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime))
    }
    
    setTeamLoading(false)
  }, [])

  const addMember = useCallback(async (member: any) => {
    const authUser = await supabase.auth.getUser()
    const invitedBy = authUser.data.user?.id
    
    // Generate temporary password (will be shown to admin)
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
    
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
    
    // Create team_members record with the user_id
    const { error } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        email: member.email,
        name: member.name,
        role: member.role,
        team: member.team,
        status: 'Active',
        invited_by: invitedBy,
        force_password_change: true
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to add member:', error)
      throw error
    }
    
    await loadTeam()
    
    // Return the temporary password for the admin to share
    return { password: tempPassword }
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
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', id)
    
    if (error) {
      console.error('Failed to remove member:', error)
      throw error
    }
    
    await loadTeam()
  }, [loadTeam])

  const resetPassword = useCallback(async (id: string, password: string) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: password
    })

    if (error) {
      console.error('Failed to reset password:', error)
      throw error
    }
  }, [])

  return {
    teamLoading,
    team,
    loadTeam,
    addMember,
    updateMember,
    removeMember,
    resetPassword,
  }
}

export default useTeamStore
