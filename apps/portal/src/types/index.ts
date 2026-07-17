// Shared type definitions for VM Management Portal

export interface Customer {
  id: string
  legacy_id?: string
  email: string
  account_type: 'Individual' | 'Organization'
  name: string
  phone?: string
  alt_phone?: string
  preferred_contact_method?: 'Email' | 'Phone call' | 'WhatsApp' | 'Viber'
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  org_name?: string
  org_reg_no?: string
  org_type?: string
  org_industry?: string
  org_rep_title?: string
  org_employees?: string
  org_website?: string
  nrc_or_id?: string
  kyc_status: 'Pending' | 'Approved' | 'Rejected'
  kyc_reviewer_note?: string,
  kyc_reviewed_by?: string,
  kyc_reviewed_at?: string,
  nrc_front_url?: string
  nrc_back_url?: string
  org_cert_url?: string
  org_tax_id_url?: string
  director_id_url?: string
  payment_method?: 'KBZ Pay' | 'AYA Bank' | 'CB Bank' | 'Yoma Bank'
  payer_name?: string
  payer_phone?: string
  status: 'Active' | 'Inactive' | 'Suspended'
  agreed_to_terms?: boolean
  created_at?: string
  updated_at?: string
  last_login_at?: string
  totalSpend?: number
  company?: string
  since?: string
  force_password_change?: boolean
}

export interface VM {
  id: string
  name: string
  customer: string
  type: string
  status: string
  powerState: string
  vcpu: number
  ram: number
  storage: number
  bandwidth: string
  os: string
  publicAccess: boolean
  interconnect: string[]
  portForward: string
  publicIp: string
  vlan: string
  datacenter: string
  node: string
  start: string
  expiry: string
  firewallPolicy: string
  backup: string
  backup_enabled?: boolean
  backup_type?: string
  proxmoxFlag: string
  security: boolean
  notes: string
  subscription: string
  priceMonth: number
  assigned_vmid?: number
  start_date?: string
  end_date?: string

  // Add-on services
  addonServices?: {
    backupEnabled?: boolean
    backupFreq?: string
    backupRetention?: number
    cpfsEnabled?: boolean
    cpfsPackage?: 'standard' | 'premium'
    ccisEnabled?: boolean
    ccisPlan?: string
    ddosProtection?: string
    sslCertificate?: string
    loadBalancer?: string
  }
}

export interface Task {
  id: string
  title: string
  customer: string
  vm: string
  type: string
  priority: string
  assignee: string
  team: string
  status: string
  subscription: string
  created: string
  notes: string
  wfStage?: number
  createdVmId?: string
  vmPublicIps?: string[]
  vmPrivateIps?: string[]
  vmUsername?: string
  vmPassword?: string
}

export interface Invoice {
  id: string
  customer: string
  vm_request_ids: string[]
  amount: number
  vat: number
  grossAmount: number
  currency: string
  issued: string
  due: string
  status: string
  method: string
  receipt: string
  invoiceDate?: string
  discount?: number
  quote_id?: string
  sales_person?: string
  billing_term?: string
}

export interface Activity {
  ts: string
  actor: string
  kind: string
  text: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  team: string
  last: string
  status: string
}

export interface Alert {
  id: string
  sev: string
  title: string
  body: string
  ts: string
  read: boolean
  type: string
  related_entity_id?: string
  related_entity_type?: string
  actor_id?: string
  actor_name?: string
  metadata?: any
}

export interface Ticket {
  id: string
  legacy_id?: string
  customer_id?: string
  customer?: string
  category?: string
  subject: string
  body: string
  priority: string
  status: string
  created_at: string
  updated_at: string
  assignee: string
  attachments?: string[]
  replies: Array<{ id?: string; who: string; when: string; body: string }>
}

export interface Quote {
  id: string
  customer: string
  vm_request_id?: string
  addon_request_id?: string
  items: number
  total: number
  validity: string
  status: string
  lines?: Array<{ vcpu: number; ram: number; storage: number; qty: number; price: number }>
}

export interface Toast {
  id: number
  msg: string
  kind: string
  action?: any
}


export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired'

export interface DBQuote {
  id: string
  vm_request_id?: string
  addon_request_id?: string
  customer_id: string
  legacy_id?: string
  status: QuoteStatus
  validity_date: string
  instance_total: number
  public_ip_total: number
  backup_total: number
  discount_amount: number
  tax_amount: number
  net_amount: number
  grand_total: number
  billing_term: string
  discount_pct?: number
  currency: string
  line_items: any[]
  created_by?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface NewQuoteInput {
  vm_request_id?: string
  addon_request_id?: string
  status: QuoteStatus
  validity_date?: string
  instance_total: number
  public_ip_total: number
  backup_total: number
  discount_amount: number
  tax_amount: number
  net_amount: number
  grand_total: number
  billing_term: string
  discount_pct?: number
  currency?: 'MMK' | 'USD'
  line_items: any[]
  notes?: string | null
}

export interface AddonRequest {
  id: string
  customer_id: string
  vm_id: string
  legacy_id?: string
  cpfs_enabled?: boolean
  cpfs_package?: 'standard' | 'premium'
  ccis_enabled?: boolean
  ccis_package?: 'basic' | 'standard' | 'professional' | 'enterprise'
  duration?: number
  status: 'Pending' | 'In Progress' | 'Completed' | 'Rejected'
  notes?: string
  created_at: string
  updated_at: string
}


export interface NewVMInput {
  hostname: string
  public_ip?: string
  private_ip?: string
  username?: string
  password?: string
  vcpu?: number
  ram_gb?: number
  storage_gb?: number
  status?: string
  power_state?: string
  customer_id?: string
  vm_request_id?: string
  task_type?: string
  expiry?: string
  duration?: number
  legacy_id?: string
}


export interface DBInvoice {
  id: string
  customer_id: string
  legacy_id?: string
  vm_request_ids: string[]
  addon_request_ids: string[]
  amount: number
  vat: number
  gross_amount: number
  net_amount: number
  discount: number
  currency: string
  issued: string
  due: string
  status: string
  receipt: string | null
  invoice_date: string | null
  paid_date: string | null
  quote_id: string | null
  sales_person: string | null
  billing_term: string | null
  line_items: any[]
  payment_proof?: string
  created_at: string
  updated_at: string
}

export interface NewInvoiceInput {
  customer_id: string
  vm_request_ids?: string[]
  addon_request_ids?: string[]
  amount: number
  vat: number
  gross_amount: number
  net_amount?: number
  discount?: number
  currency?: 'MMK' | 'USD'
  issued?: string
  due?: string
  status?: string
  receipt?: string
  invoice_date?: string
  paid_date?: string
  quote_id?: string
  sales_person?: string
  billing_term?: string
  line_items?: any[]
}

export interface DBReceipt {
  id: string
  invoice_id: string
  customer_id: string
  legacy_id: string
  receipt_number: string
  message: string
  sent_at: string
  sent_by: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface NewReceiptInput {
  invoice_id: string
  customer_id: string
  legacy_id: string
  receipt_number: string
  message: string
  sent_by?: string
  status?: string
}

export interface Invoice {
  id: string
  customer_id: string
  vm_request_ids: string[]
  addon_request_ids: string[]
  amount: number
  vat: number
  gross_amount: number
  net_amount?: number
  currency: string
  issued: string
  due: string
  status: string
  receipt: string
  invoice_date: string | null
  paid_date?: string
  discount?: number
  quote_id?: string
  sales_person?: string
  billing_term?: string
}

