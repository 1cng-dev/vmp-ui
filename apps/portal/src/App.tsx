import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, Topbar } from './components/layout/Shell'
import { AuthShell, TeamAuthShell, useAuth } from './components/auth/Auth'
import Dashboard from './pages/Dashboard'
import VMList from './pages/VMList'
import AdminDirectVMCreate from './pages/AdminDirectVMCreate'
import VMDrawer from './components/vm/VMDrawer'
import { NewVMModal, RenewModal, SpecModal, TerminateModal, DeleteModal, NewTaskModal, NewCustomerModal, TempPasswordModal, EmailModal, NewInvoiceModal, InviteMemberModal, ConfirmModal } from './components/modals/AdminVMModals'
import CustomersView from './pages/Customers'
import CustomerDrawer from './components/customer/CustomerDrawer'
import { TeamView } from './pages/Team'
import { FinanceView, ReportsView } from './pages/Finance'
import { ReceiptsView } from './pages/ReceiptsView'
import { TasksView, ActivityView, AlertsView, NetworkView, TaskDrawer } from './pages/Ops'
import { CustomerAccountManagementView } from './pages/CustomerAccounts'
import { KYCReviewView } from './pages/KYCReview'
import { AgingView, ReconciliationView, RecurringView, TaxView } from './pages/FinanceExtras'
import { AccountSettingsView } from './pages/AccountSettings'
import { SystemHealthView, AuditLogView, AnnouncementsView, ApiKeysView, BackupCenterView } from './pages/AdminExtras'
import CustomerPortal from './pages/CustomerPortal'
import QuotesView from './pages/QuotesView'
import FinanceQuoteReviewView from './pages/FinanceQuoteReviewView'
import SupportTicketsView from './pages/SupportTicketsView'
import AddonServicesView from './pages/AddonServices'
import Toasts from './components/common/Toasts'
import { CommandPalette, ShortcutsModal, CalendarView } from './components/common/Extras'
import { NotifPanel, PlaceholderView, TweaksUI } from './components/common'
import { useTweaks, TweakState } from './components/common/useTweaks'
import { AlertProvider, useAlertStore } from './store/alertStore'
import { useActivityStore } from './store/activityStore'
import { TicketProvider, useTicketStore } from './store/ticketStore'
import Welcome from './pages/Welcome'
import SetupPassword from './pages/SetupPassword'
import ChangePasswordPage from './pages/ChangePassword'
import { TeamProvider, useTeamStore } from './store/TeamContext'
import useCustomerStore, { CustomerProvider } from './store/customerStore'
import { VMRequestProvider, useVMRequestStore } from './store/vmRequestStore'
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen'
import { QuoteProvider, useQuoteStore } from './store/quoteStore'
import { VMProvider } from './store/vmStore'
import { AddonRequestProvider } from './store/addonRequestStore'
import { InvoiceProvider } from './store/invoiceStore'
import { ReceiptProvider } from './store/receiptStore'
import { ActivityProvider } from './store/activityStore'
import { AnnouncementProvider } from './store/announcementStore'
import { SystemSettingsProvider } from './store/systemSettingsStore'
import Spinner from './components/ui/Spinner'

const ACCENT_MAP: Record<string, number> = {
  '#4F6FE3': 250,
  '#3D9C6E': 155,
  '#C25A4B': 25,
  '#8060D4': 285,
  '#C9883A': 75,
}

// Prefetch customers once at app startup so pages render without initial spinners
const PrefetchCustomers: React.FC = () => {
  const { loadCustomers } = useCustomerStore()
  const auth = useAuth()
  React.useEffect(() => {
    if (auth?.user?.id) {
      loadCustomers().catch(err => console.error('Error loading customers:', err))
    }
  }, [loadCustomers, auth?.user?.id])
  return null
}

// Prefetch team once at app startup so pages render without initial spinners
const PrefetchTeam: React.FC = () => {
  const { loadTeam } = useTeamStore()
  React.useEffect(() => {
    loadTeam()
  }, [loadTeam])
  return null
}

// Prefetch VM requests once at app startup so pages render without initial spinners
const PrefetchVMRequests: React.FC = () => {
  const { loadVMRequests } = useVMRequestStore()
  React.useEffect(() => {
    loadVMRequests()
  }, [loadVMRequests])
  return null
}

const PrefetchQuotes: React.FC = () => {
  const { loadQuotes } = useQuoteStore()
  React.useEffect(() => { loadQuotes() }, [loadQuotes])
  return null
}

