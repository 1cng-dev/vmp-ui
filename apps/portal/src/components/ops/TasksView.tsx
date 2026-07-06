import React, { useState } from 'react'
import useCustomerStore from '../../store/customerStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useQuoteStore from '../../store/quoteStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill } from '../ui/ui'

interface TasksViewProps {
  openModal: (kind: string, props?: any) => void
  openTask: (id: string) => void
  setView?: (view: string) => void
  setAutoOpenQuote?: (value: boolean) => void
  setPrefillCustomerId?: (id: string) => void
  setPrefillRequestId?: (id: string) => void
  userRole?: string
}

export const TasksView: React.FC<TasksViewProps> = ({ openModal, openTask, setView, setAutoOpenQuote, setPrefillCustomerId, setPrefillRequestId, userRole }) => {
  const { customers, loadCustomers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { quotes } = useQuoteStore()
  const [filter, setFilter] = useState('all')

  // Load customers if not loaded yet
  React.useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [customers.length, loadCustomers])

  // Sales sees all requests, Engineer sees only approved requests
  let filteredTasks = vmRequests
  if (userRole !== 'Sales') {
    filteredTasks = filteredTasks.filter(t => ['In Progress', 'Provisioning', 'Network', 'Testing', 'Completed'].includes(t.status))
  }
  if (filter === 'provision') filteredTasks = filteredTasks.filter(t => t.request_type === 'trial' || t.request_type === 'paid')
  else if (filter !== 'all') filteredTasks = filteredTasks.filter(t => t.request_type === filter.toLowerCase())

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customer Requests</h1>
          <p className="page-subtitle">{filteredTasks.length} requests · {userRole === 'Sales' ? `${vmRequests.filter(t => t.status === 'Pending').length} pending` : 'approved only'}</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => openModal('newtask')}><Icon name="plus" size={13}/>New request</button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 wrap">
        {[
          { id: 'all', label: 'All requests' },
          { id: 'provision', label: 'Provision' },
          { id: 'trial', label: 'Trial' },
          { id: 'paid', label: 'Paid' },
        ].map(f => (
          <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Request</th><th>Customer</th><th>Service type</th><th>Type</th><th>Status</th><th>Quote</th><th></th></tr></thead>
            <tbody>
              {filteredTasks.length === 0 && <tr><td colSpan={7}><div className="empty"><div className="title">No requests yet</div><div className="sub">Waiting for customer VM requests.</div></div></td></tr>}
              {filteredTasks.map(t => {
                const c = customers.find(c => c.id === t.customer_id)
                const quote = quotes.find(q => q.vm_request_id === t.id)
                return (
                  <tr key={t.id} onClick={() => openTask(t.id)}>
                    <td>
                      <div className="fw-6">{t.hostname}</div>
                      <div className="text-xs text-mute mono">{t.legacy_id || t.id}</div>
                    </td>
                    <td>
                      <div className="flex center gap-2">
                        <Avatar name={c?.name || c?.org_name || 'Unknown'} size={22}/>
                        <div className="flex col">
                          <span className="text-sm fw-6">{c?.name || 'Unknown'}</span>
                          {c?.org_name && <span className="text-xs text-mute">{c.org_name}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="pill subtle">{t.sizing || 'Standard'}</span>
                    </td>
                    <td><span className="pill subtle">{t.task_type || 'New'}</span></td>
                    <td><StatusPill status={t.status}/></td>
                    <td>
                      {quote ? (
                        <span className={`pill ${quote.status === 'Accepted' ? 'ok' : quote.status === 'Rejected' ? 'danger' : quote.status === 'Sent' ? 'warn' : 'subtle'}`}>
                          <span className="dot"/>Quote: {quote.status}
                        </span>
                      ) : (
                        <span className="text-sm text-mute">No quote</span>
                      )}
                    </td>
                    <td className="right">
                      <div className="flex center gap-1">
                        <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); setPrefillCustomerId && setPrefillCustomerId(t.customer_id); setPrefillRequestId && setPrefillRequestId(t.id); setAutoOpenQuote && setAutoOpenQuote(true); setView && setView('quotes'); }}>
                          {quote ? 'New Quote' : 'Quotation'}
                        </button>
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
