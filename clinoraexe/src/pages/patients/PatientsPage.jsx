import { useState, useEffect, useMemo } from 'react'
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
const isNew        = (d)    => Date.now() - new Date(d).getTime() < 2 * 24 * 60 * 60 * 1000
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
  const [search,   setSearch]   = useState('')
  const [sortCol,  setSortCol]  = useState('name')
  const [sortDir,  setSortDir]  = useState('asc')
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      {/* Header */}
      <div className="pt-header">
        <div className="pt-header-left">
          <h1 className="pt-title">Patients</h1>
          {patients.length > 0 && (
            <span className="pt-count-badge">{patients.length.toLocaleString()}</span>
          )}
        </div>
        <button className="btn-primary pt-add-btn" onClick={() => setShowAdd(true)}>
          <IconPlus /> Add Patient
        </button>
      </div>

      {status === 'loading' && <PageLoader />}

      {status === 'error' && (
        <div className="card state-panel">Could not load patients — check your connection.</div>
      )}

      {status === 'done' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Toolbar: search + exports */}
          <div className="pt-toolbar">
            <div className="pt-search-wrap">
              <svg className="pt-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                className="pt-search"
                type="search"
                placeholder="Search patients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="pt-export-btns">
              <span className="pt-result-count">{filtered.length} / {patients.length}</span>
              <button className="pt-exp-btn" onClick={() => doExportCopy(filtered)}>⎘ Copy</button>
              <button className="pt-exp-btn" onClick={() => doExportCsv(filtered)}>↓ CSV</button>
              <button className="pt-exp-btn pt-exp-btn--excel" onClick={() => doExportExcel(filtered)}>↓ Excel</button>
              <button className="pt-exp-btn" onClick={() => window.print()}>⎙ Print</button>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="🧑‍⚕️"
              title={search ? 'No patients match your search' : 'No patients registered yet'}
              description={search ? 'Try a different name or phone number.' : 'Add your first patient using the button above.'}
            />
          ) : (
            <>
              <div className="pt-scroll-wrap">
                <table className="pt-table">
                  <thead>
                    <tr>
                      <th className="pt-th pt-th--sortable" onClick={() => toggleSort('name')}>
                        Patient <SortChevron col="name" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="pt-th">Contact</th>
                      <th className="pt-th pt-th--sortable pt-th--narrow" onClick={() => toggleSort('age')}>
                        Age <SortChevron col="age" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="pt-th pt-th--sortable pt-th--narrow" onClick={() => toggleSort('gender')}>
                        Gender <SortChevron col="gender" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="pt-th pt-th--sortable" onClick={() => toggleSort('last_visit')}>
                        Last Visit <SortChevron col="last_visit" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(p => (
                      <tr
                        key={p.id}
                        className="pt-tr"
                        onClick={() => navigate(`/patients/${p.id}`)}
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/patients/${p.id}`)}
                      >
                        <td className="pt-td-patient">
                          <div className="pt-avatar" style={{ background: avatarColor(p.name) }}>
                            {p.name[0].toUpperCase()}
                          </div>
                          <span className="pt-patient-name">{p.name}</span>
                          {isNew(p.created_at) && <span className="pt-new-badge">New</span>}
                        </td>
                        <td className="pt-td-muted">{p.mobile || '—'}</td>
                        <td className="pt-td-muted">{p.age != null ? `${p.age} yrs` : '—'}</td>
                        <td className="pt-td-muted">{capitalize(p.gender) ?? '—'}</td>
                        <td className="pt-td-muted">
                          {p.last_visit_at
                            ? fmtDate(p.last_visit_at)
                            : <span className="pt-never">Never visited</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-table-footer">
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