const AppInner = ({ tw, setTweak }: { tw: TweakState; setTweak: (keyOrEdits: keyof TweakState | Partial<TweakState>, value?: any) => void }) => {
  const { alerts, alertsLoading, markAllAlertsRead } = useAlertStore()
  const { loadAlerts } = useAlertStore()
  const { loadActivity } = useActivityStore()
  const { loadTickets } = useTicketStore()
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = React.useState(false)

  // Prefetch alerts, activity, and tickets when auth is available
  React.useEffect(() => {
    if (auth?.user?.id) {
      loadAlerts().catch(err => console.error('Error loading alerts:', err))
      loadActivity().catch(err => console.error('Error loading activity:', err))
      loadTickets().catch(err => console.error('Error loading tickets:', err))
    }
  }, [auth?.user?.id, loadAlerts, loadActivity, loadTickets])

  // Ensure minimum display time to prevent flash
  React.useEffect(() => {
    const timer = setTimeout(() => setMinDisplayTimeElapsed(true), 400)
    return () => clearTimeout(timer)
  }, [])

  // Extract view from URL path
  const getPathView = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    if (pathSegments.length >= 2) {
      return pathSegments[1] // Second segment after /admin/ or /
    }
    return 'dashboard'
  }

  const [view, setView] = useState(getPathView)
  const [autoOpenQuote, setAutoOpenQuote] = useState(false)
  const [prefillCustomerId, setPrefillCustomerId] = useState<string | undefined>(undefined)
  const [prefillRequestId, setPrefillRequestId] = useState<string | undefined>(undefined)
  const [prefillRequestType, setPrefillRequestType] = useState<'vm' | 'addon' | undefined>(undefined)
  const [notifOpen, setNotifOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const [modalKind, setModalKind] = useState<string | null>(null)
  const [modalProps, setModalProps] = useState<any>({})
  const [tempPasswordData, setTempPasswordData] = useState<{ email: string; tempPassword: string; name: string } | null>(null)
  const [drawerVmId, setDrawerVmId] = useState<string | null>(null)
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null)
  const [drawerCustId, setDrawerCustId] = useState<string | null>(null)

  const openModal = (kind: string, props: any = {}) => { setModalKind(kind); setModalProps(props) }
  const closeModal = () => { setModalKind(null); setModalProps({}) }
  const openVM = (id: string) => setDrawerVmId(id)
  const closeDrawer = () => setDrawerVmId(null)
  const openTask = (id: string) => setDrawerTaskId(id)
  const closeTaskDrawer = () => setDrawerTaskId(null)
  const openCust = (id: string) => setDrawerCustId(id)
  const closeCustDrawer = () => setDrawerCustId(null)

  const handleSetView = (newView: string) => {
    setView(newView)
    const basePath = location.pathname.split('/')[1] || ''
    navigate(`/${basePath}/${newView}`, { replace: true })
  }

  // Sync view state with URL path changes
  useEffect(() => {
    const currentView = getPathView()
    setView(currentView)

    // Redirect base paths to dashboard
    if (location.pathname === '/admin' || location.pathname === '/') {
      navigate(`${location.pathname}/dashboard`, { replace: true })
    }
  }, [location.pathname])

  // Keyboard shortcuts
  useEffect(() => {
    let gPressed = false, nPressed = false
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true); return }
      if (e.key === 'Escape') { setCmdOpen(false); setNotifOpen(false); setShortcutsOpen(false); return }
      if (inField) return
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return }
      if (e.key === 'g') { gPressed = true; nPressed = false; setTimeout(() => gPressed = false, 1200); return }
      if (e.key === 'n') { nPressed = true; gPressed = false; setTimeout(() => nPressed = false, 1200); return }
      if (gPressed) {
        const map: Record<string, string> = { d: 'dashboard', v: 'vms', c: 'customers', t: 'tasks', f: 'finance', k: 'kyc', a: 'alerts', l: 'activity', r: 'reports', s: 'settings' }
        if (map[e.key]) { handleSetView(map[e.key]); gPressed = false }
        return
      }
      if (nPressed) {
        const m: Record<string, string> = { v: 'newvm', c: 'newcust', t: 'newtask', i: 'email' }
        if (m[e.key]) { openModal(m[e.key]); nPressed = false }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Apply theme + accent
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tw.theme)
    const hue = ACCENT_MAP[tw.accent] || 250
    document.documentElement.style.setProperty('--accent-h', hue.toString())
  }, [tw.theme, tw.accent])

  useEffect(() => {
    console.log('AppInner role changed:', tw.role, 'should render CustomerPortal:', tw.role === 'Customer')
  }, [tw.role])

  const unread = alerts.filter((a: any) => !a.read).length

  // Show full page loading spinner until critical data is loaded and minimum time elapsed
  // Only wait for: auth, team (for admin), alerts
  // Customers data loads progressively in background - don't block on it to avoid RLS issues
  const { teamLoading } = useTeamStore()
  const needsTeamData = tw.role !== 'Customer'
  if (!auth?.user || (needsTeamData && teamLoading) || alertsLoading || !minDisplayTimeElapsed) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', zIndex: 9999 }}>
        <Spinner />
      </div>
    )
  }

  const crumbs: Record<string, string[]> = {
    'dashboard': ['Overview', 'Dashboard'],
    'alerts': ['Overview', 'Notifications'],
    'calendar': ['Overview', 'Expiry calendar'],
    'activity': ['Overview', 'Activity log'],
    'vms': ['Operations', 'VM records'],
    'tasks': ['Operations', 'Provisioning tasks'],
    'addons': ['Operations', 'Add-on Services'],
    'network': ['Operations', 'Network & IPs'],
    'console': ['Engineering', 'Web console'],
    'nodes': ['Engineering', 'Proxmox nodes'],
    'topology': ['Engineering', 'Network topology'],
    'snapshots': ['Engineering', 'Snapshots'],
    'maintenance': ['Engineering', 'Maintenance windows'],
    'patches': ['Engineering', 'Patch queue'],
    'firewall': ['Engineering', 'Firewall rules'],
    'customers': ['Customers', 'All customers'],
    'customer-accounts': ['Customers', 'Customer accounts'],
    'kyc': ['Customers', 'KYC review'],
    'pipeline': ['Sales', 'Pipeline'],
    'quotes': ['Sales', 'Quotes'],
    'followups': ['Sales', 'Follow-ups'],
    'trials': ['Sales', 'Trial conversions'],
    'finance': ['Finance', 'Invoices'],
    'receipts': ['Finance', 'Receipts'],
    'reports': ['Finance', 'Reports'],
    'aging': ['Finance', 'Aging receivables'],
    'reconciliation': ['Finance', 'Reconciliation'],
    'recurring': ['Finance', 'Recurring billing'],
    'tax': ['Finance', 'Tax / VAT report'],
    'team': ['Admin', 'Team & roles'],
    'settings': ['Admin', 'System settings'],
    'health': ['Admin', 'System health'],
    'audit': ['Admin', 'Audit log'],
    'announcements': ['Admin', 'Announcements'],
    'apikeys': ['Admin', 'API & webhooks'],
    'backups': ['Admin', 'Backup center'],
    'account': ['You', 'Account settings'],
    'direct-vm-create': ['VMs', 'Direct VM Creation'],
  }


  return (
    <div className="app">
      {tw.role === 'Customer' ? (
        <CustomerPortal key="customer-portal" setRole={(r: string) => setTweak('role', r)} roleNames={tw.roleNames || {}} />
      ) : (
        <>
          <Sidebar view={view} setView={(v) => { handleSetView(v); setNotifOpen(false) }} role={tw.role} roleNames={tw.roleNames || {}} onAccountClick={() => handleSetView('account')} onLogout={() => auth?.signout()} />
          <div className="main">
            <Topbar
              crumbs={crumbs[view] || ['Dashboard']}
              theme={tw.theme}
              setTheme={(t) => setTweak('theme' as keyof TweakState, t)}
              onBellClick={() => setNotifOpen(!notifOpen)}
              onHelpClick={() => { }}
              unread={unread}
            />
            {notifOpen && <NotifPanel onAllRead={() => { markAllAlertsRead(); setNotifOpen(false) }} onViewAll={() => { handleSetView('alerts'); setNotifOpen(false) }} />}

            {view === 'dashboard' && <Dashboard openVM={openVM} setView={handleSetView} openModal={openModal} userRole={tw.role} />}
            {view === 'alerts' && <AlertsView />}
            {view === 'calendar' && <CalendarView openVM={openVM} />}
            {view === 'activity' && <ActivityView />}
            {view === 'direct-vm-create' && <AdminDirectVMCreate />}
            {view === 'vms' && <VMList openVM={openVM} openModal={openModal} setView={handleSetView} userRole={tw.role} />}
            {drawerVmId && <VMDrawer vmId={drawerVmId} onClose={closeDrawer} openCust={openCust} openModal={openModal} userRole={tw.role} />}
            {view === 'tasks' && <TasksView openTask={openTask} setView={handleSetView} setAutoOpenQuote={setAutoOpenQuote} setPrefillCustomerId={setPrefillCustomerId} setPrefillRequestId={setPrefillRequestId} setPrefillRequestType={setPrefillRequestType} userRole={tw.role} />}
            {view === 'addons' && <AddonServicesView openTask={openTask} setView={handleSetView} setAutoOpenQuote={setAutoOpenQuote} setPrefillCustomerId={setPrefillCustomerId} setPrefillRequestId={setPrefillRequestId} setPrefillRequestType={setPrefillRequestType} userRole={tw.role} />}
            {drawerTaskId && <TaskDrawer requestId={drawerTaskId} onClose={closeTaskDrawer} userRole={tw.role} />}
            {view === 'network' && <NetworkView openVM={openVM} openModal={openModal} />}
            {view === 'console' && <PlaceholderView title="Web Console" description="Proxmox web console - coming soon" />}
            {view === 'nodes' && <PlaceholderView title="Proxmox Nodes" description="Node management view - coming soon" />}
            {view === 'topology' && <PlaceholderView title="Network Topology" description="Network topology view - coming soon" />}
            {view === 'snapshots' && <PlaceholderView title="Snapshots" description="VM snapshots view - coming soon" />}
            {view === 'maintenance' && <PlaceholderView title="Maintenance Windows" description="Maintenance scheduling - coming soon" />}
            {view === 'patches' && <PlaceholderView title="Patch Queue" description="OS patch management - coming soon" />}
            {view === 'firewall' && <PlaceholderView title="Firewall Rules" description="Firewall configuration - coming soon" />}
            {view === 'customers' && <CustomersView openCust={openCust} openModal={openModal} userRole={tw.role} />}
            {drawerCustId && <CustomerDrawer custId={drawerCustId} onClose={closeCustDrawer} openVM={openVM} openModal={openModal} />}
            {view === 'customer-accounts' && <CustomerAccountManagementView openCust={openCust} openModal={openModal} setView={handleSetView} role={tw.role} />}
            {view === 'kyc' && <KYCReviewView />}
            {view === 'pipeline' && <PlaceholderView title="Sales Pipeline" description="Sales pipeline view - coming soon" />}
            {view === 'quotes' && <QuotesView autoOpen={autoOpenQuote} onAutoOpenReset={() => { setAutoOpenQuote(false); setPrefillCustomerId(undefined); setPrefillRequestId(undefined); setPrefillRequestType(undefined) }} prefillCustomerId={prefillCustomerId} prefillRequestId={prefillRequestId} prefillRequestType={prefillRequestType} />}
            {view === 'quote-review' && <FinanceQuoteReviewView />}
            {view === 'followups' && <PlaceholderView title="Follow-ups" description="Sales follow-ups - coming soon" />}
            {view === 'trials' && <PlaceholderView title="Trial Conversions" description="Trial conversion tracking - coming soon" />}
            {view === 'tickets' && <SupportTicketsView openModal={openModal} />}
            {view === 'finance' && <FinanceView openCust={(_id: string) => { }} openModal={openModal} userRole={tw.role} />}
            {view === 'receipts' && <ReceiptsView openCust={openCust} />}
            {view === 'reports' && <ReportsView />}
            {view === 'aging' && <AgingView />}
            {view === 'reconciliation' && <ReconciliationView />}
            {view === 'recurring' && <RecurringView openModal={openModal} />}
            {view === 'tax' && <TaxView />}
            {view === 'team' && <TeamView openModal={openModal} />}
            {view === 'health' && <SystemHealthView />}
            {view === 'audit' && <AuditLogView />}
            {view === 'announcements' && <AnnouncementsView />}
            {view === 'apikeys' && <ApiKeysView openModal={openModal} />}
            {view === 'backups' && <BackupCenterView />}
            {view === 'account' && <AccountSettingsView role={tw.role} setView={handleSetView} />}
          </div>

          {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} setView={handleSetView} openVM={openVM} openCust={openCust} openModal={openModal} />}
          {modalKind === 'newvm' && <NewVMModal onClose={closeModal} />}
          {modalKind === 'renew' && modalProps.vm && <RenewModal vm={modalProps.vm} onClose={closeModal} />}
          {modalKind === 'spec' && modalProps.vm && <SpecModal vm={modalProps.vm} onClose={closeModal} />}
          {modalKind === 'terminate' && modalProps.vm && <TerminateModal vm={modalProps.vm} onClose={closeModal} />}
          {modalKind === 'delete' && modalProps.vm && <DeleteModal vm={modalProps.vm} onClose={closeModal} />}
          {modalKind === 'newtask' && <NewTaskModal onClose={closeModal} presetStatus={modalProps.status} />}
          {modalKind === 'newcust' && <NewCustomerModal onClose={closeModal} onPasswordGenerated={(email, tempPassword, name) => { setTempPasswordData({ email, tempPassword, name }); setModalKind(null) }} />}
          {tempPasswordData && <TempPasswordModal email={tempPasswordData.email} tempPassword={tempPasswordData.tempPassword} name={tempPasswordData.name} onClose={() => setTempPasswordData(null)} />}
          {modalKind === 'email' && <EmailModal onClose={closeModal} to={modalProps.to} template={modalProps.template} />}
          {modalKind === 'newinvoice' && <NewInvoiceModal onClose={closeModal} presetCustomer={modalProps.customer} />}
          {modalKind === 'invite' && <InviteMemberModal onClose={closeModal} />}
          {modalKind === 'confirm' && <ConfirmModal onClose={closeModal} title={modalProps.title} message={modalProps.message} onConfirm={modalProps.onConfirm} />}
          {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
        </>
      )}

      <Toasts />

      <TweaksUI tw={tw} setTweak={setTweak} />
    </div>
  )
}

