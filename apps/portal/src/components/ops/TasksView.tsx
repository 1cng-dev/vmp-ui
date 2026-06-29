import React, { useState } from 'react'
import useTaskStore from '../../store/taskStore'
import useCustomerStore from '../../store/customerStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill } from '../ui/ui'

interface TasksViewProps {
  openModal: (kind: string, props?: any) => void
  openTask: (id: string) => void
  setView?: (view: string) => void
  setAutoOpenQuote?: (value: boolean) => void
}

export const TasksView: React.FC<TasksViewProps> = ({ openModal, openTask, setView, setAutoOpenQuote }) => {
  const { tasks, deleteTask } = useTaskStore()
  const { customers } = useCustomerStore()
  const [filter, setFilter] = useState('all')

  let filteredTasks = tasks
  if (filter === 'urgent') filteredTasks = filteredTasks.filter(t => t.priority === 'Urgent')
  else if (filter === 'mine') filteredTasks = filteredTasks.filter(t => t.assignee === 'Ko Thein')
  else if (filter !== 'all') filteredTasks = filteredTasks.filter(t => t.type === filter)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customer Requests</h1>
          <p className="page-subtitle">{filteredTasks.length} requests · {filteredTasks.filter(t => t.status === 'Blocked').length} blocked · {filteredTasks.filter(t => t.priority === 'Urgent').length} urgent</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => openModal('newtask')}><Icon name="plus" size={13}/>New request</button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 wrap">
        {[
          { id: 'all', label: 'All requests' },
          { id: 'urgent', label: 'Urgent only' },
          { id: 'mine', label: 'Assigned to me' },
          { id: 'New', label: 'New' },
          { id: 'Renewal', label: 'Renewal' },
          { id: 'Upgrade', label: 'Upgrade' },
          { id: 'Terminate', label: 'Terminate' },
        ].map(f => (
          <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Request</th><th>Customer</th><th>Service type</th><th>Type</th><th>Priority</th><th>Assigned to</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filteredTasks.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="title">No requests yet</div><div className="sub">Click "New request" to create your first.</div></div></td></tr>}
              {filteredTasks.map(t => {
                const c = customers.find(c => c.id === t.customer)
                return (
                  <tr key={t.id} onClick={() => openTask(t.id)}>
                    <td>
                      <div className="fw-6">{t.title}</div>
                      <div className="text-xs text-mute mono">{t.id}</div>
                    </td>
                    <td>
                      <div className="flex center gap-2">
                        <Avatar name={c?.company || 'Unknown'} size={22}/>
                        <span className="text-sm">{c?.company || 'Unknown'}</span>
                      </div>
                    </td>
                    <td>
                      {t.notes?.includes('(standard)') 
                        ? <span className="pill subtle">Standard</span> 
                        : t.notes?.includes('(premium)') 
                          ? <span className="pill accent">Premium</span>
                          : <span className="pill subtle">Standard</span>}
                    </td>
                    <td><span className="pill subtle">{t.type}</span></td>
                    <td>
                      {t.priority === 'Urgent' ? <span className="pill bad"><span className="dot"/>Urgent</span> : <span className="text-sm text-mute">Normal</span>}
                    </td>
                    <td>
                      {t.assignee !== '—' 
                        ? <div className="flex center gap-2"><Avatar name={t.assignee} size={22}/><span className="text-sm">{t.assignee}</span></div> 
                        : <span className="text-mute text-sm">Unassigned</span>}
                    </td>
                    <td><StatusPill status={t.status}/></td>
                    <td className="right">
                      <div className="flex center gap-1">
                        <button className="icon-btn" onClick={e => { e.stopPropagation(); deleteTask(t.id); }} title="Delete">
                          <Icon name="trash" size={11}/>
                        </button>
                        {t.type === 'New' ? (
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); setAutoOpenQuote && setAutoOpenQuote(true); setView && setView('quotes'); }}>
                            Quotation
                          </button>
                        ) : (
                          <div style={{ width: 70 }}></div>
                        )}
                        <Icon name="chevron-right" size={12} className="text-mute"/>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
