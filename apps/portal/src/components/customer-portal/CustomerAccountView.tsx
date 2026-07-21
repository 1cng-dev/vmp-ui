import React, { useState, useEffect } from 'react'
import useCustomerStore from '../../store/customerStore'
import useVMStore from '../../store/vmStore'
import useTicketStore from '../../store/ticketStore'
import useUIStore from '../../store/uiStore'
import { Avatar, formatMMK } from '../ui/ui'
import Icon from '../../lib/icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../auth/Auth'
import { uploadKYCDocument } from '../../lib/storage'

interface CustomerAccountViewProps {
  me: any
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({ me }) => {
  const { updateCustomer } = useCustomerStore()
  const { vms, loadVMs } = useVMStore()
  const { tickets, loadTickets } = useTicketStore()
  const { toast } = useUIStore()
  const { signout } = useAuth() || { signout: () => { } }

  // Load VMs and tickets on mount
  useEffect(() => {
    loadVMs()
    loadTickets()
  }, [loadVMs, loadTickets])

  // Calculate MRR from active VMs
  const customerVMs = vms.filter((v: any) => v.customer_id === me.id)
  const mrr = customerVMs.filter((v: any) => v.status === 'Active').reduce((a: number, v: any) => a + (v.priceMonth || 0), 0)

  // Calculate open tickets - recalculate when tickets change
  const openTickets = React.useMemo(() => {
    const customerTickets = tickets.filter((t: any) => {
      const customerId = t.customer || t.customer_id
      return customerId === me.id
    })
    return customerTickets.filter((t: any) => {
      const status = t.status?.toLowerCase()
      return status === 'open' || status === 'in progress'
    }).length
  }, [tickets, me.id])

  const [profile, setProfile] = useState({
    name: me.name,
    email: me.email,
    phone: me.phone,
    altPhone: me.alt_phone || ''
  })

  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [showKYCUpdateModal, setShowKYCUpdateModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [kycUpdateForm, setKycUpdateForm] = useState({
    phone: me.phone || '',
    altPhone: me.alt_phone || '',
    preferredContactMethod: me.preferred_contact_method || 'Email',
    address: me.address || '',
    city: me.city || '',
    state: me.state || '',
    postalCode: me.postal_code || '',
    country: me.country || '',
    orgName: me.org_name || '',
    orgRegNo: me.org_reg_no || '',
    orgType: me.org_type || '',
    orgIndustry: me.org_industry || '',
    orgRepTitle: me.org_rep_title || '',
    orgEmployees: me.org_employees || '',
    orgWebsite: me.org_website || '',
    nrcOrId: me.nrc_or_id || '',
    nrcFrontFile: null as File | null,
    nrcBackFile: null as File | null,
    orgCertFile: null as File | null,
    orgTaxIdFile: null as File | null,
    dirIdFile: null as File | null,
    paymentMethod: me.payment_method || 'KBZ Pay',
    payerName: me.payer_name || '',
    payerPhone: me.payer_phone || '',
  })

  const saveProfile = async () => {
    try {
      await updateCustomer(me.id, {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        alt_phone: profile.altPhone
      })
      toast('Profile updated', 'ok')
    } catch (error) {
      toast('Failed to update profile', 'bad')
      console.error('Profile update error:', error)
    }
  }

  const savePassword = async () => {
    if (!security.currentPassword) return toast('Enter current password', 'warn')
    if (security.newPassword.length < 8) return toast('Password must be at least 8 characters', 'warn')
    if (!/[A-Z]/.test(security.newPassword)) return toast('Password must contain at least one uppercase letter', 'warn')
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(security.newPassword)) return toast('Password must contain at least one special character', 'warn')
    if (security.newPassword !== security.confirmPassword) return toast('Passwords do not match', 'bad')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        toast('Unable to verify user email', 'bad')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: security.currentPassword
      })

