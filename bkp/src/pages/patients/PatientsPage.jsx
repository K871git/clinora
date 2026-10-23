import { useState, useEffect, useMemo } from 'react'
import { useSessionState } from '../../hooks/useSessionState'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { listPatients } from '../../services/patientService'
import PatientFormModal from './PatientFormModal'
import PageLoader from '../../components/ui/PageLoader'
import EmptyState from '../../components/ui/EmptyState'
import '../../styles/patients.css'

/* ── Helpers ─────────────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6']
const avatarColor  = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const isNew         = (d)    => Date.now() - new Date(d).getTime() < 2 * 24 * 60 * 60 * 1000
const isRevisitDue  = (d)    => d && Date.now() - new Date(d).getTime() > 180 * 24 * 60 * 60 * 1000
const fmtDate      = (s)    => s
  ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
  : null
const capitalize   = (s)    => s ? s[0].toUpperCase() + s.slice(1) : null

/* ── Export helpers ─────────────────────────────────────────────────── */

const EXPORT_COLS = ['Name', 'Contact', 'Age', 'Gender', 'Last Visit']

function patientRow(r) {
  return [
    r.name,
    r.mobile || '',
    r.age != null ? r.age : '',
    capitalize(r.gender) || '',
    r.last_visit_at ? fmtDate(r.last_visit_at) : 'Never',
  ]
}

function buildCsv(rows) {
  const BOM  = '﻿'
  const body = [EXPORT_COLS, ...rows.map(patientRow)]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  return BOM + body
}

function doExportCopy(rows) {
  const text = [EXPORT_COLS, ...rows.map(patientRow)].map(r => r.join('\t')).join('\n')
  navigator.clipboard.writeText(text)
    .then(() => toast.success('Copied to clipboard'))
    .catch(() => toast.error('Copy failed'))
}

function doExportCsv(rows) {
  invoke('write_text_to_downloads', { content: buildCsv(rows), filename: 'patients.csv' })
    .then(saved => toast.success(`Exported to Downloads: ${saved}`))
    .catch(() => toast.error('Export failed'))
}

function doExportExcel(rows) {
  const data = rows.map(r => ({
    'Name':       r.name,
    'Contact':    r.mobile || '',
    'Age':        r.age ?? '',
    'Gender':     capitalize(r.gender) || '',
    'Last Visit': r.last_visit_at ? fmtDate(r.last_visit_at) : 'Never',
  }))
  const ws  = XLSX.utils.json_to_sheet(data)
  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Patients')
  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
  invoke('write_bytes_to_downloads', { b64, filename: 'patients.xlsx' })
    .then(saved => toast.success(`Exported to Downloads: ${saved}`))
    .catch(() => toast.error('Export failed'))
}

/* ── Time-ago helper ─────────────────────────────────────────────────── */

