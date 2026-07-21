import React from 'react'
import Icon from '../../lib/icons'
import { Avatar } from '../ui/ui'
import { useAuth } from '../auth/Auth'
import { useCustomerStore } from '../../store/customerStore'
import { useVMRequestStore } from '../../store/vmRequestStore'
import useTicketStore from '../../store/ticketStore'
import { useAlertStore } from '../../store/alertStore'
import useInvoiceStore from '../../store/invoiceStore'
import { useQuoteStore } from '../../store/quoteStore'
import { useAddonRequestStore } from '../../store/addonRequestStore'
import { useSystemSettingsStore } from '../../store/systemSettingsStore'

interface NavItem {
  section?: string
  id?: string
  label?: string
  icon?: string
  badge?: number
}

interface SidebarProps {
  view: string
  setView: (view: string) => void
  role: string
  roleNames?: Record<string, string>
  onAccountClick?: () => void
  onLogout?: () => void
}

interface TopbarProps {
  crumbs: string[]
  actions?: React.ReactNode
  theme: string
  setTheme: (theme: string) => void
  onBellClick?: () => void
  onSearchClick?: () => void
  onHelpClick?: () => void
  unread?: number
}



export const Sidebar: React.FC<SidebarProps> = ({ view, setView, role, roleNames = {}, onAccountClick, onLogout }) => {
  const { customers, loadCustomers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { tickets } = useTicketStore()
  const { alerts } = useAlertStore()
  const { invoices, loadInvoices } = useInvoiceStore()
  const { quotes } = useQuoteStore()
  const { addonRequests } = useAddonRequestStore()
  const pendingKycCount = customers.filter((c: any) => c.kyc_status === 'Pending').length
  const openTicketsCount = tickets.filter((t: any) => t.status === 'Open').length
  const unreadAlertsCount = alerts.filter((a: any) => !a.read).length
  const customerTransferredInvoicesCount = invoices.filter((i: any) => i.status === 'Customer Transferred').length
  const sentQuotesCount = quotes.filter((q: any) => q.status === 'Sent').length
  const pendingAddonRequestsCount = addonRequests.filter((a: any) => a.status === 'Pending').length
  const inProgressAddonRequestsCount = addonRequests.filter((a: any) => ['In Progress', 'Network', 'Testing'].includes(a.status)).length

  React.useEffect(() => {
    loadCustomers()
    loadInvoices()
  }, [loadCustomers, loadInvoices])

  // Calculate request counts based on role and status
  const getRequestCountForRole = () => {
    if (role === 'Sales') {
      // Sales sees pending requests
      return vmRequests.filter((r: any) => r.status === 'Pending').length
    } else if (role === 'Engineer') {
      // Engineer sees in-progress requests for new, change-plan, renewal, and trial
      return vmRequests.filter((r: any) => 
        ['In Progress', 'Provisioning', 'Network', 'Testing'].includes(r.status) &&
        (r.task_type === 'New' || r.task_type === 'change-plan' || r.task_type === 'Renewal' || r.request_type === 'trial')
      ).length
    } else if (role === 'Finance') {
      // Finance sees Approved requests
      return vmRequests.filter((r: any) => r.status === 'Approved').length
    } else if (role === 'Admin') {
      // Admin sees all requests
      return vmRequests.length
    }
    return 0
  }

  const pendingRequestsCount = getRequestCountForRole()

  React.useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const NAV: NavItem[] = [
    { section: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'alerts', label: 'Notifications', icon: 'bell', badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined },
    { id: 'calendar', label: 'Calendar', icon: 'clock' },
    { id: 'activity', label: 'Activity log', icon: 'activity' },
    { section: 'Operations' },
    { id: 'vms', label: 'VM records', icon: 'server' },
    { id: 'tasks', label: 'Customer Requests', icon: 'tasks', badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined },
    { id: 'addons', label: 'Add-on Services', icon: 'box', badge: (role === 'Sales' ? pendingAddonRequestsCount : inProgressAddonRequestsCount) > 0 ? (role === 'Sales' ? pendingAddonRequestsCount : inProgressAddonRequestsCount) : undefined },
    { id: 'network', label: 'Network & IPs', icon: 'network' },
    { section: 'Engineering' },
    { id: 'console', label: 'Web console', icon: 'cpu' },
    { id: 'nodes', label: 'Proxmox nodes', icon: 'server' },
    { id: 'topology', label: 'Topology', icon: 'network' },
    { id: 'snapshots', label: 'Snapshots', icon: 'database' },
    { id: 'maintenance', label: 'Maintenance', icon: 'sliders' },
    { id: 'patches', label: 'Patch queue', icon: 'box' },
    { id: 'firewall', label: 'Firewall rules', icon: 'shield' },
    { section: 'Customers' },
    { id: 'customers', label: 'Customers', icon: 'users' },
    { id: 'customer-accounts', label: 'Account management', icon: 'shield' },
    { id: 'kyc', label: 'KYC review', icon: 'shield', badge: pendingKycCount > 0 ? pendingKycCount : undefined },
    { id: 'tickets', label: 'Support tickets', icon: 'mail', badge: openTicketsCount > 0 ? openTicketsCount : undefined },
    { section: 'Sales' },
    { id: 'pipeline', label: 'Pipeline', icon: 'tasks' },
    { id: 'quotes', label: 'Quotes', icon: 'file' },
    { id: 'followups', label: 'Follow-ups', icon: 'clock' },
    { id: 'trials', label: 'Trial conversions', icon: 'box' },
    { section: 'Finance' },
    { id: 'quote-review', label: 'Quote Review', icon: 'file', badge: sentQuotesCount > 0 ? sentQuotesCount : undefined },
    { id: 'finance', label: 'Invoices', icon: 'invoice', badge: customerTransferredInvoicesCount > 0 ? customerTransferredInvoicesCount : undefined },
    { id: 'receipts', label: 'Receipts', icon: 'check' },
    { id: 'reports', label: 'Reports', icon: 'box' },
    { id: 'aging', label: 'Aging receivables', icon: 'clock' },
    // { id: 'reconciliation', label: 'Reconciliation', icon: 'check' },
    // { id: 'recurring', label: 'Recurring billing', icon: 'refresh' },
    // { id: 'tax', label: 'Tax / VAT', icon: 'file' },
    { section: 'Admin' },
    { id: 'team', label: 'Team & roles', icon: 'lock' },
    { id: 'settings', label: 'System settings', icon: 'settings' },
    { id: 'health', label: 'System health', icon: 'activity' },
    { id: 'audit', label: 'Audit log', icon: 'eye' },
    { id: 'announcements', label: 'Announcements', icon: 'mail' },
    { id: 'apikeys', label: 'API & webhooks', icon: 'key' },
    { id: 'backups', label: 'Backup center', icon: 'database' },
  ]

  // Filter badges based on role - only show badges for items visible to the role
  const getBadgeForRole = (itemId: string | undefined, badgeValue: number | undefined): number | undefined => {
    if (!itemId || badgeValue === undefined) return undefined
    
    // Define which roles can see which badges
    const badgeVisibility: Record<string, Set<string>> = {
      'tasks': new Set(['Sales', 'Engineer']),
      'addons': new Set(['Sales', 'Engineer', 'Finance']),
      'kyc': new Set(['Sales', 'Admin']),
      'tickets': new Set(['Sales', 'Engineer', 'Finance', 'Admin']),
      'finance': new Set(['Finance', 'Admin']),
      'quote-review': new Set(['Finance', 'Admin']),
    }
    
    const allowedRoles = badgeVisibility[itemId]
    if (!allowedRoles || allowedRoles.has(role)) {
      return badgeValue
    }
    return undefined
  }


  const auth = useAuth()
  const userName = auth?.user?.name || auth?.user?.email?.split('@')[0] || 'User'
  const roleLabel = roleNames[role] || role
  const HIDDEN = new Set(['calendar', 'network', 'console', 'nodes', 'topology', 'snapshots', 'maintenance', 'patches', 'firewall', 'health', 'apikeys', 'backups', 'pipeline', 'followups', 'trials'])
  const items = (role === 'Customer' ? [
    { id: 'cust-vms', label: 'My VMs', icon: 'server' },
    { id: 'cust-invoices', label: 'Invoices & receipts', icon: 'invoice' },
    { id: 'cust-announcements', label: 'Announcements', icon: 'mail' },
    { id: 'cust-profile', label: 'Profile', icon: 'users' },
  ] : NAV).filter(it => it.section || (it.id && !HIDDEN.has(it.id)))

  const allowedFor: Record<string, Set<string> | null> = {
    'Sales': new Set(['dashboard', 'alerts', 'calendar', 'activity', 'vms', 'tasks', 'addons', 'customers', 'customer-accounts', 'kyc', 'quotes', 'finance', 'receipts', 'announcements']),
    'Engineer': new Set(['dashboard', 'alerts', 'calendar', 'activity', 'vms', 'tasks', 'addons', 'network', 'console', 'nodes', 'topology', 'snapshots', 'maintenance', 'patches', 'firewall', 'announcements']),
    'Finance': new Set(['dashboard', 'alerts', 'calendar', 'vms', 'tasks', 'finance', 'receipts', 'quote-review', 'reports', 'customers', 'customer-accounts', 'aging', 'announcements']),
    'Admin': null,
  }
  const allow = allowedFor[role]
  const { settings } = useSystemSettingsStore()

  return (
    <aside className="sidebar">
      <div className="brand">
        {settings?.logo_url
          ? <img src={`${settings.logo_url}?v=${settings.updated_at}`} alt="Logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }} />
          : <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 8, fontSize: 24, display: 'grid', placeItems: 'center' }}>V</div>}
        <div>
          <div className="brand-name">{settings?.company_name || 'VM Portal'}</div>
          <div className="brand-sub">{role === 'Customer' ? 'Customer view' : 'Operations'}</div>
        </div>
      </div>
      <nav className="nav">
        {items.map((it, i) => {
          if (it.section) {
            const nextSection = items.findIndex((x, idx) => idx > i && x.section)
            const slice = items.slice(i + 1, nextSection === -1 ? items.length : nextSection)
            const visibleSlice = slice.filter(x => !allow || (x.id && allow.has(x.id)))
            if (visibleSlice.length === 0) return null
            return <div key={i} className="nav-section">{it.section}</div>
          }
          if (allow && it.id && !allow.has(it.id)) return null
          return (
            <button key={it.id}
              className={`nav-item ${view === it.id ? 'active' : ''}`}
              onClick={() => it.id && setView(it.id)}>
              <Icon name={it.icon || 'server'} className="nav-icon" />
              <span>{it.label}</span>
              {getBadgeForRole(it.id, it.badge) !== undefined && <span className="nav-badge">{getBadgeForRole(it.id, it.badge)}</span>}            </button>
          )
        })}
      </nav>
      <div className="nav-user" style={{ cursor: onAccountClick ? 'pointer' : 'default' }} onClick={onAccountClick}>
        <Avatar name={userName} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="who">{userName}</div>
          <div className="role">{roleLabel}</div>
        </div>
        <button className="icon-btn" title="Sign out" onClick={onLogout}><Icon name="logout" size={14} /></button>
      </div>
    </aside>
  )
}

export const Topbar: React.FC<TopbarProps> = ({ crumbs, actions, theme, setTheme, onBellClick, onSearchClick, onHelpClick, unread }) => (
  <div className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevron-right" size={12} className="sep" />}
          {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
        </React.Fragment>
      ))}
    </div>
    <div className="topbar-spacer" />
    <div className="search" onClick={onSearchClick}>
      <Icon name="search" size={14} className="search-icon" />
      <input placeholder="Search VMs, customers, invoices…" readOnly style={{ cursor: 'pointer' }} />
      <span className="kbd">⌘K</span>
    </div>
    <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
    </button>
    <button className="icon-btn" onClick={onHelpClick} title="Keyboard shortcuts (?)">
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>?</span>
    </button>
    <button className="icon-btn" onClick={onBellClick} title="Notifications">
      <Icon name="bell" size={15} />
      {unread && unread > 0 && <span className="dot" />}
    </button>
    {actions}
  </div>
)
