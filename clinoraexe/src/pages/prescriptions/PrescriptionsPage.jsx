import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getClinicPrescriptions,
  getPrescription,
  updatePrescription,
  sendPrescription,
  listTemplates,
  uploadTemplate,
  deleteTemplate,
  setActiveTemplate,
  deletePrescription,
} from '../../services/prescriptionService'
import { toast } from 'sonner'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import '../../styles/prescriptions.css'
import { confirmDelete } from '../../lib/swal'

/* ── Edit modal helpers ──────────────────────────────────────── */
function newMedItem(o = {}) {
  return { id: Math.random().toString(36).slice(2), medicine_name: '', dosage: '', instructions: '', ...o }
}
function itemsFromApi(apiItems) {
  return (apiItems ?? []).map(s => newMedItem({
    medicine_name: s.medicine_name,
    dosage:        s.dosage        ?? '',
    instructions:  s.instructions  ?? '',
  }))
}
function itemsForApi(items) {
  return items.map((item, idx) => ({
    medicine_name: item.medicine_name.trim(),
    dosage:        item.dosage.trim()       || null,
    frequency:     null,
    duration:      null,
    instructions:  item.instructions.trim() || null,
    sort_order:    idx,
  }))
}

function MedEditor({ items, onChange }) {
  function update(id, field, val) { onChange(items.map(m => m.id === id ? { ...m, [field]: val } : m)) }
  function remove(id) { if (items.length > 1) onChange(items.filter(m => m.id !== id)) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, idx) => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6, padding: '10px 12px', border: '1px solid var(--clr-border)', borderRadius: 8, background: 'var(--clr-bg-subtle)' }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <input className="field" placeholder={`Medicine ${idx + 1} *`} value={item.medicine_name}
              onChange={e => update(item.id, 'medicine_name', e.target.value)} style={{ fontSize: 13 }} />
          </div>
          <button type="button" onClick={() => remove(item.id)}
            style={{ gridColumn: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)', fontSize: 18, lineHeight: 1, opacity: items.length === 1 ? 0.3 : 1 }}
            disabled={items.length === 1}>×</button>
          <input className="field" placeholder="Dosage (1-0-1)" value={item.dosage}
            onChange={e => update(item.id, 'dosage', e.target.value)} style={{ fontSize: 12 }} />
          <input className="field" placeholder="Instructions" value={item.instructions}
            onChange={e => update(item.id, 'instructions', e.target.value)} style={{ fontSize: 12 }} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, newMedItem()])}
        style={{ alignSelf: 'flex-start', padding: '5px 14px', fontSize: 12, border: '1px dashed var(--clr-border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)' }}>
        + Add Medicine
      </button>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6']
const avatarColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

const fmtDate = (s) => s
  ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—'

/* ── Status metadata ─────────────────────────────────────────────────── */
const STATUS_META = {
  draft:            { label: 'Draft',       cls: 'rx-badge rx-badge--draft' },
  sent_to_pharmacy: { label: 'Sent',        cls: 'rx-badge rx-badge--sent' },
  dispensing:       { label: 'Dispensing',  cls: 'rx-badge rx-badge--dispensing' },
  completed:        { label: 'Completed',   cls: 'rx-badge rx-badge--done' },
}

const STATUS_TABS = [
  { key: '',                 label: 'All' },
  { key: 'draft',            label: 'Draft' },
  { key: 'sent_to_pharmacy', label: 'Sent' },
  { key: 'dispensing',       label: 'Dispensing' },
  { key: 'completed',        label: 'Completed' },
]

