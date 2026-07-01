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
  kyc_status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review'
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
  proxmoxFlag: string
  security: boolean
  notes: string
  subscription: string
  priceMonth: number
  // Add-on services
  addonServices?: {
    backupEnabled?: boolean
    backupFreq?: string
    backupRetention?: number
    monitoring?: boolean
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
}

export interface Invoice {
  id: string
  customer: string
  vms: string[]
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
}

export interface Ticket {
  id: string
  customer: string
  subject: string
  body: string
  priority: string
  status: string
  created: string
  updated: string
  assignee: string
  replies: Array<{ who: string; when: string; body: string }>
}

export interface Quote {
  id: string
  customer: string
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
