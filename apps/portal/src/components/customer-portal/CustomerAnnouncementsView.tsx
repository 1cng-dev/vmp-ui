import React, { useEffect } from 'react'
import useAnnouncementStore from '../../store/announcementStore'
import { CircularSpinner } from '../ui/ui'

export const CustomerAnnouncementsView: React.FC = () => {
  const { announcements, loadAnnouncements, announcementsLoading } = useAnnouncementStore()

  useEffect(() => {
    if (announcements.length === 0) {
      loadAnnouncements()
    }
  }, [loadAnnouncements, announcements.length])

  const sentAnnouncements = announcements.filter((a: any) => a.status === 'Sent')

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-subtitle">Latest updates and news from the VPS Myanmar team</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Title</th><th>Body</th><th>Sent</th></tr></thead>
            <tbody>
              {announcementsLoading ? (
                <tr><td colSpan={3}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
              ) : sentAnnouncements.map((a: any) => (
                <tr key={a.id}>
                  <td><div className="fw-6">{a.title}</div></td>
                  <td><div className="text-sm text-mute">{a.body}</div></td>
                  <td className="tnum text-sm">{a.sent_at ? new Date(a.sent_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {!announcementsLoading && sentAnnouncements.length === 0 && <tr><td colSpan={3}><div className="empty"><div className="title">No announcements yet</div><div className="sub">Check back later for updates from the team.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
