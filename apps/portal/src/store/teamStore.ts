import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

const fetchTeam = async (): Promise<TeamMember[]> => {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
  // Map database fields to interface fields and format last_login_at
  const mappedData = (data || []).map(member => ({
    ...member,
    id: member.user_id,
    last: member.last_login_at ? formatDate(member.last_login_at) : '-'
  }))
  
  return mappedData
}

const useTeamStore = () => {
  const queryClient = useQueryClient()

  const { data: team = [], isLoading: teamLoading, error } = useQuery({
    queryKey: ['team'],
    queryFn: fetchTeam,
    staleTime: 1000 * 60 * 5,
  })

  const addMember = useMutation({
    mutationFn: async (member: any) => {
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
      
      if (userError) throw userError
      
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
          status: 'Inactive',
          invited_by: invitedBy,
          invite_token: inviteToken,
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Generate invite token and direct link
      const inviteLink = `${window.location.origin}/setup-password?token=${inviteToken}`
      
      // Call Edge Function to send Resend email with direct link
      const { error: emailError } = await supabase.functions.invoke('send-invite', {
        body: {
          email: member.email,
          name: member.name,
          role: member.role,
          team: member.team,
          inviteToken: inviteToken,
          inviteLink: inviteLink
        }
      })
      
      if (emailError) throw emailError
      
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })

  const updateMember = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase
        .from('team_members')
        .update(patch)
        .eq('user_id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('user_id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })

  return {
    team,
    teamLoading,
    error,
    addMember: addMember.mutateAsync,
    updateMember: updateMember.mutateAsync,
    removeMember: removeMember.mutateAsync,
  }
}

export default useTeamStore