      if (signInError) {
        toast('Current password is incorrect', 'bad')
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: security.newPassword
      })
      if (error) throw error
      setSecurity(s => ({ ...s, currentPassword: '', newPassword: '', confirmPassword: '' }))
      toast('Password changed successfully', 'ok')
    } catch (error) {
      toast('Failed to change password', 'bad')
      console.error('Password update error:', error)
    }
  }

  const submitKYCUpdate = async () => {
    setUploading(true)
    try {
      const updates: any = {
        kyc_status: 'Pending',
        kyc_documents_updated_at: new Date().toISOString(),
        phone: kycUpdateForm.phone,
        alt_phone: kycUpdateForm.altPhone,
        preferred_contact_method: kycUpdateForm.preferredContactMethod,
        address: kycUpdateForm.address,
        city: kycUpdateForm.city,
        state: kycUpdateForm.state,
        postal_code: kycUpdateForm.postalCode,
        country: kycUpdateForm.country,
        nrc_or_id: kycUpdateForm.nrcOrId,
        payment_method: kycUpdateForm.paymentMethod,
        payer_name: kycUpdateForm.payerName,
        payer_phone: kycUpdateForm.payerPhone,
      }

      if (me.account_type === 'Organization') {
        updates.org_name = kycUpdateForm.orgName
        updates.org_reg_no = kycUpdateForm.orgRegNo
        updates.org_type = kycUpdateForm.orgType
        updates.org_industry = kycUpdateForm.orgIndustry
        updates.org_rep_title = kycUpdateForm.orgRepTitle
        updates.org_employees = kycUpdateForm.orgEmployees
        updates.org_website = kycUpdateForm.orgWebsite
      }

      if (kycUpdateForm.nrcFrontFile) {
        const url = await uploadKYCDocument(kycUpdateForm.nrcFrontFile, me.id, 'nrc_front')
        updates.nrc_front_url = url
      }
      if (kycUpdateForm.nrcBackFile) {
        const url = await uploadKYCDocument(kycUpdateForm.nrcBackFile, me.id, 'nrc_back')
        updates.nrc_back_url = url
      }
      if (kycUpdateForm.orgCertFile) {
        const url = await uploadKYCDocument(kycUpdateForm.orgCertFile, me.id, 'org_cert')
        updates.org_cert_url = url
      }
      if (kycUpdateForm.orgTaxIdFile) {
        const url = await uploadKYCDocument(kycUpdateForm.orgTaxIdFile, me.id, 'org_tax_id')
        updates.org_tax_id_url = url
      }
      if (kycUpdateForm.dirIdFile) {
        const url = await uploadKYCDocument(kycUpdateForm.dirIdFile, me.id, 'director_id')
        updates.director_id_url = url
      }

      await updateCustomer(me.id, updates)
      setShowKYCUpdateModal(false)
      toast('KYC information updated successfully. Status set to Pending for review.', 'ok')
    } catch (error) {
      toast('Failed to update KYC information', 'bad')
      console.error('KYC update error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = (field: string, file: File | null) => {
    setKycUpdateForm(prev => ({ ...prev, [field]: file }))
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Account settings</h1>
          <p className="page-subtitle">Manage your profile and security settings</p>
        </div>
      </div>

      {/* Identity header */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex center gap-3">
            <Avatar name={profile.name} size={64} />
            <div style={{ flex: 1 }}>
              <div className="fw-7" style={{ fontSize: 18 }}>{profile.name}</div>
              <div className="text-sm text-mute">Customer</div>
              <div className="text-xs text-mute mt-1">{profile.email}</div>
              <div className="flex gap-3 mt-1">
                {me.totalSpend !== undefined && (
                  <div className="text-xs" style={{ color: 'var(--accent)' }}>
                    Lifetime: MMK {formatMMK(me.totalSpend)}
                  </div>
                )}
                {mrr > 0 && (
                  <div className="text-xs" style={{ color: 'var(--ok)' }}>
                    Monthly Recurring: MMK {formatMMK(mrr)}
                  </div>
                )}
                {openTickets > 0 && (
                  <div className="text-xs" style={{ color: 'var(--bad)' }}>
                    Open issues: {openTickets} tickets
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn danger" onClick={signout}><Icon name="logout" size={12} />Sign out</button>
            </div>
          </div>
        </div>
      </div>

      {/* KYC Rejection Card */}
      {me.kyc_status === 'Rejected' && (
        <div className="card mb-4" style={{ border: '1px solid var(--bad)' }}>
          <div className="card-body">
            {me.kyc_reviewer_note && (
              <div style={{
                padding: 12,
                background: 'var(--bad-soft)',
                borderRadius: 6,
                marginBottom: 16,
                border: '1px solid var(--bad)',
              }}>
                <div className="fw-6 text-sm" style={{ color: 'var(--bad)', marginBottom: 4 }}>
                  <Icon name="alert" size={12} /> Rejection reason:
                </div>
                <div className="text-sm">{me.kyc_reviewer_note}</div>
              </div>
            )}
            <button
              className="btn accent"
              onClick={() => setShowKYCUpdateModal(true)}
            >
              <Icon name="edit" size={12} /> Update KYC Information
            </button>
          </div>
        </div>
      )}

      <div className="grid-2 mb-4">
        {/* Profile */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Profile</h3>
            <button className="btn sm accent" onClick={saveProfile}><Icon name="check" size={11} />Save profile</button>
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="field"><label>Full name</label><input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
              <div className="field"><label>Email</label><input type="email" value={profile.email} disabled className='disabled' /></div>
              <div className="field"><label>Phone</label><input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
              <div className="field"><label>Alt phone</label><input value={profile.altPhone} onChange={e => setProfile({ ...profile, altPhone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Security</h3>
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Change password</div>
              <div className="field">
                <label>Current password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={security.currentPassword}
                    onChange={e => setSecurity({ ...security, currentPassword: e.target.value })}
                    placeholder="••••••••"
                    style={{ paddingRight: 36, width: '100%' }}
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowCurrentPw(!showCurrentPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                    <Icon name="eye" size={13} />
                  </button>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={security.newPassword}
                      onChange={e => setSecurity({ ...security, newPassword: e.target.value })}
                      placeholder="At least 8 chars, 1 uppercase, 1 special"
                      style={{ paddingRight: 36, width: '100%' }}
                    />
                    <button type="button" className="icon-btn" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                      <Icon name="eye" size={13} />
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>Confirm new</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={security.confirmPassword}
                      onChange={e => setSecurity({ ...security, confirmPassword: e.target.value })}
                      style={{ paddingRight: 36, width: '100%' }}
                    />
                    <button type="button" className="icon-btn" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                      <Icon name="eye" size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <button className="btn" onClick={savePassword}><Icon name="key" size={12} />Update password</button>
            </div>
          </div>
        </div>
      </div>

      {/* KYC Update Modal */}
      {showKYCUpdateModal && (
        <div className="modal-overlay" onClick={() => setShowKYCUpdateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-head">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Update KYC Information</h3>
                <div className="text-xs text-mute mt-1">Update your profile, documents, and payment information</div>
              </div>
              <button className="icon-btn" onClick={() => setShowKYCUpdateModal(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
                <div className="card-body" style={{ paddingTop: 18 }}>
                  <div className="flex col gap-4">
                    {/* Contact Information */}
                    <div>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contact Information</div>
                      <div className="grid-2" style={{ gap: 12 }}>
                        <div className="field"><label>Phone</label><input value={kycUpdateForm.phone} onChange={e => setKycUpdateForm({ ...kycUpdateForm, phone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
                        <div className="field"><label>Alt phone</label><input value={kycUpdateForm.altPhone} onChange={e => setKycUpdateForm({ ...kycUpdateForm, altPhone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
                        <div className="field">
                          <label>Preferred contact method</label>
                          <select value={kycUpdateForm.preferredContactMethod} onChange={e => setKycUpdateForm({ ...kycUpdateForm, preferredContactMethod: e.target.value as any })}>
                            <option value="Email">Email</option>
                            <option value="Phone call">Phone call</option>
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Viber">Viber</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Address</div>
                      <div className="flex col gap-3">
                        <div className="field"><label>Address</label><input value={kycUpdateForm.address} onChange={e => setKycUpdateForm({ ...kycUpdateForm, address: e.target.value })} /></div>
                        <div className="grid-2" style={{ gap: 12 }}>
                          <div className="field"><label>City</label><input value={kycUpdateForm.city} onChange={e => setKycUpdateForm({ ...kycUpdateForm, city: e.target.value })} /></div>
                          <div className="field"><label>State</label><input value={kycUpdateForm.state} onChange={e => setKycUpdateForm({ ...kycUpdateForm, state: e.target.value })} /></div>
                          <div className="field"><label>Postal code</label><input value={kycUpdateForm.postalCode} onChange={e => setKycUpdateForm({ ...kycUpdateForm, postalCode: e.target.value })} /></div>
                          <div className="field"><label>Country</label><input value={kycUpdateForm.country} onChange={e => setKycUpdateForm({ ...kycUpdateForm, country: e.target.value })} /></div>
                        </div>
                      </div>
                    </div>

                    {/* Organization Information */}
                    {me.account_type === 'Organization' && (
                      <div>
                        <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Organization Information</div>
                        <div className="grid-2" style={{ gap: 12 }}>
                          <div className="field"><label>Organization name</label><input value={kycUpdateForm.orgName} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgName: e.target.value })} /></div>
                          <div className="field"><label>Registration number</label><input value={kycUpdateForm.orgRegNo} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgRegNo: e.target.value })} /></div>
                          <div className="field"><label>Organization type</label><input value={kycUpdateForm.orgType} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgType: e.target.value })} /></div>
                          <div className="field"><label>Industry</label><input value={kycUpdateForm.orgIndustry} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgIndustry: e.target.value })} /></div>
                          <div className="field"><label>Representative title</label><input value={kycUpdateForm.orgRepTitle} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgRepTitle: e.target.value })} /></div>
                          <div className="field"><label>Number of employees</label><input value={kycUpdateForm.orgEmployees} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgEmployees: e.target.value })} /></div>
                          <div className="field" style={{ gridColumn: 'span 2' }}><label>Website</label><input value={kycUpdateForm.orgWebsite} onChange={e => setKycUpdateForm({ ...kycUpdateForm, orgWebsite: e.target.value })} /></div>
                        </div>
                      </div>
                    )}

                    {/* KYC Documents */}
                    <div>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>KYC Documents</div>
                      <div className="field">
                        <label>{me.account_type === 'Individual' ? 'NRC / National ID number' : 'Representative\'s NRC / ID number'}</label>
                        <input value={kycUpdateForm.nrcOrId} onChange={e => setKycUpdateForm({ ...kycUpdateForm, nrcOrId: e.target.value })} placeholder="e.g. 12/XXXXX(N)123456" style={{ fontFamily: 'var(--mono)' }} />
                      </div>
                      <div className="grid-2" style={{ gap: 10, marginTop: 12 }}>
                        <div>
                          <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload('nrcFrontFile', e.target.files?.[0] || null)} style={{ display: 'none' }} id="modal-upload-nrc-front" />
                          <button type="button" onClick={() => document.getElementById('modal-upload-nrc-front')?.click()} style={{
                            padding: '14px 16px', border: `1.5px dashed ${kycUpdateForm.nrcFrontFile ? 'var(--ok)' : 'var(--line-strong)'}`,
                            background: kycUpdateForm.nrcFrontFile ? 'var(--ok-soft)' : 'var(--surface-2)', borderRadius: 8,
                            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                          }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: kycUpdateForm.nrcFrontFile ? 'var(--ok)' : 'var(--surface-3)', color: kycUpdateForm.nrcFrontFile ? 'white' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                              <Icon name={kycUpdateForm.nrcFrontFile ? 'check' : 'attach'} size={14} />
                            </div>
                            <div>
                              <div className="fw-6 text-sm" style={{ color: kycUpdateForm.nrcFrontFile ? 'var(--ok)' : 'var(--ink)' }}>{kycUpdateForm.nrcFrontFile ? kycUpdateForm.nrcFrontFile.name : 'NRC Front'}</div>
                              <div className="text-xs text-mute">{me.nrc_front_url ? 'Current: Uploaded' : 'Not uploaded'}</div>
                            </div>
                          </button>
                        </div>
                        <div>
                          <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload('nrcBackFile', e.target.files?.[0] || null)} style={{ display: 'none' }} id="modal-upload-nrc-back" />
                          <button type="button" onClick={() => document.getElementById('modal-upload-nrc-back')?.click()} style={{
                            padding: '14px 16px', border: `1.5px dashed ${kycUpdateForm.nrcBackFile ? 'var(--ok)' : 'var(--line-strong)'}`,
                            background: kycUpdateForm.nrcBackFile ? 'var(--ok-soft)' : 'var(--surface-2)', borderRadius: 8,
                            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                          }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: kycUpdateForm.nrcBackFile ? 'var(--ok)' : 'var(--surface-3)', color: kycUpdateForm.nrcBackFile ? 'white' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                              <Icon name={kycUpdateForm.nrcBackFile ? 'check' : 'attach'} size={14} />
                            </div>
                            <div>
                              <div className="fw-6 text-sm" style={{ color: kycUpdateForm.nrcBackFile ? 'var(--ok)' : 'var(--ink)' }}>{kycUpdateForm.nrcBackFile ? kycUpdateForm.nrcBackFile.name : 'NRC Back'}</div>
                              <div className="text-xs text-mute">{me.nrc_back_url ? 'Current: Uploaded' : 'Not uploaded'}</div>
                            </div>
                          </button>
                        </div>
                      </div>
                      {me.account_type === 'Organization' && (
                        <div className="grid-2" style={{ gap: 10, marginTop: 10 }}>
                          <div>
                            <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload('orgCertFile', e.target.files?.[0] || null)} style={{ display: 'none' }} id="modal-upload-org-cert" />
                            <button type="button" onClick={() => document.getElementById('modal-upload-org-cert')?.click()} style={{
                              padding: '14px 16px', border: `1.5px dashed ${kycUpdateForm.orgCertFile ? 'var(--ok)' : 'var(--line-strong)'}`,
                              background: kycUpdateForm.orgCertFile ? 'var(--ok-soft)' : 'var(--surface-2)', borderRadius: 8,
                              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                            }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: kycUpdateForm.orgCertFile ? 'var(--ok)' : 'var(--surface-3)', color: kycUpdateForm.orgCertFile ? 'white' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                                <Icon name={kycUpdateForm.orgCertFile ? 'check' : 'attach'} size={14} />
                              </div>
                              <div>
                                <div className="fw-6 text-sm" style={{ color: kycUpdateForm.orgCertFile ? 'var(--ok)' : 'var(--ink)' }}>{kycUpdateForm.orgCertFile ? kycUpdateForm.orgCertFile.name : 'Company Registration'}</div>
                                <div className="text-xs text-mute">{me.org_cert_url ? 'Current: Uploaded' : 'Not uploaded'}</div>
                              </div>
                            </button>
                          </div>
                          <div>
                            <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload('orgTaxIdFile', e.target.files?.[0] || null)} style={{ display: 'none' }} id="modal-upload-org-tax-id" />
                            <button type="button" onClick={() => document.getElementById('modal-upload-org-tax-id')?.click()} style={{
                              padding: '14px 16px', border: `1.5px dashed ${kycUpdateForm.orgTaxIdFile ? 'var(--ok)' : 'var(--line-strong)'}`,
                              background: kycUpdateForm.orgTaxIdFile ? 'var(--ok-soft)' : 'var(--surface-2)', borderRadius: 8,
                              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                            }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: kycUpdateForm.orgTaxIdFile ? 'var(--ok)' : 'var(--surface-3)', color: kycUpdateForm.orgTaxIdFile ? 'white' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                                <Icon name={kycUpdateForm.orgTaxIdFile ? 'check' : 'attach'} size={14} />
                              </div>
                              <div>
                                <div className="fw-6 text-sm" style={{ color: kycUpdateForm.orgTaxIdFile ? 'var(--ok)' : 'var(--ink)' }}>{kycUpdateForm.orgTaxIdFile ? kycUpdateForm.orgTaxIdFile.name : 'Tax Registration'}</div>
                                <div className="text-xs text-mute">{me.org_tax_id_url ? 'Current: Uploaded' : 'Not uploaded'}</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment Information */}
                    <div>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment Information</div>
                      <div className="grid-2" style={{ gap: 12 }}>
                        <div className="field">
                          <label>Payment method</label>
                          <select value={kycUpdateForm.paymentMethod} onChange={e => setKycUpdateForm({ ...kycUpdateForm, paymentMethod: e.target.value as any })}>
                            <option value="KBZ Pay">KBZ Pay</option>
                            <option value="AYA Bank">AYA Bank</option>
                            <option value="CB Bank">CB Bank</option>
                            <option value="Yoma Bank">Yoma Bank</option>
                          </select>
                        </div>
                        <div className="field"><label>Payer name</label><input value={kycUpdateForm.payerName} onChange={e => setKycUpdateForm({ ...kycUpdateForm, payerName: e.target.value })} /></div>
                        <div className="field"><label>Payer phone</label><input value={kycUpdateForm.payerPhone} onChange={e => setKycUpdateForm({ ...kycUpdateForm, payerPhone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowKYCUpdateModal(false)}>Cancel</button>
              <button className="btn accent" onClick={submitKYCUpdate} disabled={uploading}>
                {uploading ? 'Updating...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}