import React, { useState, useRef } from 'react'
import useTicketStore from '../../store/ticketStore'
import useCustomerStore from '../../store/customerStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill } from '../ui/ui'
import { uploadTicketAttachment } from '../../lib/storage'

interface TeamTicketDetailProps {
  ticket: any
  onClose: () => void
  openModal?: (kind: string, props?: any) => void
}

export const TeamTicketDetail: React.FC<TeamTicketDetailProps> = ({ ticket: initial, onClose, openModal }) => {
  const { tickets, setTicketStatus, replyTicket } = useTicketStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const ticket = tickets.find((t: any) => t.id === initial.id) || initial
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const customer = customers.find((c: any) => c.id === ticket.customer_id)

  const onReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || [])
    setReplyFiles(list)
  }

  const sendReply = async () => {
    if (!reply.trim() && replyFiles.length === 0) return
    try {
      // Upload files first
      const attachmentUrls: string[] = []
      if (replyFiles.length > 0) {
        for (const file of replyFiles) {
          try {
            console.log('Uploading reply file:', file.name)
            const url = await uploadTicketAttachment(file)
            console.log('Reply file uploaded:', url)
            attachmentUrls.push(url)
          } catch (err) {
            console.error('Failed to upload reply file:', file.name, err)
            toast(`Failed to upload ${file.name}`, 'bad')
          }
        }
      }

      await replyTicket(ticket.id, 'Support Team', reply, attachmentUrls)
      toast('Reply sent', 'ok')
      setReply('')
      setReplyFiles([])
    } catch (error) {
      toast('Error sending reply', 'bad')
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      await setTicketStatus(ticket.id, status)
      toast(`Ticket marked as ${status}`, 'ok')
    } catch (error) {
      toast('Error updating status', 'bad')
    }
  }

  const handleReopen = () => {
    if (openModal) {
      openModal('confirm', {
        title: 'Reopen ticket',
        message: 'Are you sure you want to reopen this ticket?',
        onConfirm: () => handleStatusChange('Open')
      })
    } else {
      if (confirm('Are you sure you want to reopen this ticket?')) {
        handleStatusChange('Open')
      }
    }
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
            {ticket.assignee !== '—' && <span className="pill subtle">Assigned: {ticket.assignee}</span>}
          </div>
        </div>
        <div className="page-actions">
          {ticket.status === 'Closed' && <button className="btn" onClick={handleReopen}>Reopen ticket</button>}
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
                  <Avatar name={customer?.name || customer?.org_name || 'Customer'} size={28}/>
                  <div className="fw-6 text-sm">{customer?.name && customer?.org_name ? `${customer?.name} (${customer?.org_name})` : customer?.name || customer?.org_name || 'Customer'}</div>
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
                    {r.who === 'Customer' && <Avatar name={customer?.name && customer?.org_name ? `${customer?.name} (${customer?.org_name})` : customer?.name || customer?.org_name || 'Customer'} size={24}/>}
                    {r.who === 'Support Team' && <Avatar name={r.who} size={24}/>}
                    <div className="fw-6 text-sm">{r.who === 'Customer' ? (customer?.name && customer?.org_name ? `${customer?.name} (${customer?.org_name})` : customer?.name || customer?.org_name || 'Customer') : r.who}</div>
                    <div className="text-xs text-mute">{new Date(r.when).toLocaleString()}</div>
                  </div>
                  <div style={{ 
                    background: 'var(--surface-2)', 
                    color: 'var(--ink-1)',
                    padding: '12px 16px', 
                    borderRadius: 12, 
                    borderBottomRightRadius: r.who === 'Support Team' ? 4 : 12,
                    borderBottomLeftRadius: r.who === 'Customer' ? 4 : 12,
                    minHeight: 'auto'
                  }}>
                    <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.body || ''}</div>
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

            {/* Reply box */}
            {ticket.status === 'Open' && (
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                {replyFiles.length > 0 && (
                  <div className="flex col gap-1" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                    {replyFiles.map((f, i) => (
                      <div key={i} className="flex center gap-2" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6 }}>
                        <span className="text-xs text-mute" style={{ flex: 1 }}>{f.name}</span>
                        <button className="icon-btn" onClick={() => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))}><Icon name="x" size={12}/></button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type your reply…"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5, resize: 'vertical', marginBottom: 8 }}
                />
                <div className="flex between">
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={onReplyFileChange} style={{ display: 'none' }} />
                    <button className="btn sm" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="attach" size={11}/> Attach files
                    </button>
                  </div>
                  <button className="btn primary" disabled={!reply.trim()} onClick={sendReply}><Icon name="mail" size={12}/>Send reply</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar info */}
        <div className="flex col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Ticket info</h3></div>
            <div className="card-body">
              <dl className="dl">
                <dt>Ticket ID</dt><dd className="mono">{ticket.legacy_id || ticket.id}</dd>
                <dt>Customer</dt><dd>
                  <div className="fw-6 text-sm">{customer?.org_name || customer?.name || 'Unknown'}</div>
                  <div className="text-xs text-mute">{customer?.name}</div>
                </dd>
                <dt>Category</dt><dd>{ticket.category || <span className="text-mute">Not specified</span>}</dd>
                <dt>Status</dt><dd><StatusPill status={ticket.status}/></dd>
                <dt>Priority</dt><dd>
                  <span className={`pill ${ticket.priority === 'Urgent' ? 'bad' : ticket.priority === 'Low' ? 'subtle' : 'warn'}`}><span className="dot"/>{ticket.priority}</span>
                </dd>
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
                {ticket.status === 'Closed' && <button className="btn" onClick={handleReopen}>Reopen ticket</button>}
                <div className="text-xs text-mute" style={{ marginTop: 8 }}>
                  {ticket.status === 'Open' ? 'Reply to this ticket to respond to the customer.' : 'Ticket is closed.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamTicketDetail
