import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import useUIStore from '@/store/uiStore'

const log2faActivity = async (text: string, userId: string, meta: Record<string, unknown>) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase
      .from('team_members')
      .select('name, staff_code')
      .eq('user_id', userId)
      .single()
    const staffLabel = staff
      ? `${staff.name} (${staff.staff_code || userId})`
      : userId
    const { error } = await supabase.from('activity_log').insert({
      actor: user?.email || 'admin',
      actor_role: 'staff',
      kind: 'auth',
      text: `${text} for ${staffLabel}`,
      meta: { ...meta, staff_id: userId }
    })
    if (error) throw error
  } catch (err) {
    console.error('activity log error:', err)
  }
}

interface Props {
  userId: string
  name: string
  staffCode?: string
  initial: { mfa_required: boolean; mfa_disabled: boolean }
  onUpdate: (patch: any) => Promise<void>
}

export const TeamSecurity: React.FC<Props> = ({ userId, name, initial, onUpdate }) => {
  const { toast } = useUIStore()
  const [disabled, setDisabled] = useState(initial.mfa_disabled)

  const toggleDisabled = async () => {
    const next = !disabled
    try {
      const patch: any = { mfa_disabled: next }
      if (next) patch.mfa_required = false
      await onUpdate(patch)

      if (next) {
        const { error } = await supabase.functions.invoke('admin-delete-mfa', { body: { userId } })
        if (error) throw error
        toast(`2FA disabled and factors removed for ${name}`, 'ok')
        await log2faActivity('Admin disabled 2FA', userId, {
          event: 'mfa_admin_disabled'
        })
      } else {
        toast(`2FA allowed again for ${name}. Staff must re-enable.`, 'ok')
        await log2faActivity('Admin allowed 2FA', userId, {
          event: 'mfa_admin_enabled'
        })
      }

      setDisabled(next)
    } catch (error: any) {
      toast(error.message || 'Failed to update', 'bad')
    }
  }

  return (
    <div className="flex col gap-3">
      <div className="flex center between">
        <div>
          <div className="fw-6 text-sm">Disable 2FA</div>
          <div className="text-xs text-mute">Block 2FA and remove factors</div>
        </div>
        <span
          className={`toggle ${disabled ? 'on' : ''}`}
          onClick={toggleDisabled}
          style={{ cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}
