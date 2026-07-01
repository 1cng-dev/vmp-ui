import { useState, useCallback } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { TeamMember } from '../types'

export interface TeamStoreValue {
  team: TeamMember[]
  loadTeam: () => Promise<void>
  addMember: (member: Omit<TeamMember, 'user_id' | 'staff_code' | 'last_login_at' | 'created_at' | 'updated_at'>) => Promise<void>
  updateMember: (id: string, patch: any) => Promise<void>
  removeMember: (id: string) => Promise<void>
}

const useTeamStore = (): TeamStoreValue => {
  const [team, setTeam] = useState<TeamMember[]>([])

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Failed to load team:', error)
      return
    }
    
    setTeam(data || [])
  }, [])

  const addMember = useCallback(async (member: any) => {
    const authUser = await supabase.auth.getUser()
    const invitedBy = authUser.data.user?.id
    
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
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        email: member.email,
        name: member.name,
        role: member.role,
        team: member.team,
        status: 'Active',
        invited_by: invitedBy,
        invite_token: inviteToken,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to add member:', error)
      throw error
    }
    
    // Call Edge Function to send Resend email
    const { error: emailError } = await supabase.functions.invoke('send-invite', {
      body: {
        email: member.email,
        name: member.name,
        role: member.role,
        team: member.team,
        inviteToken: inviteToken
      }
    })
    
    if (emailError) {
      console.error('Failed to send invite email:', emailError)
      throw emailError
    }
    
    await loadTeam()
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

  return {
    team,
    loadTeam,
    addMember,
    updateMember,
    removeMember,
  }
}

export default useTeamStore