const App = () => {
  const [tw, setTweak] = useTweaks({
    role: "Admin",
    theme: "light",
    accent: "#4F6FE3",
    roleNames: {
      "Admin": "Administrator",
      "Sales": "Sales",
      "Engineer": "Engineer",
      "Finance": "Finance",
      "Customer": "Customer"
    }
  })

  return (
    <>
      <Toasts />
      <ActivityProvider>
        <TicketProvider>
          <TeamProvider>
            <PrefetchTeam />
            {/* Global customers provider to keep data cached across pages */}
            <CustomerProvider>
              <PrefetchCustomers />
              {/* Global VM requests provider to keep data cached across pages */}
              <VMRequestProvider>
                <PrefetchVMRequests />
                <QuoteProvider>
                  <PrefetchQuotes />
                  <AddonRequestProvider>
                    <AlertProvider>
                      <InvoiceProvider>
                      <ReceiptProvider>
                      <VMProvider>
                      <AnnouncementProvider>
                      <SystemSettingsProvider>
                  <Router>
                    <Routes>
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/setup-password" element={<SetupPassword />} />
                      <Route path="/change-password" element={<ChangePasswordPage />} />
                      <Route path="/auth/reset-password" element={<ResetPasswordScreen />} />
                      <Route path="/admin" element={
                        <TeamAuthShell setRole={(role) => setTweak('role' as keyof TweakState, role)}>
                          <AppInner tw={tw} setTweak={setTweak} />
                        </TeamAuthShell>
                      } />
                      <Route path="/admin/:view" element={
                        <TeamAuthShell setRole={(role) => setTweak('role' as keyof TweakState, role)}>
                          <AppInner tw={tw} setTweak={setTweak} />
                        </TeamAuthShell>
                      } />
                      <Route path="/" element={
                        <AuthShell setRole={(role) => setTweak('role' as keyof TweakState, role)}>
                          <AppInner tw={tw} setTweak={setTweak} />
                        </AuthShell>
                      } />
                      <Route path="/:view" element={
                        <AuthShell setRole={(role) => setTweak('role' as keyof TweakState, role)}>
                          <AppInner tw={tw} setTweak={setTweak} />
                        </AuthShell>
                      } />
                    </Routes>
                  </Router>
                      </SystemSettingsProvider>
                      </AnnouncementProvider>
                    </VMProvider>
                    </ReceiptProvider>
                    </InvoiceProvider>
                  </AlertProvider>
                </AddonRequestProvider>
              </QuoteProvider>


              </VMRequestProvider>
            </CustomerProvider>
          </TeamProvider>
        </TicketProvider>
      </ActivityProvider>
    </>
  )
}

export default App