function timeAgo(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

/* ── Sorting ─────────────────────────────────────────────────────────── */

const PAGE_SIZE = 15

const SORT_FNS = {
  name:       (a, b) => a.name.localeCompare(b.name),
  age:        (a, b) => (a.age ?? -1) - (b.age ?? -1),
  gender:     (a, b) => (a.gender ?? '').localeCompare(b.gender ?? ''),
  last_visit: (a, b) => {
    if (!a.last_visit_at && !b.last_visit_at) return 0
    if (!a.last_visit_at) return 1
    if (!b.last_visit_at) return -1
    return new Date(b.last_visit_at) - new Date(a.last_visit_at)
  },
}

function SortChevron({ col, sortCol, sortDir }) {
  const active = sortCol === col
  const up   = !active || sortDir === 'asc'
  const down = !active || sortDir === 'desc'
  return (
    <span className={`pt-sort${active ? ' pt-sort--active' : ''}`} aria-hidden="true">
      {up   && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 4L3.5 1L6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'desc' ? 0.3 : 1}/></svg>}
      {down && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 1L3.5 4L6 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'asc' ? 0.3 : 1}/></svg>}
    </span>
  )
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [status,   setStatus]   = useState('loading')
  const [showAdd,  setShowAdd]  = useState(
    () => new URLSearchParams(window.location.search).get('new') === '1'
  )
  const [search,   setSearch]   = useSessionState('patients:search', '')
  const [sortCol,  setSortCol]  = useSessionState('patients:sort-col', 'name')
  const [sortDir,  setSortDir]  = useSessionState('patients:sort-dir', 'asc')
  const [page,     setPage]     = useState(1)

  useEffect(() => {
    if (window.location.search.includes('new=1'))
      window.history.replaceState({}, '', window.location.pathname)
    listPatients({ per_page: 1000 })
      .then(({ data }) => { setPatients(data.data ?? []); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? patients.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.mobile ?? '').includes(q) ||
          (p.gender ?? '').toLowerCase().includes(q)
        )
      : patients
    const cmp = SORT_FNS[sortCol] ?? SORT_FNS.name
    return [...list].sort((a, b) => sortDir === 'asc' ? cmp(a, b) : -cmp(a, b))
  }, [patients, search, sortCol, sortDir])

  useEffect(() => { setPage(1) }, [search])

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const newCount    = patients.filter(p => isNew(p.created_at)).length
  const revisitCount = patients.filter(p => !isNew(p.created_at) && isRevisitDue(p.last_visit_at)).length

  return (
    <div className="ptl-page">

      {/* ── Page header ── */}
      <div className="ptl-hdr">
        <div className="ptl-hdr-info">
          <h1 className="ptl-title">Patients</h1>
          <p className="ptl-sub">Registry · records · visit history</p>
        </div>

        {status === 'done' && patients.length > 0 && (
          <div className="ptl-hdr-stats">
            <div className="ptl-stat">
              <span className="ptl-stat-val">{patients.length.toLocaleString()}</span>
              <span className="ptl-stat-lbl">Total</span>
            </div>
            {newCount > 0 && (
              <div className="ptl-stat">
                <span className="ptl-stat-val ptl-stat-val--green">{newCount}</span>
                <span className="ptl-stat-lbl">New (48h)</span>
              </div>
            )}
            {revisitCount > 0 && (
              <div className="ptl-stat">
                <span className="ptl-stat-val ptl-stat-val--amber">{revisitCount}</span>
                <span className="ptl-stat-lbl">Revisit Due</span>
              </div>
            )}
          </div>
        )}

        <button className="btn-primary ptl-add-btn" onClick={() => setShowAdd(true)}>
          <IconPlus /> Add Patient
        </button>
      </div>

      {status === 'loading' && <div className="ptl-loader"><PageLoader /></div>}

      {status === 'error' && (
        <div className="ptl-body">
          <div className="card state-panel">Could not load patients — check your connection.</div>
        </div>
      )}

      {status === 'done' && (
        <div className="ptl-body">

          {/* ── Search + export row ── */}
          <div className="ptl-search-row">
            <div className="ptl-search-wrap">
              <svg className="ptl-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="ptl-search-input"
                type="search"
                placeholder="Search by name, phone or gender…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="ptl-count-tag">
              {filtered.length} of {patients.length}
            </span>
            <div className="ptl-export-row">
              <button className="pt-exp-btn" onClick={() => doExportCopy(filtered)}>⎘ Copy</button>
              <button className="pt-exp-btn" onClick={() => doExportCsv(filtered)}>↓ CSV</button>
              <button className="pt-exp-btn pt-exp-btn--excel" onClick={() => doExportExcel(filtered)}>↓ Excel</button>
              <button className="pt-exp-btn" onClick={() => window.print()}>⎙ Print</button>
            </div>
          </div>

          {/* ── Table card ── */}
          <div className="ptl-table-card">
            {filtered.length === 0 ? (
              <div className="ptl-empty">
                <div className="ptl-empty-icon">🧑‍⚕️</div>
                <div className="ptl-empty-title">
                  {search ? 'No patients match your search' : 'No patients registered yet'}
                </div>
                <div className="ptl-empty-sub">
                  {search ? 'Try a different name or phone number' : 'Add your first patient using the button above'}
                </div>
                {!search && (
                  <button className="btn-primary" style={{ marginTop: 14, fontSize: 13, width: 'auto' }} onClick={() => setShowAdd(true)}>
                    <IconPlus /> Add First Patient
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="pt-scroll-wrap">
                  <table className="pt-table ptl-tbl">
                    <thead>
                      <tr>
                        <th className="pt-th pt-th--sortable ptl-th-patient" onClick={() => toggleSort('name')}>
                          Patient <SortChevron col="name" sortCol={sortCol} sortDir={sortDir} />
                        </th>
                        <th className="pt-th">Contact</th>
                        <th className="pt-th pt-th--sortable ptl-th-narrow" onClick={() => toggleSort('age')}>
                          Age <SortChevron col="age" sortCol={sortCol} sortDir={sortDir} />
                        </th>
                        <th className="pt-th pt-th--sortable ptl-th-narrow" onClick={() => toggleSort('gender')}>
                          Gender <SortChevron col="gender" sortCol={sortCol} sortDir={sortDir} />
                        </th>
                        <th className="pt-th pt-th--sortable ptl-th-visit" onClick={() => toggleSort('last_visit')}>
                          Last Visit <SortChevron col="last_visit" sortCol={sortCol} sortDir={sortDir} />
                        </th>
                        <th className="pt-th ptl-th-arrow"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(p => {
                        const rowNew     = isNew(p.created_at)
                        const rowRevisit = !rowNew && isRevisitDue(p.last_visit_at)
                        return (
                          <tr
                            key={p.id}
                            className={`pt-tr ptl-tr${rowRevisit ? ' ptl-tr--revisit' : ''}`}
                            onClick={() => navigate(`/patients/${p.id}`)}
                            tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && navigate(`/patients/${p.id}`)}
                          >
                            <td className="pt-td-patient ptl-td-patient">
                              <div className="ptl-avatar" style={{ background: avatarColor(p.name) }}>
                                {(p.name?.[0] ?? '?').toUpperCase()}
                              </div>
                              <div className="ptl-patient-info">
                                <span className="ptl-patient-name">{p.name}</span>
                                <div className="ptl-patient-badges">
                                  {rowNew     && <span className="ptl-badge ptl-badge--new">New</span>}
                                  {rowRevisit && <span className="ptl-badge ptl-badge--revisit">Revisit Due</span>}
                                </div>
                              </div>
                            </td>
                            <td className="pt-td-muted ptl-td-contact">{p.mobile || '—'}</td>
                            <td className="pt-td-muted">{p.age != null ? `${p.age} yrs` : '—'}</td>
                            <td className="pt-td-muted">{capitalize(p.gender) ?? '—'}</td>
                            <td className="ptl-td-visit">
                              {p.last_visit_at ? (
                                <>
                                  <span className="ptl-visit-date">{fmtDate(p.last_visit_at)}</span>
                                  <span className="ptl-visit-ago">{timeAgo(p.last_visit_at)}</span>
                                </>
                              ) : (
                                <span className="pt-never">Never</span>
                              )}
                            </td>
                            <td className="ptl-td-arrow">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ptl-row-arrow">
                                <path d="M9 18l6-6-6-6"/>
                              </svg>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-table-footer ptl-footer">
                  <span className="pt-footer-info">
                    {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    {filtered.length !== patients.length ? ` (${patients.length} total)` : ''}
                  </span>
                  {totalPages > 1 && (
                    <div className="pt-pagination">
                      <button className="pt-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                        .reduce((acc, n, i, arr) => {
                          if (i > 0 && n - arr[i - 1] > 1) acc.push('…')
                          acc.push(n)
                          return acc
                        }, [])
                        .map((n, i) => n === '…'
                          ? <span key={`e${i}`} className="pt-page-ellipsis">…</span>
                          : <button key={n} className={`pt-page-btn${n === page ? ' pt-page-btn--active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                        )
                      }
                      <button className="pt-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {showAdd && (
        <PatientFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(p) => { setShowAdd(false); navigate(`/patients/${p.id}`) }}
        />
      )}
    </div>
  )
}

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M7.5 1v13M1 7.5h13" />
    </svg>
  )
}
