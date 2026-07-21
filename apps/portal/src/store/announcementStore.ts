import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'

export interface Announcement {
  id: string
  title: string
  body: string
  status: 'Draft' | 'Sent'
  sent_at: string | null
  created_by: string | null
  created_by_name?: string
  created_at: string
  updated_at: string
}

export interface AnnouncementStoreValue {
  announcements: Announcement[]
  announcementsLoading: boolean
  loadAnnouncements: () => Promise<void>
  addAnnouncement: (announcement: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateAnnouncement: (id: string, patch: Partial<Announcement>) => Promise<void>
  deleteAnnouncement: (id: string) => Promise<void>
}

const AnnouncementContext = createContext<AnnouncementStoreValue | null>(null)

export const AnnouncementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const { logActivity } = useActivityStore()

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true)
    try {
      const { data: announcements, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (announcementsError) {
        console.error('Failed to load announcements:', announcementsError)
        return
      }

      if (announcements) {
        // Fetch all staff members to map creator names
        const { data: staffMembers, error: staffError } = await supabase
          .from('team_members')
          .select('user_id, name, staff_code')

        if (staffError) {
          console.error('Failed to load staff members:', staffError)
        }

        // Create a map of user_id to staff name
        const staffMap = new Map()
        if (staffMembers) {
          staffMembers.forEach(staff => {
            staffMap.set(staff.user_id, `${staff.name} (${staff.staff_code})`)
          })
        }

        // Map announcements with creator names
        const announcementsWithCreator = announcements.map(a => ({
          ...a,
          created_by_name: a.created_by ? staffMap.get(a.created_by) || 'System' : 'System'
        }))

        setAnnouncements(announcementsWithCreator)
      }
    } finally {
      setAnnouncementsLoading(false)
    }
  }, [])

  const addAnnouncement = useCallback(async (announcement: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>) => {
    // Get current user for activity logging and created_by field
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('Error getting user:', userError)
    }
    
    let actorName = 'System'
    let createdBy = user?.id || null
    
    console.log('User data:', { userId: user?.id, email: user?.email, metadata: user?.user_metadata })
    
    if (user) {
      const { data: staff, error: staffError } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', user.id)
        .single()
      
      if (staffError) {
        console.error('Error fetching staff:', staffError)
      }
      
      if (staff && !staffError) {
        actorName = `${staff.name} (${staff.staff_code})`
      } else {
        // Fallback to user metadata or email
        actorName = user.user_metadata?.name || user.email || 'System'
        console.log('Staff lookup failed, using fallback:', actorName)
      }
    } else {
      console.log('No authenticated user found - announcement will show System as creator')
    }

    console.log('Inserting announcement with:', { createdBy })

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        ...announcement,
        created_by: createdBy,
        sent_at: announcement.status === 'Sent' ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting announcement:', error)
      throw error
    }
    
    if (data) {
      console.log('Announcement inserted successfully:', data)
      // Don't call loadAnnouncements - real-time subscription handles updates
      
      await logActivity(
        `Created announcement: ${announcement.title}`,
        'announcement',
        actorName,
        { title: announcement.title, status: announcement.status }
      )
      
      return data.id
    }
    throw new Error('Failed to create announcement')
  }, [logActivity])

  const updateAnnouncement = useCallback(async (id: string, patch: Partial<Announcement>) => {
    const updateData: any = { ...patch }
    if (patch.status === 'Sent' && !patch.sent_at) {
      updateData.sent_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Failed to update announcement:', error)
      throw error
    }
    // Don't call loadAnnouncements - real-time subscription will handle it
  }, [])

  const deleteAnnouncement = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete announcement:', error)
      throw error
    }
    // Don't call loadAnnouncements - real-time subscription will handle it
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('announcements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setAnnouncements(prev => [payload.new as Announcement, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setAnnouncements(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } as Announcement : a))
        } else if (payload.eventType === 'DELETE') {
          setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const value: AnnouncementStoreValue = {
    announcements,
    announcementsLoading,
    loadAnnouncements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  }

  return React.createElement(AnnouncementContext.Provider, { value }, children as any)
}

export const useAnnouncementStore = (): AnnouncementStoreValue => {
  const ctx = useContext(AnnouncementContext)
  if (!ctx) throw new Error('useAnnouncementStore must be used within AnnouncementProvider')
  return ctx
}

export default useAnnouncementStore
