import React, { useState, useEffect } from 'react'
import useUIStore from '../../store/uiStore'
import useAnnouncementStore from '../../store/announcementStore'
import Icon from '../../lib/icons'
import { CircularSpinner } from '../ui/ui'

export const AnnouncementsView: React.FC = () => {
  const { toast } = useUIStore()
  const { announcements, announcementsLoading, loadAnnouncements, addAnnouncement } = useAnnouncementStore()
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (announcements.length === 0) {
      loadAnnouncements()
    }
  }, [loadAnnouncements, announcements.length])

  const submit = async () => {
    setSubmitting(true)
    try {
      await addAnnouncement({
        title: form.title,
        body: form.body,
        status: 'Sent',
        sent_at: null,
        created_by: null,
      })
      toast('Announcement sent to all customers', 'ok')
      setComposing(false)
      setForm({ title: '', body: '' })
    } catch (error) {
      toast('Failed to send announcement', 'bad')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-subtitle">Broadcast messages to all customers. {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setComposing(true)}><Icon name="plus" size={13}/>New announcement</button>
        </div>
      </div>

      {composing && (
        <div className="card mb-4">
          <div className="card-head">
            <h3 className="card-title">New announcement</h3>
            <button className="icon-btn" onClick={() => setComposing(false)}><Icon name="x" size={14}/></button>
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="field"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
              <div className="field"><label>Body</label><textarea rows={5} value={form.body} onChange={e => setForm({...form, body: e.target.value})}/></div>
              <div className="flex gap-2 mt-1">
                <div style={{ flex: 1 }}/>
                <button className="btn ghost" onClick={() => setComposing(false)} disabled={submitting}>Cancel</button>
                <button className="btn accent" disabled={!form.title || !form.body || submitting} onClick={submit}>
                  {submitting ? <span style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: 6 }}><CircularSpinner size={14} /></span>Sending...</span> : <><Icon name="mail" size={12}/>Send to customers</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Title</th><th>Body</th><th>Created by</th><th>Sent</th></tr></thead>
            <tbody>
              {announcementsLoading ? (
                <tr><td colSpan={4}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
              ) : announcements.map((a: any) => (
                <tr key={a.id}>
                  <td><div className="fw-6">{a.title}</div></td>
                  <td><div className="text-sm text-mute">{a.body}</div></td>
                  <td className="text-sm text-mute">{a.created_by_name || 'System'}</td>
                  <td className="tnum text-sm">{a.sent_at ? new Date(a.sent_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {!announcementsLoading && announcements.length === 0 && <tr><td colSpan={4}><div className="empty"><div className="title">No announcements yet</div><div className="sub">Create an announcement to broadcast messages to all customers.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
