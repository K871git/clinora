import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from 'datatables.net-react'
import DT from 'datatables.net-bs5'
import 'datatables.net-bs5/css/dataTables.bootstrap5.min.css'
import {
  getClinicPrescriptions,
  listTemplates,
  uploadTemplate,
  deleteTemplate,
  setActiveTemplate,
  deletePrescription,
  getPrescriptionPdf,
} from '../../services/prescriptionService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/prescriptions.css'

DataTable.use(DT)

/* ── Helpers ─────────────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6']
const avatarColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

const fmtDate = (s) => s
  ? new Date(s).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—'

/* ── Medicine list cache (keyed by prescription ID, avoids JSON in HTML) */
const _medsCache = new Map()

/* ── Module-level date filter (shared with DT ext.search closure) ─────── */
const _dateFilter = { start: null, end: null }

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

function computeDateRange(key) {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end   = new Date(today.getTime() + 864e5)
  switch (key) {
    case 'today': return { start: today, end }
    case 'week': {
      const s = new Date(today); s.setDate(s.getDate() - s.getDay())
      return { start: s, end }
    }
    case '30d': {
      const s = new Date(today); s.setDate(s.getDate() - 29)
      return { start: s, end }
    }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
    default:
      return { start: null, end: null }
  }
}

/* ── SVG icons (inline strings for DataTables HTML rendering) ─────────── */

