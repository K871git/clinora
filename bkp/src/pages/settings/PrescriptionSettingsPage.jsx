import '../../styles/settings-page.css'
import { useState, useEffect, useRef } from 'react'
import {
  getSettings, updateClinic, updatePrescriptionSettings,
  getTemplates, uploadTemplate, deleteTemplate, setActiveTemplate,
  uploadClinicLogo, deleteClinicLogo,
} from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import DefaultPrescriptionTemplate from '../prescriptions/DefaultPrescriptionTemplate'

/* ══════════════════════════════════════════════════════════════════
   Prescription Settings Page
   ══════════════════════════════════════════════════════════════════ */
export default function PrescriptionSettingsPage() {

  /* ── Template list (existing) ── */
  const [tpls,      setTpls]      = useState([])
  const [tplLoad,   setTplLoad]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef    = useRef(null)
  const logoRef    = useRef(null)

  /* ── Settings / form ── */
  const [settingsLoad, setSettingsLoad] = useState(true)
  const [form, setForm] = useState({
    doctor_name: '', qualification: '', registration_number: '',
    name: '', address: '', contact: '', clinic_timing: '', clinic_days: '',
    watermark_text: 'Clinora', watermark_color: '#0d9488', watermark_enabled: true,
  })
  const [logoUrl,      setLogoUrl]      = useState(null)
  const [logoFile,     setLogoFile]     = useState(null)
  const [logoUploading,setLogoUploading]= useState(false)
  const [saving,       setSaving]       = useState(false)
  const [savedMsg,     setSavedMsg]     = useState(false)

  /* ── Preview modal ── */
  const [showPreview, setShowPreview] = useState(false)

  /* ── Load ── */
  useEffect(() => {
    Promise.all([getSettings(), getTemplates()]).then(([s, t]) => {
      const d = s.data
      setForm({
        doctor_name:         d.clinic?.doctor_name         ?? '',
        qualification:       d.clinic?.qualification       ?? '',
        registration_number: d.clinic?.registration_number ?? '',
        name:                d.clinic?.name                ?? '',
        address:             d.clinic?.address             ?? '',
        contact:             d.clinic?.contact             ?? '',
        clinic_timing:       d.clinic?.clinic_timing       ?? '',
        clinic_days:         d.clinic?.clinic_days         ?? '',
        watermark_text:      d.watermark_text              ?? 'Clinora',
        watermark_color:     d.watermark_color             ?? '#0d9488',
        watermark_enabled:   d.watermark_enabled           !== false,
      })
      setLogoUrl(d.clinic?.logo_url ?? null)
      setSettingsLoad(false)
      setTpls(t.data.data ?? [])
      setTplLoad(false)
    }).catch(() => { setSettingsLoad(false); setTplLoad(false) })
  }, [])

  /* ── Form helpers ── */
  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  /* ── Logo file select (preview before save) ── */
  function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  /* ── Save ── */
  async function handleSave() {
    setSaving(true)
    try {
      await updateClinic({
        name:                form.name,
        doctor_name:         form.doctor_name,
        qualification:       form.qualification,
        registration_number: form.registration_number,
        address:             form.address,
        contact:             form.contact,
        clinic_timing:       form.clinic_timing,
        clinic_days:         form.clinic_days,
      })
      await updatePrescriptionSettings({
        watermark_text:    form.watermark_text,
        watermark_color:   form.watermark_color,
        watermark_enabled: form.watermark_enabled,
      })
      if (logoFile) {
        setLogoUploading(true)
        const res = await uploadClinicLogo(logoFile)
        setLogoUrl(res.data.url)
        setLogoFile(null)
        setLogoUploading(false)
      }
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  /* ── Remove logo ── */
  async function handleDeleteLogo() {
    try {
      await deleteClinicLogo()
      setLogoUrl(null)
      setLogoFile(null)
    } catch { /* silent */ }
  }

  /* ── Template handlers ── */
  async function handleUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setUploading(true)
    try {
      await uploadTemplate(file)
      const { data } = await getTemplates()
      setTpls(data.data ?? [])
    } catch { /* silent */ }
    finally { setUploading(false) }
  }

  async function handleActivate(name) {
    try {
      await setActiveTemplate(name)
      setTpls(prev => prev.map(t => ({ ...t, is_active: t.name === name })))
    } catch { /* silent */ }
  }

  async function handleDeactivate() {
    try {
      await setActiveTemplate('')
      setTpls(prev => prev.map(t => ({ ...t, is_active: false })))
    } catch { /* silent */ }
  }

  async function handleDelete(name) {
    try {
      await deleteTemplate(name)
      setTpls(prev => prev.filter(t => t.name !== name))
    } catch { /* silent */ }
  }

  /* ── Live clinic/watermark props for preview ── */
  const previewClinic = {
    name: form.name, doctorName: form.doctor_name,
    qualification: form.qualification, regNo: form.registration_number,
    address: form.address, contact: form.contact,
    timing: form.clinic_timing, days: form.clinic_days,
    logoUrl,
  }
  const previewWm = {
    text: form.watermark_text, color: form.watermark_color, enabled: form.watermark_enabled,
  }

  const activeTpl = tpls.find(t => t.is_active)

  return (
    <div className="stg-page">

      {/* ═══ 1 · Default Template ═══════════════════════════════════════ */}
      <div className="card stg-card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon"><IconDefault /></span>
            <div>
              <div className="stg-card-title">Default Prescription Template</div>
              <p className="stg-card-desc">
                The built-in layout, always available. Customize doctor info, clinic details, logo and watermark below.
                If no custom letterhead is active, this template is used for all prescriptions.
              </p>
            </div>
          </div>
        </div>

        <div className="stg-card-body">
          {settingsLoad ? (
            <div className="stg-rx-tpl-empty"><Spinner size={14} /> Loading…</div>
          ) : (
            <>
              {/* Mini live preview */}
              <div className="dpt-settings-preview-wrap">
                <div className="dpt-settings-preview-inner">
                  <DefaultPrescriptionTemplate
                    clinic={previewClinic}
                    watermark={previewWm}
                    prescription={null}
                    lang="en"
                    isPreview={true}
                  />
                </div>
              </div>
              <div className="dpt-preview-actions">
                <button className="stg-rx-tpl-act" onClick={() => setShowPreview(true)}>
                  <IconEye /> Full Preview
                </button>
                <span className="stg-hint">Updates live as you change settings below</span>
              </div>

              {/* ─ Doctor & Clinic ─ */}
              <div className="dpt-section-title">Doctor &amp; Clinic</div>
              <div className="dpt-form-grid">
                <div className="dpt-field">
                  <label className="dpt-label">Doctor Name</label>
                  <input className="dpt-input" placeholder="e.g. Amit Sharma"
                    value={form.doctor_name} onChange={e => set('doctor_name', e.target.value)} />
                </div>
                <div className="dpt-field">
                  <label className="dpt-label">Qualification</label>
                  <input className="dpt-input" placeholder="e.g. M.B.B.S., M.S."
                    value={form.qualification} onChange={e => set('qualification', e.target.value)} />
                </div>
                <div className="dpt-field">
                  <label className="dpt-label">Registration No.</label>
                  <input className="dpt-input" placeholder="e.g. MMC 2018"
                    value={form.registration_number} onChange={e => set('registration_number', e.target.value)} />
                </div>
                <div className="dpt-field">
                  <label className="dpt-label">Clinic / Hospital Name</label>
                  <input className="dpt-input" placeholder="e.g. City Health Hospital"
                    value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="dpt-field dpt-field--full">
                  <label className="dpt-label">Address</label>
                  <input className="dpt-input" placeholder="e.g. B/503, MG Road, Pune - 411000"
                    value={form.address} onChange={e => set('address', e.target.value)} />
                </div>
                <div className="dpt-field">
                  <label className="dpt-label">Contact / Phone</label>
                  <input className="dpt-input" placeholder="e.g. +91 9876543210"
                    value={form.contact} onChange={e => set('contact', e.target.value)} />
                </div>
                <div className="dpt-field">
                  <label className="dpt-label">Clinic Timing</label>
                  <input className="dpt-input" placeholder="e.g. 09:00 AM - 01:00 PM, 06:00 PM - 08:00 PM"
                    value={form.clinic_timing} onChange={e => set('clinic_timing', e.target.value)} />
                </div>
                <div className="dpt-field">
                  <label className="dpt-label">Closed Days</label>
                  <input className="dpt-input" placeholder="e.g. Sunday"
                    value={form.clinic_days} onChange={e => set('clinic_days', e.target.value)} />
                </div>
              </div>

              {/* ─ Logo ─ */}
              <div className="dpt-section-title">Clinic Logo</div>
              <div className="dpt-logo-row">
                {logoUrl ? (
                  <>
                    <img src={logoUrl} alt="Logo" className="dpt-logo-thumb" />
                    <div className="dpt-logo-btns">
                      <label className="stg-rx-tpl-act dpt-logo-change-btn">
                        <IconUpload /> Change Logo
                        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp"
                          style={{ display: 'none' }} onChange={handleLogoSelect} />
                      </label>
                      <button className="stg-tmpl-del dpt-logo-del-btn" onClick={handleDeleteLogo}>
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dpt-logo-placeholder-box">
                      <IconDefault size={28} />
                      <span>No logo</span>
                    </div>
                    <label className="stg-rx-tpl-act dpt-logo-change-btn">
                      <IconUpload /> Upload Logo
                      <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }} onChange={handleLogoSelect} />
                    </label>
                    <span className="stg-hint">PNG, JPG — shown in prescription header</span>
                  </>
                )}
              </div>

              {/* ─ Watermark ─ */}
              <div className="dpt-section-title">Watermark</div>
              <div className="dpt-wm-row">
                <label className="dpt-wm-toggle">
                  <input type="checkbox" checked={form.watermark_enabled}
                    onChange={e => set('watermark_enabled', e.target.checked)} />
                  <span>Show watermark on prescription</span>
                </label>
              </div>
              {form.watermark_enabled && (
                <div className="dpt-wm-fields">
                  <div className="dpt-field">
                    <label className="dpt-label">Watermark Text</label>
                    <input className="dpt-input" placeholder="Clinora"
                      value={form.watermark_text} onChange={e => set('watermark_text', e.target.value)} />
                  </div>
                  <div className="dpt-field dpt-field--color">
                    <label className="dpt-label">Color</label>
                    <div className="dpt-color-row">
                      <input type="color" className="dpt-color-picker"
                        value={form.watermark_color}
                        onChange={e => set('watermark_color', e.target.value)} />
                      <input className="dpt-input dpt-input--color-hex"
                        value={form.watermark_color}
                        onChange={e => set('watermark_color', e.target.value)}
                        maxLength={7} />
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Save ─ */}
              <div className="dpt-save-row">
                <button className="stg-save-btn" onClick={handleSave} disabled={saving || logoUploading}>
                  {saving || logoUploading ? <><Spinner size={13} /> Saving…</> : 'Save Changes'}
                </button>
                {savedMsg && <span className="dpt-saved-msg">✓ Saved</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ 2 · Active custom template preview ════════════════════════ */}
      {activeTpl?.url && (
        <div className="card stg-card" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="stg-card-head">
            <div className="stg-card-head-row">
              <span className="stg-card-icon"><IconEye /></span>
              <div>
                <div className="stg-card-title">Active Custom Template Preview</div>
                <p className="stg-card-desc">This letterhead overrides the default template for prescriptions.</p>
              </div>
            </div>
          </div>
          <div className="stg-card-body">
            <div className="prx-tpl-preview-wrap">
              <TplMedia url={activeTpl.url} name={activeTpl.name} className="prx-tpl-preview-img" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ 3 · Custom Letterhead Templates ══════════════════════════ */}
      <div className="card stg-card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon"><IconTemplate /></span>
            <div>
              <div className="stg-card-title">Custom Letterhead Templates</div>
              <p className="stg-card-desc">
                Upload your clinic's printed letterhead as an image or PDF. When active, it replaces the default template.
                Deleting all custom templates automatically restores the default.
              </p>
            </div>
          </div>
        </div>

        <div className="stg-card-body">
          {tplLoad ? (
            <div className="stg-rx-tpl-empty"><Spinner size={14} /> Loading…</div>
          ) : tpls.length === 0 ? (
            <div className="stg-rx-tpl-empty prx-tpl-zero">
              <IconTemplate big />
              <div>
                <div className="prx-tpl-zero-title">No custom letterhead uploaded</div>
                <div className="prx-tpl-zero-sub">The default template above is currently active.</div>
              </div>
            </div>
          ) : (
            <div className="stg-rx-tpl-list">
              {tpls.map(t => (
                <div key={t.name} className={`stg-rx-tpl-row${t.is_active ? ' stg-rx-tpl-row--active' : ''}`}>
                  <div className="stg-rx-tpl-thumb">
                    {t.url
                      ? isPdf(t.name) ? <IconPdfBadge /> : <img src={t.url} alt={t.name} />
                      : <IconTemplate />
                    }
                  </div>
                  <div className="stg-rx-tpl-meta">
                    <span className="stg-rx-tpl-name" title={t.name}>{t.name}</span>
                    {t.is_active && <span className="stg-rx-tpl-badge">✓ Active</span>}
                  </div>
                  <div className="stg-rx-tpl-actions">
                    {t.is_active
                      ? <button className="stg-rx-tpl-deact" onClick={handleDeactivate}>Deactivate</button>
                      : <button className="stg-rx-tpl-act"   onClick={() => handleActivate(t.name)}>Activate</button>
                    }
                    <button className="stg-tmpl-del" onClick={() => handleDelete(t.name)} title="Delete">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="stg-rx-tpl-upload-row" style={{ marginTop: tpls.length > 0 ? 14 : 0 }}>
            <label className="stg-rx-tpl-upload-btn">
              {uploading ? <><Spinner size={13} /> Uploading…</> : <><IconUpload /> Upload Letterhead</>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf"
                style={{ display: 'none' }} disabled={uploading} onChange={handleUpload} />
            </label>
            <span className="stg-hint">PNG, JPG, WEBP or PDF — max 10 MB</span>
          </div>
        </div>
      </div>

      {/* ═══ 4 · How it works ══════════════════════════════════════════ */}
      <div className="card stg-card prx-guide-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon"><IconInfo /></span>
            <div><div className="stg-card-title">How it works</div></div>
          </div>
        </div>
        <div className="stg-card-body prx-guide-body">
          <div className="prx-guide-step">
            <span className="prx-guide-num">1</span>
            <span>Fill in doctor &amp; clinic information above and click <strong>Save Changes</strong> — the default template updates immediately.</span>
          </div>
          <div className="prx-guide-step">
            <span className="prx-guide-num">2</span>
            <span>Optionally upload a custom letterhead (clinic's printed pad as image/PDF) and activate it — it overrides the default template.</span>
          </div>
          <div className="prx-guide-step">
            <span className="prx-guide-num">3</span>
            <span>When a custom letterhead is active, prescription data overlays it. When none is active, the fully-styled default template is used.</span>
          </div>
          <div className="prx-guide-step">
            <span className="prx-guide-num">4</span>
            <span>Click <strong>Full Preview</strong> to see exactly how the default template will look before printing.</span>
          </div>
        </div>
      </div>

      {/* ═══ Full Preview Modal ══════════════════════════════════════════ */}
      {showPreview && (
        <div className="dpt-modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="dpt-modal-content" onClick={e => e.stopPropagation()}>
            <div className="dpt-modal-bar">
              <span className="dpt-modal-title">Prescription Preview</span>
              <button className="dpt-modal-close" onClick={() => setShowPreview(false)}>×</button>
            </div>
            <div className="dpt-modal-body">
              <DefaultPrescriptionTemplate
                clinic={previewClinic}
                watermark={previewWm}
                prescription={null}
                lang="en"
                isPreview={true}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────────── */
function isPdf(name) { return name?.toLowerCase().endsWith('.pdf') }

function TplMedia({ url, name, className }) {
  if (!url) return null
  if (isPdf(name)) {
    return <iframe src={url} title="Prescription template" className={className}
      style={{ border: 'none', width: '100%', display: 'block' }} />
  }
  return <img src={url} alt={name ?? 'Prescription template'} className={className} />
}

/* ── Icons ──────────────────────────────────────────────────────── */
function IconDefault({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M8 7h8M8 11h8M8 15h5"/>
    </svg>
  )
}
function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function IconTemplate({ big }) {
  const s = big ? 36 : 16
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  )
}
function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  )
}
function IconPdfBadge() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 2 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span style={{ fontSize: 8, fontWeight: 700, color: '#e53e3e', letterSpacing: '0.05em' }}>PDF</span>
    </div>
  )
}
function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}
