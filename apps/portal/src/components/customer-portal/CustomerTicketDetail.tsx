import React, { useState } from 'react'
import useTicketStore from '../../store/ticketStore'
import useCustomerStore from '../../store/customerStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill } from '../ui/ui'
import { supabase } from '../../lib/supabase'

interface CustomerTicketDetailProps {
  ticket: any
  onClose: () => void
  openModal?: (kind: string, props?: any) => void
}

export const CustomerTicketDetail: React.FC<CustomerTicketDetailProps> = ({ ticket: initial, onClose, openModal }) => {
  const { tickets, deleteTicket, setTicketStatus, replyTicket } = useTicketStore()
  const { customers } = useCustomerStore()
  const ticket = tickets.find((t: any) => t.id === initial.id) || initial
  const [replyBody, setReplyBody] = useState('')
  const [replyAttachments, setReplyAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleClose = () => {
    if (openModal) {
      openModal('confirm', {
        title: 'Close ticket',
        message: 'Are you sure you want to close this ticket? You can create a new ticket if you need more help.',
        onConfirm: () => setTicketStatus(ticket.id, 'Closed')
      })
    } else {
      setShowCloseConfirm(true)
    }
  }

  const handleDelete = () => {
    if (openModal) {
      openModal('confirm', {
        title: 'Delete ticket',
        message: 'Are you sure you want to delete this ticket? This action cannot be undone.',
        onConfirm: () => {
          deleteTicket(ticket.id)
          onClose()
        }
      })
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileName = `ticket-reply-${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('ticket-attachments').upload(fileName, file)
        
        if (error) throw error
        
        const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(fileName)
        return publicUrl
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setReplyAttachments([...replyAttachments, ...uploadedUrls])
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files')
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = ''
    }
  }

  const handleReply = async () => {
    if (!replyBody.trim() && replyAttachments.length === 0) return
    try {
      await replyTicket(ticket.id, 'Customer', replyBody, replyAttachments)
      setReplyBody('')
      setReplyAttachments([])
    } catch (error) {
      console.error('Error replying to ticket:', error)
    }
  }

  const removeAttachment = (url: string) => {
    setReplyAttachments(replyAttachments.filter(a => a !== url))
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to tickets</button>
            <span className="mono text-xs text-mute">{ticket.legacy_id || ticket.id}</span>
          </div>
          <h1 className="page-title">{ticket.subject}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={ticket.status}/>
            <span className={`pill ${ticket.priority === 'Urgent' ? 'bad' : ticket.priority === 'Low' ? 'subtle' : 'warn'}`}><span className="dot"/>{ticket.priority}</span>
            <span className="pill subtle">Opened {new Date(ticket.created_at).toLocaleDateString()}</span>
            {ticket.category && <span className="pill subtle">{ticket.category}</span>}
          </div>
        </div>
        <div className="page-actions">
          {ticket.status === 'Open' && <button className="btn" onClick={handleClose}>Close ticket</button>}
          <button className="btn danger" onClick={handleDelete}><Icon name="trash" size={12}/></button>
        </div>
      </div>

      <div className="grid-asym">
        {/* Conversation */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Conversation</h3>
            <span className="text-xs text-mute">{(ticket.replies || []).length + 1} message{(ticket.replies || []).length === 0 ? '' : 's'}</span>
          </div>
          <div className="card-body">
            {/* Original */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div className="flex center gap-2 mb-1">
                  <Avatar name={customers.find((c: any) => c.id === ticket.customer_id)?.name || 'Customer'} size={28}/>
                  <div className="fw-6 text-sm">Me</div>
                  <div className="text-xs text-mute">{new Date(ticket.created_at).toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 12, borderBottomLeftRadius: 4 }}>
                  <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.body}</div>
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="flex col gap-1" style={{ marginTop: 8, alignItems: 'flex-start' }}>
                      {ticket.attachments.map((url: string, j: number) => (
                        <button key={j} className="btn sm" onClick={() => window.open(url, '_blank')}>
                          <Icon name="attach" size={11}/> Attachment {j + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            {(ticket.replies || []).map((r: any, i: number) => (
              <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: r.who === 'Support Team' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: r.who === 'Support Team' ? 'flex-end' : 'flex-start' }}>
                  <div className="flex center gap-2 mb-1">
                    {r.who === 'Customer' && <Avatar name="Me" size={24}/>}
                    {r.who === 'Support Team' && <Avatar name={r.who} size={24}/>}
                    <div className="fw-6 text-sm">{r.who === 'Customer' ? 'Me' : r.who}</div>
                    <div className="text-xs text-mute">{new Date(r.when).toLocaleString()}</div>
                  </div>
                  <div style={{ 
                    background: 'var(--surface-2)', 
                    color: 'var(--ink-1)',
                    padding: '12px 16px', 
                    borderRadius: 12, 
                    borderBottomRightRadius: r.who === 'Support Team' ? 4 : 12,
                    borderBottomLeftRadius: r.who === 'Customer' ? 4 : 12
                  }}>
                    <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.body}</div>
                    {r.attachments && r.attachments.length > 0 && (
                      <div className="flex col gap-1" style={{ marginTop: 8, alignItems: 'flex-start' }}>
                        {r.attachments.map((url: string, j: number) => (
                          <button key={j} className="btn sm" onClick={() => window.open(url, '_blank')}>
                            <Icon name="attach" size={11}/> Attachment {j + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {ticket.status === 'Open' && (
            <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
              {replyAttachments.length > 0 && (
                <div className="flex col gap-1" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                  {replyAttachments.map((url, i) => (
                    <div key={i} className="flex center gap-2" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6 }}>
                      <span className="text-xs text-mute" style={{ flex: 1 }}>Attachment {i + 1}</span>
                      <button className="icon-btn" onClick={() => removeAttachment(url)}><Icon name="x" size={12}/></button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Type your reply here…"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5, resize: 'vertical', marginBottom: 8 }}
              />
              <div className="flex between">
                <div className="flex gap-2">
                  <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} id="reply-file-upload" />
                  <label htmlFor="reply-file-upload" className="btn sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                    <Icon name="attach" size={11}/> {uploading ? 'Uploading...' : 'Attach files'}
                  </label>
                </div>
                <button className="btn primary" onClick={handleReply} disabled={!replyBody.trim() && replyAttachments.length === 0}><Icon name="send" size={12}/>Send reply</button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="flex col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Ticket info</h3></div>
            <div className="card-body">
              <dl className="dl">
                <dt>Ticket ID</dt><dd className="mono">{ticket.legacy_id || ticket.id}</dd>
                <dt>Category</dt><dd>{ticket.category || <span className="text-mute">Not specified</span>}</dd>
                <dt>Status</dt><dd><StatusPill status={ticket.status}/></dd>
                <dt>Priority</dt><dd><span className={`pill ${ticket.priority === 'Urgent' ? 'bad' : ticket.priority === 'Low' ? 'subtle' : 'warn'}`}><span className="dot"/>{ticket.priority}</span></dd>
                <dt>Created</dt><dd className="tnum">{new Date(ticket.created_at).toLocaleString()}</dd>
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <>
                    <dt>Attachments</dt>
                    <dd>
                      <div className="flex col gap-1">
                        {ticket.attachments.map((url: string, i: number) => (
                          <button key={i} className="btn sm" onClick={() => window.open(url, '_blank')}>
                            <Icon name="attach" size={11}/> Attachment {i + 1}
                          </button>
                        ))}
                      </div>
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Actions</h3></div>
            <div className="card-body">
              <div className="flex col gap-2">
                <div className="text-xs text-mute">
                  {ticket.status === 'Open' ? 'Ticket is open for team response. Close when you are satisfied with the resolution.' : 'Ticket is closed. Create a new ticket if you need more help.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCloseConfirm && (
        <div className="modal-overlay" onClick={() => setShowCloseConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Close ticket</h3>
              <button className="icon-btn" onClick={() => setShowCloseConfirm(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="text-sm">Are you sure you want to close this ticket? You can create a new ticket if you need more help.</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowCloseConfirm(false)}>Cancel</button>
              <button className="btn accent" onClick={() => {
                setTicketStatus(ticket.id, 'Closed')
                setShowCloseConfirm(false)
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Delete ticket</h3>
              <button className="icon-btn" onClick={() => setShowDeleteConfirm(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="text-sm">Are you sure you want to delete this ticket? This action cannot be undone.</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn danger" onClick={() => {
                deleteTicket(ticket.id)
                onClose()
                setShowDeleteConfirm(false)
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
