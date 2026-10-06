import '../../styles/settings-page.css'
import { useState, useEffect, useRef } from 'react'
import { getTemplates, uploadTemplate, deleteTemplate, setActiveTemplate } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'

export default function PrescriptionSettingsPage() {
  const [tpls,      setTpls]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    getTemplates()
      .then(({ data }) => { setTpls(data.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
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

  const activeTpl = tpls.find(t => t.is_active)

  return (
    <div className="stg-page">

      {/* Active template preview */}
      {activeTpl?.url && (
        <div className="card stg-card" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="stg-card-head">
            <div className="stg-card-head-row">
              <span className="stg-card-icon">
                <IconEye />
              </span>
              <div>
                <div className="stg-card-title">Active Template Preview</div>
                <p className="stg-card-desc">This is the letterhead that will appear at the top of every prescription preview and printout.</p>
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

      {/* Template management */}
      <div className="card stg-card">
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon">
              <IconTemplate />
            </span>
            <div>
              <div className="stg-card-title">Letterhead Templates</div>
              <p className="stg-card-desc">
                Upload your clinic's printed letterhead as an image or PDF. Activate one — the prescription preview will display it as the header before the medicines list.
              </p>
            </div>
          </div>
        </div>

        <div className="stg-card-body">
          {loading ? (
            <div className="stg-rx-tpl-empty"><Spinner size={14} /> Loading…</div>
          ) : tpls.length === 0 ? (
            <div className="stg-rx-tpl-empty prx-tpl-zero">
              <IconTemplate big />
              <div>
                <div className="prx-tpl-zero-title">No letterhead uploaded yet</div>
                <div className="prx-tpl-zero-sub">Upload a PNG, JPG or PDF of your clinic's printed prescription paper.</div>
              </div>
            </div>
          ) : (
            <div className="stg-rx-tpl-list">
              {tpls.map(t => (
                <div key={t.name} className={`stg-rx-tpl-row${t.is_active ? ' stg-rx-tpl-row--active' : ''}`}>
                  <div className="stg-rx-tpl-thumb">
                    {t.url
                      ? isPdf(t.name)
                        ? <IconPdfBadge />
                        : <img src={t.url} alt={t.name} />
                      : <IconTemplate />
                    }
                  </div>
                  <div className="stg-rx-tpl-meta">
                    <span className="stg-rx-tpl-name" title={t.name}>{t.name}</span>
                    {t.is_active && <span className="stg-rx-tpl-badge">✓ Active</span>}
                  </div>
                  <div className="stg-rx-tpl-actions">
                    {t.is_active ? (
                      <button className="stg-rx-tpl-deact" onClick={handleDeactivate}>Deactivate</button>
                    ) : (
                      <button className="stg-rx-tpl-act" onClick={() => handleActivate(t.name)}>Activate</button>
                    )}
                    <button className="stg-tmpl-del" onClick={() => handleDelete(t.name)} title="Delete">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="stg-rx-tpl-upload-row" style={{ marginTop: tpls.length > 0 ? 14 : 0 }}>
            <label className="stg-rx-tpl-upload-btn">
              {uploading ? (
                <><Spinner size={13} /> Uploading…</>
              ) : (
                <>
                  <IconUpload />
                  Upload Letterhead
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
            <span className="stg-hint">PNG, JPG, WEBP or PDF — max 10 MB</span>
          </div>
        </div>
      </div>

      {/* Usage guide */}
      <div className="card stg-card prx-guide-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="stg-card-head">
          <div className="stg-card-head-row">
            <span className="stg-card-icon"><IconInfo /></span>
            <div>
              <div className="stg-card-title">How it works</div>
            </div>
          </div>
        </div>
        <div className="stg-card-body prx-guide-body">
          <div className="prx-guide-step">
            <span className="prx-guide-num">1</span>
            <span>Upload a photo or scan of your clinic's printed prescription letterhead.</span>
          </div>
          <div className="prx-guide-step">
            <span className="prx-guide-num">2</span>
            <span>Click <strong>Activate</strong> on the template you want to use.</span>
          </div>
          <div className="prx-guide-step">
            <span className="prx-guide-num">3</span>
            <span>In the New Prescription page, click <strong>Preview</strong> — your letterhead will appear at the top, followed by the patient details and medicine list.</span>
          </div>
          <div className="prx-guide-step">
            <span className="prx-guide-num">4</span>
            <span>Click <strong>Print</strong> to print on your actual letterhead paper, or print directly from the preview.</span>
          </div>
        </div>
      </div>

    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────────── */
function isPdf(name) {
  return name?.toLowerCase().endsWith('.pdf')
}

function TplMedia({ url, name, className }) {
  if (!url) return null
  if (isPdf(name)) {
    return (
      <iframe
        src={url}
        title="Prescription template"
        className={className}
        style={{ border: 'none', width: '100%', display: 'block' }}
      />
    )
  }
  return <img src={url} alt={name ?? 'Prescription template'} className={className} />
}

/* ── Icons ─────────────────────────────────────────────────────── */
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
function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
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