const DATE_RANGES = [
  { key: '',      label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
]

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function computeDateRange(key) {
  const now = new Date()
  const todayStr = localDateStr(now)
  switch (key) {
    case 'today': return { startStr: todayStr, endStr: todayStr }
    case 'week': {
      const s = new Date(now); s.setDate(s.getDate() - s.getDay())
      return { startStr: localDateStr(s), endStr: todayStr }
    }
    case '30d': {
      const s = new Date(now); s.setDate(s.getDate() - 29)
      return { startStr: localDateStr(s), endStr: todayStr }
    }
    case 'month':
      return { startStr: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, endStr: todayStr }
    default:
      return { startStr: null, endStr: null }
  }
}

const PAGE_SIZE = 15

/* ── Sort chevron ────────────────────────────────────────────────────── */
function RxSort({ col, sortCol, sortDir }) {
  const active = sortCol === col
  return (
    <span className={`rx-sort${active ? ' rx-sort--active' : ''}`}>
      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
        <path d="M4 0L7.5 5H.5z" opacity={active && sortDir === 'asc' ? 1 : 0.3} />
        <path d="M4 12L.5 7h7z" opacity={active && sortDir === 'desc' ? 1 : 0.3} />
      </svg>
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   TEMPLATES PANEL
   ══════════════════════════════════════════════════════════════════════ */

function TemplatesPanel() {
  const [templates,  setTemplates]  = useState([])
  const [tplStatus,  setTplStatus]  = useState('loading')
  const [uploading,  setUploading]  = useState(false)
  const [settingId,  setSettingId]  = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    listTemplates()
      .then(({ data }) => {
        setTemplates(data.data ?? [])
        setTplStatus('done')
      })
      .catch(() => setTplStatus('error'))
  }, [])

  const [tplError, setTplError] = useState(null)

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setTplError(null)
    try {
      const { data } = await uploadTemplate(file)
      setTemplates(prev => [...prev, data])
    } catch {
      setTplError('Upload failed. Check file type (PDF/PNG/JPG/WebP) and size (max 10 MB).')
    } finally {
      setUploading(false)
    }
  }

  async function handleSetActive(tpl) {
    if (tpl.is_active) return
    setSettingId(tpl.name)
    setTplError(null)
    try {
      await setActiveTemplate(tpl.name)
      setTemplates(prev => prev.map(t => ({ ...t, is_active: t.name === tpl.name })))
    } catch {
      setTplError('Could not set active template.')
    } finally {
      setSettingId(null)
    }
  }

  async function handleDelete(tpl) {
    const ok = await confirmDelete({ title: `Delete "${tpl.label}"?`, text: 'This template cannot be recovered.' })
    if (!ok) return
    setDeletingId(tpl.name)
    setTplError(null)
    try {
      await deleteTemplate(tpl.name)
      setTemplates(prev => prev.filter(t => t.name !== tpl.name))
    } catch {
      setTplError('Could not delete template. It may be a built-in template.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="card p-4">
      <div className="tpl-panel-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--clr-text)', marginBottom: 4 }}>
            Prescription Templates
          </div>
          <p className="tpl-panel-title">
            Upload your clinic's prescription pad (PDF or image). The active template appears as the background when printing prescriptions.
          </p>
        </div>
        <button
          className="tpl-upload-btn"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Spinner size={14} />
              Uploading…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Upload Template
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {tplError && (
        <div className="form-alert danger" style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{tplError}</span>
          <button onClick={() => setTplError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, color: 'inherit' }}>✕</button>
        </div>
      )}
      {tplStatus === 'loading' && <PageLoader />}

      {tplStatus === 'error' && (
        <div className="tpl-empty">
          <p className="tpl-empty-title">Could not load templates</p>
          <p className="tpl-empty-desc">Check your connection and refresh the page.</p>
        </div>
      )}

      {tplStatus === 'done' && templates.length === 0 && (
        <div className="tpl-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="tpl-empty-title">No templates yet</p>
          <p className="tpl-empty-desc">
            Upload a scan or PDF of your clinic's prescription pad.
          </p>
        </div>
      )}

      {tplStatus === 'done' && templates.length > 0 && (
        <div className="tpl-grid">
          {templates.map(tpl => (
            <div key={tpl.name} className={`tpl-card${tpl.is_active ? ' is-active' : ''}`}>
              <div className="tpl-thumb">
                {tpl.type === 'image' ? (
                  <img src={tpl.url} alt={tpl.label} loading="lazy" />
                ) : (
                  <div className="tpl-pdf-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    <span>PDF</span>
                  </div>
                )}
                {tpl.is_active && <span className="tpl-active-badge">Active</span>}
              </div>
              <div className="tpl-info">
                <div className="tpl-name" title={tpl.label}>{tpl.label}</div>
                <div className="tpl-source">{tpl.type} · {tpl.source === 'legacy' ? 'Built-in' : 'Uploaded'}</div>
              </div>
              <div className="tpl-actions">
                <button
                  className={`tpl-btn tpl-btn-set${tpl.is_active ? ' is-active' : ''}`}
                  onClick={() => handleSetActive(tpl)}
                  disabled={tpl.is_active || settingId === tpl.name}
                >
                  {settingId === tpl.name ? <Spinner size={11} /> : tpl.is_active ? '✓ Active' : 'Set Active'}
                </button>
                {tpl.source !== 'legacy' && (
                  <button
                    className="tpl-btn tpl-btn-del"
                    onClick={() => handleDelete(tpl)}
                    disabled={deletingId === tpl.name}
                    title="Delete template"
                  >
                    {deletingId === tpl.name ? <Spinner size={11} /> : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PRESCRIPTIONS PAGE
   ══════════════════════════════════════════════════════════════════════ */

export default function PrescriptionsPage() {
  const navigate = useNavigate()

  const [pageTab,        setPageTab]        = useState('prescriptions')
  const [prescriptions,  setPrescriptions]  = useState([])
  const [loadStatus,     setLoadStatus]     = useState('loading')
  const [activeTab,      setActiveTab]      = useState('')
  const [dateRange,      setDateRange]      = useState('')
  const [dateDropdown,   setDateDropdown]   = useState(false)
  const [medModal,       setMedModal]       = useState(null)
  const [search,         setSearch]         = useState('')
  const [sortCol,        setSortCol]        = useState('prescribed_at')
  const [sortDir,        setSortDir]        = useState('desc')
  const [page,           setPage]           = useState(0)
  const [rxError,        setRxError]        = useState(null)

  /* Edit modal */
  const [editRx,      setEditRx]      = useState(null)
  const [editLoading, setEditLoading] = useState(null)
  const [editItems,   setEditItems]   = useState([])
  const [editNotes,   setEditNotes]   = useState('')
  const [editSaving,  setEditSaving]  = useState(false)

  /* Send to pharmacy */
  const [sendingId, setSendingId] = useState(null)

  const filteredPrescriptions = useMemo(() => {
    let list = prescriptions
    if (activeTab) {
      list = list.filter(p => p.status === activeTab)
    }
    if (dateRange) {
      const { startStr, endStr } = computeDateRange(dateRange)
      if (startStr) {
        list = list.filter(p => {
          if (!p.prescribed_at) return false
          const dateStr = p.prescribed_at.slice(0, 10)
          return dateStr >= startStr && dateStr <= endStr
        })
      }
    }
    return list
  }, [prescriptions, activeTab, dateRange])

  const sorted = useMemo(() => {
    let list = filteredPrescriptions
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p => {
        const name = (p.patient?.name ?? '').toLowerCase()
        const meds = (p.items ?? []).map(i => i.medicine_name).join(' ').toLowerCase()
        return name.includes(q) || meds.includes(q)
      })
    }
    return [...list].sort((a, b) => {
      let av, bv
      if (sortCol === 'patient') {
        av = (a.patient?.name ?? '').toLowerCase()
        bv = (b.patient?.name ?? '').toLowerCase()
      } else if (sortCol === 'status') {
        av = a.status ?? ''
        bv = b.status ?? ''
      } else {
        av = a.prescribed_at ?? ''
        bv = b.prescribed_at ?? ''
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredPrescriptions, search, sortCol, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search, sortCol, sortDir, activeTab, dateRange])

  useEffect(() => {
    getClinicPrescriptions({ per_page: 1000 })
      .then(({ data }) => {
        setPrescriptions(data.data ?? [])
        setLoadStatus('done')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  useEffect(() => {
    if (!dateDropdown) return
    const h = () => setDateDropdown(false)
    document.addEventListener('click', h, true)
    return () => document.removeEventListener('click', h, true)
  }, [dateDropdown])

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  async function handleDelete(e, rx) {
    e.stopPropagation()
    const ok = await confirmDelete({ title: 'Delete prescription?', text: 'This cannot be undone.' })
    if (!ok) return
    setRxError(null)
    try {
      await deletePrescription(rx.id)
      setPrescriptions(prev => prev.filter(p => p.id !== rx.id))
    } catch {
      setRxError('Could not delete prescription — please try again.')
    }
  }

  async function handleEdit(e, rx) {
    e.stopPropagation()
    setEditLoading(rx.id)
    try {
      const { data } = await getPrescription(rx.id)
      setEditRx(data)
      setEditItems(itemsFromApi(data.items ?? []))
      setEditNotes(data.doctor_notes ?? '')
    } catch {
      toast.error('Could not load prescription')
    } finally {
      setEditLoading(null)
    }
  }

  async function handleEditSave() {
    if (editItems.some(i => !i.medicine_name.trim())) {
      toast.error('All medicines need a name'); return
    }
    setEditSaving(true)
    try {
      const { data } = await updatePrescription(editRx.id, {
        prescribed_at: editRx.prescribed_at,
        doctor_notes:  editNotes.trim() || null,
        items:         itemsForApi(editItems),
      })
      setPrescriptions(prev => prev.map(p => p.id === data.id ? { ...p, items: data.items, doctor_notes: data.doctor_notes } : p))
      setEditRx(null)
      toast.success('Prescription updated')
    } catch {
      toast.error('Could not save changes')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleSendRow(e, rx) {
    e.stopPropagation()
    setSendingId(rx.id)
    try {
      const { data } = await sendPrescription(rx.id)
      setPrescriptions(prev => prev.map(p => p.id === rx.id ? { ...p, status: data.status } : p))
      toast.success(`Sent to pharmacy — ${rx.patient?.name}`)
    } catch {
      toast.error('Could not send to pharmacy')
    } finally {
      setSendingId(null)
    }
  }

  const dateLabel = DATE_RANGES.find(r => r.key === dateRange)?.label ?? 'All Time'

  return (
    <div>
      {/* Page-level tabs */}
      <div className="rx-page-tabs">
        <button
          className={`rx-page-tab${pageTab === 'prescriptions' ? ' active' : ''}`}
          onClick={() => setPageTab('prescriptions')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          Prescriptions
          {prescriptions.length > 0 && (
            <span className="rx-page-tab-count">{prescriptions.length}</span>
          )}
        </button>
        <button
          className={`rx-page-tab${pageTab === 'templates' ? ' active' : ''}`}
          onClick={() => setPageTab('templates')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Templates
        </button>
      </div>

      {/* ══ PRESCRIPTIONS TAB ══ */}
      {pageTab === 'prescriptions' && (
        <>
          {/* Header */}
          <div className="rx-header">
            <div className="rx-header-left">
              <h1 className="rx-title">Prescriptions</h1>
              {prescriptions.length > 0 && (
                <span className="rx-count-badge">
                  {sorted.length !== prescriptions.length
                    ? `${sorted.length} / ${prescriptions.length}`
                    : prescriptions.length.toLocaleString()}
                </span>
              )}
            </div>

            <div className="rx-header-right">
              <button className="btn-primary" style={{ fontSize: 13, padding: '0 14px', height: 34 }} onClick={() => navigate('/prescriptions/new')}>
                + New Prescription
              </button>
              {/* Date range dropdown */}
              <div className="rx-date-filter" onClick={e => e.stopPropagation()}>
                <button
                  className={`rx-date-btn${dateRange ? ' active' : ''}`}
                  onClick={() => setDateDropdown(v => !v)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {dateLabel}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {dateDropdown && (
                  <div className="rx-date-menu">
                    {DATE_RANGES.map(r => (
                      <button
                        key={r.key}
                        className={`rx-date-item${dateRange === r.key ? ' active' : ''}`}
                        onClick={() => { setDateRange(r.key); setDateDropdown(false) }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status filter pills */}
              <div className="rx-status-filters">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.key}
                    className={`rx-status-pill${activeTab === tab.key ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {rxError && (
            <div className="form-alert danger" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{rxError}</span>
              <button onClick={() => setRxError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, color: 'inherit' }}>✕</button>
            </div>
          )}

          {loadStatus === 'loading' && <PageLoader />}

          {loadStatus === 'error' && (
            <div className="card state-panel">
              Could not load prescriptions — check your connection.
            </div>
          )}

          {loadStatus === 'done' && (
            <div className="card p-3 rx-table-wrap">
              {/* Search toolbar */}
              <div className="rx-toolbar">
                <div className="rx-search-wrap">
                  <svg className="rx-search-icon" width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="5.5"/><path d="M12.5 12.5l3 3"/>
                  </svg>
                  <input
                    className="rx-search"
                    type="text"
                    placeholder="Search patient, medicine…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <table className="rx-custom-table">
                <thead>
                  <tr>
                    <th className="rx-th rx-th--sortable" onClick={() => toggleSort('patient')}>
                      Patient <RxSort col="patient" sortCol={sortCol} sortDir={sortDir} />
                    </th>
                    <th className="rx-th rx-th--sortable" onClick={() => toggleSort('prescribed_at')}>
                      Date <RxSort col="prescribed_at" sortCol={sortCol} sortDir={sortDir} />
                    </th>
                    <th className="rx-th">Medicines</th>
                    <th className="rx-th rx-th--sortable" onClick={() => toggleSort('status')}>
                      Status <RxSort col="status" sortCol={sortCol} sortDir={sortDir} />
                    </th>
                    <th className="rx-th rx-th--actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={5} className="rx-td-empty">
                        {search ? 'No prescriptions match your search.' : 'No prescriptions yet.'}
                      </td>
                    </tr>
                  )}
                  {paginated.map(rx => {
                    const name    = rx.patient?.name ?? 'Unknown'
                    const color   = avatarColor(name)
                    const items   = rx.items ?? []
                    const allMeds = items.map(i => i.medicine_name)
                    const meta    = STATUS_META[rx.status] ?? { label: rx.status, cls: 'rx-badge' }
                    const isDraft = rx.status === 'draft'
                    const firstMed = allMeds[0]
                    const medDisplay = firstMed && firstMed.length > 16
                      ? firstMed.slice(0, 15) + '…'
                      : firstMed

                    return (
                      <tr key={rx.id} className="rx-tr">
                        <td className="rx-td">
                          <div className="rx-patient-cell">
                            <div className="rx-avatar" style={{ background: color }}>
                              {name[0].toUpperCase()}
                            </div>
                            <span className="rx-patient-name">{name}</span>
                          </div>
                        </td>
                        <td className="rx-td">
                          <span className="rx-cell-date">{fmtDate(rx.prescribed_at)}</span>
                        </td>
                        <td className="rx-td">
                          {allMeds.length === 0 ? (
                            <span className="rx-td-muted">—</span>
                          ) : (
                            <div className="rx-medicine-cell">
                              <span className="rx-med-badge">{medDisplay}</span>
                              {allMeds.length > 1 && (
                                <button
                                  className="rx-eye-btn"
                                  title="View all medicines"
                                  onClick={e => { e.stopPropagation(); setMedModal(allMeds) }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="rx-td">
                          <span className={meta.cls}>{meta.label}</span>
                        </td>
                        <td className="rx-td">
                          <div className="rx-row-actions">
                            {/* View PDF */}
                            <button className="rx-act-btn" title="View PDF"
                              onClick={() => navigate(`/prescriptions/${rx.id}/print`)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              PDF
                            </button>

                            {/* Edit — draft only */}
                            {isDraft && (
                              <button className="rx-act-btn" title="Edit prescription"
                                onClick={e => handleEdit(e, rx)}
                                disabled={editLoading === rx.id}>
                                {editLoading === rx.id ? <Spinner size={11} /> : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                )}
                                Edit
                              </button>
                            )}

                            {/* Doctor Invoice */}
                            {rx.visit_id && (
                              <button className="rx-act-btn rx-act-btn--invoice" title="Doctor Invoice"
                                onClick={() => navigate(`/visits/${rx.visit_id}/invoice`)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <line x1="8" y1="12" x2="16" y2="12"/>
                                  <line x1="8" y1="16" x2="12" y2="16"/>
                                </svg>
                                Invoice
                              </button>
                            )}

                            {/* Send to Pharmacy — draft only */}
                            {isDraft && (
                              <button className="rx-act-btn rx-act-btn--send" title="Send to pharmacy"
                                onClick={e => handleSendRow(e, rx)}
                                disabled={sendingId === rx.id}>
                                {sendingId === rx.id ? <Spinner size={11} /> : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"/>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                  </svg>
                                )}
                                Send
                              </button>
                            )}

                            {/* Delete — draft only */}
                            {isDraft && (
                              <button className="rx-act-btn rx-act-btn--del" title="Delete"
                                onClick={e => handleDelete(e, rx)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14H6L5 6"/>
                                  <path d="M10 11v6M14 11v6"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Table footer */}
              {sorted.length > 0 && (
                <div className="rx-table-footer">
                  <span className="rx-table-info">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div className="rx-pagination">
                    <button
                      className="rx-page-btn"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                    >‹</button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        className={`rx-page-btn${page === i ? ' active' : ''}`}
                        onClick={() => setPage(i)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      className="rx-page-btn"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                    >›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ TEMPLATES TAB ══ */}
      {pageTab === 'templates' && <TemplatesPanel />}

      {/* ── Edit modal ── */}
      {editRx && (
        <div className="rx-edit-overlay" onClick={() => !editSaving && setEditRx(null)}>
          <div className="rx-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="rx-edit-header">
              <div>
                <div className="rx-edit-title">Edit Prescription</div>
                <div className="rx-edit-patient">{editRx.patient?.name}</div>
              </div>
              <button className="rx-edit-close" onClick={() => setEditRx(null)} disabled={editSaving}>×</button>
            </div>
            <div className="rx-edit-body">
              <div className="rx-edit-section-label">Medicines</div>
              <MedEditor items={editItems} onChange={setEditItems} />
              <div className="rx-edit-section-label" style={{ marginTop: 18 }}>Doctor Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
              <textarea className="field" style={{ minHeight: 72, resize: 'vertical', fontSize: 13 }}
                value={editNotes} onChange={e => setEditNotes(e.target.value)}
                placeholder="Diagnosis, instructions…" />
            </div>
            <div className="rx-edit-footer">
              <button className="btn-secondary" onClick={() => setEditRx(null)} disabled={editSaving}>Cancel</button>
              <button className="btn-primary" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medicine modal */}
      {medModal && (
        <>
          <div className="rx-modal-backdrop" onClick={() => setMedModal(null)} />
          <div className="rx-modal" role="dialog" aria-modal="true" aria-label="Medicines">
            <div className="rx-modal-header">
              <span className="rx-modal-title">Medicines</span>
              <button className="rx-modal-close" onClick={() => setMedModal(null)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="rx-modal-body">
              <div className="rx-modal-meds">
                {medModal.map((med, i) => (
                  <span key={i} className="rx-med-badge rx-med-badge--lg">{med}</span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