const ICON_EYE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const ICON_EDIT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
const ICON_TRASH = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`

/* ── Column definitions ───────────────────────────────────────────────── */

const COLUMNS = [
  {
    title: 'Patient',
    data:  null,
    width: '190px',
    render(data, type, row) {
      if (type !== 'display') return row.patient?.name ?? ''
      const name  = row.patient?.name ?? 'Unknown'
      const color = avatarColor(name)
      return `<div class="d-flex align-items-center gap-2">
        <div class="rx-avatar" style="background:${color}">${name[0].toUpperCase()}</div>
        <span class="fw-semibold">${name}</span>
      </div>`
    },
  },
  {
    title: 'Date',
    data:  'prescribed_at',
    width: '120px',
    render(d, type) {
      if (type !== 'display') return d ?? ''
      return `<span class="rx-cell-date">${fmtDate(d)}</span>`
    },
  },
  {
    title:     'Medicines',
    data:      null,
    orderable: false,
    render(data, type, row) {
      const items = row.items ?? []
      if (type !== 'display') return items.map(i => i.medicine_name).join(', ')
      if (items.length === 0) return '<span class="text-muted">—</span>'
      const allNames = items.map(i => i.medicine_name)
      const totalLen = allNames.join('').length
      _medsCache.set(row.id, allNames)
      if (totalLen <= 20) {
        const badges = allNames.map(n => `<span class="rx-med-badge">${n}</span>`).join('')
        return `<div class="rx-medicine-cell">${badges}</div>`
      }
      const first   = allNames[0]
      const display = first.length > 16 ? first.slice(0, 15) + '…' : first
      return `<div class="rx-medicine-cell">
        <span class="rx-med-badge">${display}</span>
        ${allNames.length > 1 ? `<button class="rx-eye-btn" onclick="event.stopPropagation();window.__rxMedModal&&window.__rxMedModal(${row.id})" title="View all medicines">
          ${ICON_EYE}
        </button>` : ''}
      </div>`
    },
  },
  {
    title: 'Status',
    data:  'status',
    width: '100px',
    render(d, type) {
      if (type !== 'display') return d ?? ''
      const m = STATUS_META[d] ?? { label: d, cls: 'rx-badge' }
      return `<span class="${m.cls}">${m.label}</span>`
    },
  },
  {
    title:     'Actions',
    data:      null,
    orderable: false,
    width:     '140px',
    render(data, type, row) {
      if (type !== 'display') return ''
      const isDraft = row.status === 'draft'
      return `<div class="rx-row-actions">
        <button class="rx-act-btn" onclick="event.stopPropagation();window.__rxViewPdf&&window.__rxViewPdf(${row.id})" title="View PDF">
          ${ICON_EYE} PDF
        </button>
        ${isDraft ? `
        <button class="rx-act-btn" onclick="event.stopPropagation();window.__rxEditRx&&window.__rxEditRx(${row.id})" title="Edit">
          ${ICON_EDIT}
        </button>
        <button class="rx-act-btn rx-act-btn--del" onclick="event.stopPropagation();window.__rxDeleteRx&&window.__rxDeleteRx(${row.id})" title="Delete">
          ${ICON_TRASH}
        </button>` : ''}
      </div>`
    },
  },
]

const DT_OPTIONS = {
  dom:       "<'rx-dt-top'f>rt<'rx-dt-bottom'lip>",
  autoWidth: false,
  pageLength: 15,
  lengthMenu: [10, 15, 25, 50],
  order:      [[1, 'desc']],
  language: {
    search:            '',
    searchPlaceholder: 'Search patient, medicine…',
    lengthMenu:        'Show _MENU_',
    info:              '_START_–_END_ of _TOTAL_',
    infoEmpty:         'No prescriptions',
    infoFiltered:      '(filtered from _MAX_)',
    paginate:          { previous: '‹', next: '›' },
    emptyTable:        'No prescriptions yet.',
    zeroRecords:       'No prescriptions match.',
  },
}

/* ══════════════════════════════════════════════════════════════════════
   TEMPLATES PANEL
   ══════════════════════════════════════════════════════════════════════ */

function TemplatesPanel() {
  const [templates,  setTemplates]  = useState([])
  const [tplStatus,  setTplStatus]  = useState('loading')
  const [uploading,  setUploading]  = useState(false)
  const [uploadPct,  setUploadPct]  = useState(0)
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

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadPct(0)
    try {
      const { data } = await uploadTemplate(file, (ev) => {
        if (ev.total) setUploadPct(Math.round((ev.loaded / ev.total) * 100))
      })
      setTemplates(prev => [...prev, data.data])
    } catch {
      alert('Upload failed. Check file type (PDF/PNG/JPG/WebP) and size (max 10 MB).')
    } finally {
      setUploading(false)
      setUploadPct(0)
    }
  }

  async function handleSetActive(tpl) {
    if (tpl.is_active) return
    setSettingId(tpl.name)
    try {
      await setActiveTemplate(tpl.name)
      setTemplates(prev => prev.map(t => ({ ...t, is_active: t.name === tpl.name })))
    } catch {
      alert('Could not set active template.')
    } finally {
      setSettingId(null)
    }
  }

  async function handleDelete(tpl) {
    if (!window.confirm(`Delete template "${tpl.label}"? This cannot be undone.`)) return
    setDeletingId(tpl.name)
    try {
      await deleteTemplate(tpl.name)
      setTemplates(prev => prev.filter(t => t.name !== tpl.name))
    } catch {
      alert('Could not delete template. It may be a built-in template.')
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
              {uploadPct > 0 ? `${uploadPct}%` : 'Uploading…'}
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

      {tplStatus === 'loading' && (
        <div className="d-flex justify-content-center py-5"><Spinner size={24} /></div>
      )}

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
  const dtApiRef = useRef(null)

  const [pageTab,        setPageTab]        = useState('prescriptions')
  const [prescriptions,  setPrescriptions]  = useState([])
  const [loadStatus,     setLoadStatus]     = useState('loading')
  const [activeTab,      setActiveTab]      = useState('')
  const [dateRange,      setDateRange]      = useState('')
  const [dateDropdown,   setDateDropdown]   = useState(false)
  const [medModal,       setMedModal]       = useState(null)

  useEffect(() => {
    getClinicPrescriptions({ per_page: 1000 })
      .then(({ data }) => {
        setPrescriptions(data.data ?? [])
        setLoadStatus('done')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  // Date filter (DT ext.search)
  useEffect(() => {
    const fn = (settings, data, dataIndex, rowData) => {
      const { start, end } = _dateFilter
      if (!start && !end) return true
      const d = new Date(rowData.prescribed_at)
      if (isNaN(d.getTime())) return true
      if (start && d < start) return false
      if (end   && d >= end)  return false
      return true
    }
    DT.ext.search.push(fn)
    return () => {
      const i = DT.ext.search.indexOf(fn)
      if (i >= 0) DT.ext.search.splice(i, 1)
    }
  }, [])

  // Medicine modal
  useEffect(() => {
    window.__rxMedModal = (id) => setMedModal(_medsCache.get(id) ?? [])
    return () => { delete window.__rxMedModal }
  }, [])

  // Row action handlers
  useEffect(() => {
    window.__rxViewPdf = async (id) => {
      try {
        const { data } = await getPrescriptionPdf(id)
        const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch {
        alert('Could not generate PDF. Ensure a template is active.')
      }
    }
    window.__rxEditRx = (id) => navigate(`/prescriptions/${id}`)
    window.__rxDeleteRx = async (id) => {
      if (!window.confirm('Delete this prescription? This cannot be undone.')) return
      try {
        await deletePrescription(id)
        setPrescriptions(prev => prev.filter(p => p.id !== Number(id)))
      } catch {
        alert('Could not delete — please try again.')
      }
    }
    return () => {
      delete window.__rxViewPdf
      delete window.__rxEditRx
      delete window.__rxDeleteRx
    }
  }, [navigate])

  // Close date dropdown on outside click
  useEffect(() => {
    if (!dateDropdown) return
    const h = () => setDateDropdown(false)
    document.addEventListener('click', h, true)
    return () => document.removeEventListener('click', h, true)
  }, [dateDropdown])

  function handleStatusFilter(key) {
    setActiveTab(key)
    dtApiRef.current?.column(3).search(key ? `^${key}$` : '', true, false).draw()
  }

  function handleDateFilter(key) {
    setDateRange(key)
    setDateDropdown(false)
    const r = computeDateRange(key)
    _dateFilter.start = r.start
    _dateFilter.end   = r.end
    dtApiRef.current?.draw()
  }

  const options = useMemo(() => ({
    ...DT_OPTIONS,
    initComplete() { dtApiRef.current = this.api() },
    createdRow(row, data) {
      row.style.cursor = 'pointer'
      row.tabIndex     = 0
      row.addEventListener('click', (e) => {
        if (e.target.closest('.rx-eye-btn, .rx-act-btn, .rx-row-actions')) return
        navigate(`/prescriptions/${data.id}`)
      })
      row.addEventListener('keydown', (e) => e.key === 'Enter' && navigate(`/prescriptions/${data.id}`))
    },
  }), [navigate])

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
                <span className="rx-count-badge">{prescriptions.length.toLocaleString()}</span>
              )}
            </div>

            <div className="rx-header-right">
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
                        onClick={() => handleDateFilter(r.key)}
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
                    onClick={() => handleStatusFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadStatus === 'loading' && (
            <div className="d-flex justify-content-center align-items-center py-5">
              <Spinner size={28} />
            </div>
          )}

          {loadStatus === 'error' && (
            <div className="card state-panel">
              Could not load prescriptions — check your connection.
            </div>
          )}

          {loadStatus === 'done' && (
            <div className="card p-3 rx-table-wrap">
              <DataTable
                className="table table-hover align-middle w-100"
                data={prescriptions}
                columns={COLUMNS}
                options={options}
              >
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Medicines</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
              </DataTable>
            </div>
          )}
        </>
      )}

      {/* ══ TEMPLATES TAB ══ */}
      {pageTab === 'templates' && <TemplatesPanel />}

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
