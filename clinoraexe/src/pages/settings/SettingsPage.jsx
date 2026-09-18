import '../../styles/settings-page.css'
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getSettings, updateClinic, updatePrescriptionSettings } from '../../services/settingsService'
import { listFeeTemplates, saveFeeTemplate, deleteFeeTemplate } from '../../services/feeTemplateService'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import { sanitizeMobile, validateMobile } from '../../lib/inputValidators'

function flattenErrors(errors) {
  const out = {}
  Object.entries(errors ?? {}).forEach(([k, msgs]) => {
    out[k] = Array.isArray(msgs) ? msgs[0] : msgs
  })
  return out
}

const CLINIC_DEFAULTS = {
  name: '', doctor_name: '', qualification: '', registration_number: '', address: '', contact: '',
}

const PRESC_DEFAULTS = {
  prescription_header: '', prescription_footer: '',
  show_doctor_contact: true, show_clinic_contact: true,
  gst_percent: '',
}

/* ── Toggle switch ───────────────────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`stg-toggle${on ? ' stg-toggle--on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="stg-toggle-thumb" />
    </button>
  )
}

/* ── Icons ───────────────────────────────────────────────────────────────── */
function IconClinic() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconPrescription() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [pageStatus, setPageStatus] = useState('loading')

  /* clinic form */
  const [clinic,      setClinic]      = useState(CLINIC_DEFAULTS)
  const [clinicSaving, setClinicSaving] = useState(false)
  const [clinicSaved,  setClinicSaved]  = useState(false)
  const [clinicErrors, setClinicErrors] = useState({})
  const [clinicApiErr, setClinicApiErr] = useState(null)

  /* backup */
  const [backing,      setBacking]     = useState(false)
  const [backupMsg,    setBackupMsg]   = useState(null)
  const [backupPath,   setBackupPath]  = useState('')
  const [savedBackupPath, setSavedBackupPath] = useState(null)
  const [pathSaving,   setPathSaving]  = useState(false)
  const [pathMsg,      setPathMsg]     = useState(null)

  /* prescription settings form */
  const [presc,       setPresc]       = useState(PRESC_DEFAULTS)
  const [prescSaving, setPrescSaving] = useState(false)
  const [prescSaved,  setPrescSaved]  = useState(false)
  const [prescErrors, setPrescErrors] = useState({})
  const [prescApiErr, setPrescApiErr] = useState(null)

  /* unified save */
  const [allSaving, setAllSaving] = useState(false)
  const [allSaved,  setAllSaved]  = useState(false)

  /* fee templates */
  const [templates,     setTemplates]     = useState([])
  const [tmplName,      setTmplName]      = useState('')
  const [tmplAmount,    setTmplAmount]    = useState('')
  const [savingTmpl,    setSavingTmpl]    = useState(false)

  useEffect(() => {
    listFeeTemplates().then(r => setTemplates(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then(({ data }) => {
        if (cancelled) return
        const c  = data.clinic
        const ps = data
        setClinic({
          name:                c.name                ?? '',
          doctor_name:         c.doctor_name         ?? '',
          qualification:       c.qualification       ?? '',
          registration_number: c.registration_number ?? '',
          address:             c.address             ?? '',
          contact:             c.contact             ?? '',
        })
        setPresc({
          prescription_header:  ps.prescription_header  ?? '',
          prescription_footer:  ps.prescription_footer  ?? '',
          show_doctor_contact:  ps.show_doctor_contact  ?? true,
          show_clinic_contact:  ps.show_clinic_contact  ?? true,
          gst_percent:          ps.gst_percent > 0 ? String(ps.gst_percent) : '',
        })
        setPageStatus('done')
      })
      .catch(() => { if (!cancelled) setPageStatus('error') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    invoke('get_backup_path').then(res => {
      setSavedBackupPath(res.backup_path ?? null)
      setBackupPath(res.backup_path ?? '')
    }).catch(() => {})
  }, [])

  function setClinicField(field, value) {
    setClinic(f => ({ ...f, [field]: value }))
    setClinicSaved(false)
    if (clinicErrors[field]) setClinicErrors(e => ({ ...e, [field]: undefined }))
  }

  function setPrescField(field, value) {
    setPresc(f => ({ ...f, [field]: value }))
    setPrescSaved(false)
    if (prescErrors[field]) setPrescErrors(e => ({ ...e, [field]: undefined }))
  }

  async function doClinicSave() {
    setClinicSaving(true)
    setClinicErrors({})
    setClinicApiErr(null)
    setClinicSaved(false)
    try {
      await updateClinic({
        name:                clinic.name.trim(),
        doctor_name:         clinic.doctor_name.trim(),
        qualification:       clinic.qualification.trim()       || null,
        registration_number: clinic.registration_number.trim() || null,
        address:             clinic.address.trim()             || null,
        contact:             clinic.contact.trim()             || null,
      })
      setClinicSaved(true)
    } catch (err) {
      if (err.response?.status === 422) setClinicErrors(flattenErrors(err.response?.data?.errors))
      else setClinicApiErr(err.response?.data?.message ?? 'Could not save — check your connection.')
      throw err
    } finally { setClinicSaving(false) }
  }

  async function doPrescSave() {
    setPrescSaving(true)
    setPrescErrors({})
    setPrescApiErr(null)
    setPrescSaved(false)
    try {
      await updatePrescriptionSettings({
        prescription_header: presc.prescription_header.trim() || null,
        prescription_footer: presc.prescription_footer.trim() || null,
        show_doctor_contact: presc.show_doctor_contact,
        show_clinic_contact: presc.show_clinic_contact,
        gst_percent: presc.gst_percent !== '' ? parseFloat(presc.gst_percent) : 0,
      })
      setPrescSaved(true)
    } catch (err) {
      if (err.response?.status === 422) setPrescErrors(flattenErrors(err.response?.data?.errors))
      else setPrescApiErr(err.response?.data?.message ?? 'Could not save — check your connection.')
      throw err
    } finally { setPrescSaving(false) }
  }

  function handleClinicSave(e) { e.preventDefault(); doClinicSave() }
  function handlePrescSave(e)  { e.preventDefault(); doPrescSave()  }

  async function handleAddTemplate(e) {
    e.preventDefault()
    if (!tmplName.trim() || !tmplAmount) return
    const amt = parseFloat(tmplAmount)
    if (isNaN(amt) || amt < 0) return
    setSavingTmpl(true)
    try {
      const r = await saveFeeTemplate(null, { name: tmplName.trim(), amount: amt })
      setTemplates(prev => [...prev, r.data])
      setTmplName('')
      setTmplAmount('')
    } catch { /* silent */ }
    finally { setSavingTmpl(false) }
  }

  async function handleDeleteTemplate(id) {
    try {
      await deleteFeeTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch { /* silent */ }
  }

  async function handleSaveAll() {
    setAllSaving(true)
    setAllSaved(false)
    try {
      await Promise.all([doClinicSave(), doPrescSave()])
      setAllSaved(true)
      setTimeout(() => setAllSaved(false), 3000)
    } catch { /* individual errors shown per card */ }
    finally { setAllSaving(false) }
  }

  if (pageStatus === 'loading') return <PageLoader />

  if (pageStatus === 'error') {
    return (
      <div className="card state-panel">
        Could not load settings — check your connection and reload the page.
      </div>
    )
  }

  return (
    <div className="stg-page">

      {/* ── Card 1: Clinic & Doctor Information ─────────────────────────── */}
      <form onSubmit={handleClinicSave}>
        <div className="card stg-card">

          <div className="stg-card-head">
            <div className="stg-card-head-row">
              <span className="stg-card-icon"><IconClinic /></span>
              <div>
                <div className="stg-card-title">Clinic &amp; Doctor Information</div>
                <p className="stg-card-desc">Printed on prescriptions and patient documents.</p>
              </div>
            </div>
          </div>

          {clinicApiErr && <div className="stg-alert stg-alert--error">{clinicApiErr}</div>}

          <div className="stg-card-body">

            <div className="stg-grid-2">
              <div className="stg-field">
                <label className="stg-label">
                  Clinic Name <span className="stg-required">*</span>
                </label>
                <input
                  className={`stg-input${clinicErrors.name ? ' has-error' : ''}`}
                  value={clinic.name}
                  onChange={e => setClinicField('name', e.target.value)}
                  placeholder="e.g. Sharma Medical Centre"
                />
                {clinicErrors.name && <span className="stg-error">{clinicErrors.name}</span>}
              </div>

              <div className="stg-field">
                <label className="stg-label">
                  Doctor Name <span className="stg-required">*</span>
                </label>
                <input
                  className={`stg-input${clinicErrors.doctor_name ? ' has-error' : ''}`}
                  value={clinic.doctor_name}
                  onChange={e => setClinicField('doctor_name', e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                />
                {clinicErrors.doctor_name && <span className="stg-error">{clinicErrors.doctor_name}</span>}
              </div>
            </div>

            <div className="stg-grid-2">
              <div className="stg-field">
                <label className="stg-label">
                  Qualification / Specialisation
                  <span className="stg-label-opt">optional</span>
                </label>
                <input
                  className={`stg-input${clinicErrors.qualification ? ' has-error' : ''}`}
                  value={clinic.qualification}
                  onChange={e => setClinicField('qualification', e.target.value)}
                  placeholder="e.g. MBBS, MD — Internal Medicine"
                />
                <span className="stg-hint">Shown below the doctor name on prescriptions.</span>
                {clinicErrors.qualification && <span className="stg-error">{clinicErrors.qualification}</span>}
              </div>

              <div className="stg-field">
                <label className="stg-label">
                  Registration Number
                  <span className="stg-label-opt">optional</span>
                </label>
                <input
                  className={`stg-input${clinicErrors.registration_number ? ' has-error' : ''}`}
                  value={clinic.registration_number}
                  onChange={e => setClinicField('registration_number', e.target.value)}
                  placeholder="e.g. MH-12345 or NMC/2023/1234"
                />
                <span className="stg-hint">Doctor's MCI / NMC / state council registration number. Printed on prescriptions.</span>
                {clinicErrors.registration_number && <span className="stg-error">{clinicErrors.registration_number}</span>}
              </div>

              <div className="stg-field">
                <label className="stg-label">
                  Contact Number
                  <span className="stg-label-opt">optional</span>
                </label>
                <input
                  className={`stg-input${clinicErrors.contact ? ' has-error' : ''}`}
                  value={clinic.contact}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={e => {
                    const v = sanitizeMobile(e.target.value)
                    setClinicField('contact', v)
                    const err = validateMobile(v)
                    if (err) setClinicErrors(prev => ({ ...prev, contact: err }))
                  }}
                  placeholder="10-digit number"
                />
                <span className="stg-hint">Phone number for patient callbacks.</span>
                {clinicErrors.contact && <span className="stg-error">{clinicErrors.contact}</span>}
              </div>
            </div>

            <div className="stg-field">
              <label className="stg-label">
                Clinic Address
                <span className="stg-label-opt">optional</span>
              </label>
              <textarea
                className={`stg-input stg-textarea${clinicErrors.address ? ' has-error' : ''}`}
                value={clinic.address}
                onChange={e => setClinicField('address', e.target.value)}
                placeholder="e.g. 14, MG Road, Bengaluru, Karnataka 560 001"
                rows={2}
              />
              <span className="stg-hint">Printed on the prescription header and receipts.</span>
              {clinicErrors.address && <span className="stg-error">{clinicErrors.address}</span>}
            </div>

          </div>

          <div className="stg-card-foot stg-card-foot--minimal">
            {clinicApiErr && <span className="stg-save-err-hint">Fix errors above</span>}
          </div>

        </div>
      </form>

      {/* ── Card 2: Prescription Defaults ───────────────────────────────── */}
      <form onSubmit={handlePrescSave} style={{ marginTop: '16px' }}>
        <div className="card stg-card">

          <div className="stg-card-head">
            <div className="stg-card-head-row">
              <span className="stg-card-icon"><IconPrescription /></span>
              <div>
                <div className="stg-card-title">Prescription Defaults</div>
                <p className="stg-card-desc">Custom text and display settings printed on every prescription.</p>
              </div>
            </div>
          </div>

          {prescApiErr && <div className="stg-alert stg-alert--error">{prescApiErr}</div>}

          <div className="stg-card-body">

            <div className="stg-field">
              <label className="stg-label">Prescription Header</label>
              <textarea
                className={`stg-input stg-textarea${prescErrors.prescription_header ? ' has-error' : ''}`}
                value={presc.prescription_header}
                onChange={e => setPrescField('prescription_header', e.target.value)}
                placeholder="e.g. Registration No: MCI-12345 · Timing: Mon–Sat, 9 AM – 6 PM"
                rows={3}
              />
              <span className="stg-hint">Appears in the header block above the medicine list.</span>
              {prescErrors.prescription_header && <span className="stg-error">{prescErrors.prescription_header}</span>}
            </div>

            <div className="stg-field">
              <label className="stg-label">Prescription Footer</label>
              <textarea
                className={`stg-input stg-textarea${prescErrors.prescription_footer ? ' has-error' : ''}`}
                value={presc.prescription_footer}
                onChange={e => setPrescField('prescription_footer', e.target.value)}
                placeholder="e.g. This prescription is valid for 30 days. Follow dosage strictly."
                rows={3}
              />
              <span className="stg-hint">Appears below the signature block at the bottom.</span>
              {prescErrors.prescription_footer && <span className="stg-error">{prescErrors.prescription_footer}</span>}
            </div>

            {/* GST */}
            <div className="stg-field">
              <label className="stg-label">
                GST on Invoices (%)
                <span className="stg-label-opt">optional</span>
              </label>
              <input
                className="stg-input"
                style={{ maxWidth: 140 }}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={presc.gst_percent}
                onChange={e => setPrescField('gst_percent', e.target.value)}
                placeholder="e.g. 18"
              />
              <span className="stg-hint">Applied to visit and pharmacy invoices. Set to 0 to disable GST.</span>
            </div>

            {/* Toggles */}
            <div className="stg-section-sep" />
            <div className="stg-section-label">Display on Prescription</div>

            <div className="stg-toggle-list">
              <div className="stg-toggle-row">
                <div className="stg-toggle-info">
                  <span className="stg-toggle-label">Show doctor contact number</span>
                  <span className="stg-toggle-desc">Prints the doctor's phone on the prescription header.</span>
                </div>
                <Toggle
                  on={presc.show_doctor_contact}
                  onChange={v => setPrescField('show_doctor_contact', v)}
                />
              </div>

              <div className="stg-toggle-row">
                <div className="stg-toggle-info">
                  <span className="stg-toggle-label">Show clinic address</span>
                  <span className="stg-toggle-desc">Prints the clinic address in the prescription header.</span>
                </div>
                <Toggle
                  on={presc.show_clinic_contact}
                  onChange={v => setPrescField('show_clinic_contact', v)}
                />
              </div>
            </div>

          </div>

          <div className="stg-card-foot stg-card-foot--minimal">
            {prescApiErr && <span className="stg-save-err-hint">Fix errors above</span>}
          </div>

        </div>
      </form>

      {/* ── Unified save bar ─────────────────────────────────────────── */}
      <div className="stg-save-all-bar">
        {allSaved && <span className="stg-saved-msg"><IconCheck /> All settings saved</span>}
        {!allSaved && <span />}
        <button
          type="button"
          className="stg-save-btn"
          onClick={handleSaveAll}
          disabled={allSaving || clinicSaving || prescSaving}
        >
          {allSaving ? <Spinner size={13} /> : null}
          {allSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Fee Templates ──────────────────────────────────────────────── */}
      <div className="card stg-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
            <div>
              <div className="stg-card-title">Fee Templates</div>
              <p className="stg-card-desc">Pre-configured procedure charges. Quick-add these to any visit from the billing card.</p>
            </div>
          </div>
        </div>
        <div className="stg-card-body">
          {templates.length === 0 ? (
            <div className="stg-tmpl-empty">No templates yet. Add your standard procedures below.</div>
          ) : (
            <div className="stg-tmpl-list">
              {templates.map(t => (
                <div key={t.id} className="stg-tmpl-row">
                  <span className="stg-tmpl-name">{t.name}</span>
                  <span className="stg-tmpl-amount">₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button className="stg-tmpl-del" onClick={() => handleDeleteTemplate(t.id)} title="Remove">×</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddTemplate} className="stg-tmpl-add-form">
            <input
              className="stg-input stg-tmpl-name-input"
              placeholder="Service name (e.g. ECG, X-ray)"
              value={tmplName}
              onChange={e => setTmplName(e.target.value)}
            />
            <input
              className="stg-input stg-tmpl-amount-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="₹ Amount"
              value={tmplAmount}
              onChange={e => setTmplAmount(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: 13 }}
              disabled={savingTmpl || !tmplName.trim() || !tmplAmount}
            >
              {savingTmpl ? 'Adding…' : '+ Add'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Database Backup ────────────────────────────────────────────── */}
      <div className="stg-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </span>
            <div>
              <div className="stg-card-title">Database Backup</div>
              <p className="stg-card-desc">Export a full backup of your clinic database as a <code>.sql</code> file.</p>
            </div>
          </div>
        </div>
        <div className="stg-card-body">

          {/* Backup path */}
          <div className="stg-field">
            <label className="stg-label">Backup Destination Folder</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="stg-input"
                value={backupPath}
                onChange={e => { setBackupPath(e.target.value); setPathMsg(null) }}
                placeholder="e.g. D:\Backup or E:\USB_Drive\ClinoraBackup"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="stg-save-btn"
                disabled={pathSaving}
                style={{ flexShrink: 0 }}
                onClick={async () => {
                  setPathSaving(true)
                  setPathMsg(null)
                  try {
                    await invoke('update_backup_path', { path: backupPath.trim() })
                    setSavedBackupPath(backupPath.trim() || null)
                    setPathMsg({ ok: true, text: backupPath.trim() ? 'Backup folder saved.' : 'Backup folder cleared — will use Downloads.' })
                  } catch (err) {
                    setPathMsg({ ok: false, text: typeof err === 'string' ? err : 'Could not save path.' })
                  } finally { setPathSaving(false) }
                }}
              >
                {pathSaving ? 'Saving…' : 'Set Folder'}
              </button>
            </div>
            <span className="stg-hint">
              {savedBackupPath
                ? `Currently saving to: ${savedBackupPath}`
                : 'Leave empty to use the default Downloads folder.'}
            </span>
            {pathMsg && (
              <div className={`form-alert ${pathMsg.ok ? 'success' : 'danger'}`} style={{ marginTop: 8 }}>
                <p className="form-alert-body">{pathMsg.text}</p>
              </div>
            )}
          </div>

          <div className="stg-section-sep" />
          <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginBottom: 12 }}>
            Run backups regularly — especially before Windows updates or moving the PC. Keep copies on an external drive or USB.
          </p>
          {backupMsg && (
            <div className={`form-alert ${backupMsg.ok ? 'success' : 'danger'}`} style={{ marginBottom: 12 }}>
              <p className="form-alert-body">{backupMsg.text}</p>
            </div>
          )}
          <button
            className="stg-save-btn"
            disabled={backing}
            onClick={async () => {
              setBacking(true)
              setBackupMsg(null)
              try {
                const result = await invoke('backup_database')
                setBackupMsg({ ok: true, text: `Backup saved: ${result.filename} (${result.size_kb} KB) → ${result.path}` })
              } catch (err) {
                setBackupMsg({ ok: false, text: typeof err === 'string' ? err : 'Backup failed — make sure mysqldump is installed.' })
              } finally { setBacking(false) }
            }}
          >
            {backing ? 'Creating backup…' : 'Backup Now'}
          </button>
        </div>
      </div>

    </div>
  )
}
