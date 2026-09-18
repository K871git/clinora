import '../../styles/visits-page.css'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClinicVisits } from '../../services/visitService'
import PageLoader from '../../components/ui/PageLoader'
import EmptyState from '../../components/ui/EmptyState'

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtPrice(v) {
  const n = parseFloat(v || 0)
  return n > 0 ? '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : null
}

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#0d9488']
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length] }

const PAY_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

const PAGE_SIZE = 25

function VspSort({ col, sortCol, sortDir }) {
  const active = sortCol === col
  const up   = !active || sortDir === 'asc'
  const down = !active || sortDir === 'desc'
  return (
    <span className={`vsp-sort${active ? ' vsp-sort--active' : ''}`} aria-hidden="true">
      {up   && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 4L3.5 1L6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'desc' ? 0.3 : 1}/></svg>}
      {down && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 1L3.5 4L6 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'asc' ? 0.3 : 1}/></svg>}
    </span>
  )
}

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'open',      label: 'Open' },
  { key: 'completed', label: 'Completed' },
]

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function VisitsPage() {
  const navigate = useNavigate()

  const [visits,     setVisits]     = useState([])
  const [status,     setStatus]     = useState('loading')
  const [search,     setSearch]     = useState('')
  const [activeTab,  setActiveTab]  = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [page,       setPage]       = useState(1)
  const [sortCol,    setSortCol]    = useState('visited_at')
  const [sortDir,    setSortDir]    = useState('desc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  function load(quiet = false) {
    if (!quiet) setStatus('loading')
    else setRefreshing(true)
    getClinicVisits()
      .then(({ data }) => { setVisits(data.data ?? []); setStatus('done') })
      .catch(() => setStatus('error'))
      .finally(() => setRefreshing(false))
  }

  useEffect(() => { load() }, [])

  const counts = useMemo(() => ({
    all:       visits.length,
    open:      visits.filter(v => (v.status ?? 'open') === 'open').length,
    completed: visits.filter(v => v.status === 'completed').length,
    revenue:   visits.filter(v => v.status === 'completed' && parseFloat(v.consultation_fee || 0) > 0)
                     .reduce((s, v) => s + parseFloat(v.consultation_fee), 0),
  }), [visits])

  const filtered = useMemo(() => {
    let list = visits
    if (activeTab) list = list.filter(v => (v.status ?? 'open') === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(v =>
        v.patient?.name?.toLowerCase().includes(q) ||
        v.consultation_notes?.toLowerCase().includes(q) ||
        v.doctor?.name?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'patient')    cmp = (a.patient?.name ?? '').localeCompare(b.patient?.name ?? '')
      else if (sortCol === 'date')  cmp = new Date(a.visited_at ?? 0) - new Date(b.visited_at ?? 0)
      else if (sortCol === 'fee')   cmp = parseFloat(a.consultation_fee || 0) - parseFloat(b.consultation_fee || 0)
      else if (sortCol === 'status') cmp = (a.status ?? 'open').localeCompare(b.status ?? 'open')
      else /* visited_at default */ cmp = new Date(a.visited_at ?? 0) - new Date(b.visited_at ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [visits, activeTab, search, sortCol, sortDir])

  useEffect(() => { setPage(1) }, [activeTab, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  if (status === 'loading') return <PageLoader />

  if (status === 'error') return (
    <div className="card state-panel">
      Could not load visits — check your connection.
      <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => load()}>Retry</button>
    </div>
  )

  return (
    <div className="vsp-page">

      {/* Header */}
      <div className="vsp-header">
        <div className="vsp-header-left">
          <h1 className="vsp-title">Visits</h1>
          {visits.length > 0 && <span className="vsp-count-badge">{visits.length}</span>}
        </div>
        <button className="btn-secondary vsp-refresh-btn" onClick={() => load(true)} disabled={refreshing}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      {visits.length > 0 && (
        <div className="vsp-stats">
          <div className="vsp-stat" onClick={() => setActiveTab('')} style={{ cursor: 'pointer' }}>
            <span className="vsp-stat-num">{counts.all}</span>
            <span className="vsp-stat-lbl">Total Visits</span>
          </div>
          <div className="vsp-stat vsp-stat--amber" onClick={() => setActiveTab('open')} style={{ cursor: 'pointer' }}>
            <span className="vsp-stat-num">{counts.open}</span>
            <span className="vsp-stat-lbl">Open</span>
          </div>
          <div className="vsp-stat vsp-stat--green" onClick={() => setActiveTab('completed')} style={{ cursor: 'pointer' }}>
            <span className="vsp-stat-num">{counts.completed}</span>
            <span className="vsp-stat-lbl">Completed</span>
          </div>
          {counts.revenue > 0 && (
            <div className="vsp-stat vsp-stat--blue">
              <span className="vsp-stat-num">{'₹' + counts.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span className="vsp-stat-lbl">Total Revenue</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="vsp-filters">
        <div className="vsp-tabs">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              className={`vsp-tab${activeTab === tab.key ? ' vsp-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="vsp-tab-count">
                {tab.key === '' ? counts.all : tab.key === 'open' ? counts.open : counts.completed}
              </span>
            </button>
          ))}
        </div>
        <div className="vsp-search-wrap">
          <svg className="vsp-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input className="vsp-search" type="search" placeholder="Search patient, doctor, notes…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <EmptyState
            icon="🩺"
            title={search || activeTab ? 'No visits match your filter' : 'No visits recorded yet'}
            description={search || activeTab ? 'Try a different search term or tab.' : 'Start a new visit from any patient record.'}
          />
        </div>
      ) : (
        <div className="card vsp-table-card">
          <table className="vsp-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}></th>
                <th className="vsp-th--sortable" onClick={() => toggleSort('patient')}>
                  Patient <VspSort col="patient" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="vsp-th--sortable" onClick={() => toggleSort('date')}>
                  Date &amp; Time <VspSort col="date" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th>Doctor</th>
                <th>Notes</th>
                <th className="vsp-th--sortable" style={{ textAlign: 'center' }} onClick={() => toggleSort('status')}>
                  Status <VspSort col="status" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="vsp-th--sortable" style={{ textAlign: 'right' }} onClick={() => toggleSort('fee')}>
                  Fee <VspSort col="fee" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th style={{ textAlign: 'center', width: '80px' }}>Payment</th>
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(visit => {
                const name    = visit.patient?.name ?? 'Unknown'
                const isOpen  = (visit.status ?? 'open') === 'open'
                const fee     = fmtPrice(visit.consultation_fee)
                const payStatus = visit.payment_status ?? 'unpaid'
                const notes   = visit.consultation_notes
                const doctorName = visit.doctor?.name?.replace(/^dr\.?\s+/i, '') ?? ''

                return (
                  <tr key={visit.id} className="vsp-tr" onClick={() => navigate(`/visits/${visit.id}`)}>
                    {/* Avatar */}
                    <td className="vsp-td-avatar">
                      <div className="vsp-avatar" style={{ background: avatarColor(name) }}>
                        {name[0].toUpperCase()}
                      </div>
                    </td>

                    {/* Patient name */}
                    <td className="vsp-td-name">{name}</td>

                    {/* Date & Time */}
                    <td className="vsp-td-date">
                      <span className="vsp-date-main">{fmtDate(visit.visited_at)}</span>
                      <span className="vsp-date-time">{fmtTime(visit.visited_at)}</span>
                    </td>

                    {/* Doctor */}
                    <td className="vsp-td-muted">
                      {doctorName ? `Dr. ${doctorName}` : '—'}
                    </td>

                    {/* Notes */}
                    <td className="vsp-td-notes">
                      {notes
                        ? <span title={notes.length > 60 ? notes : undefined}>
                            {notes.length > 60 ? notes.slice(0, 58) + '…' : notes}
                          </span>
                        : <span className="vsp-no-notes">—</span>}
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`vsp-status-pill vsp-status-pill--${visit.status ?? 'open'}`}>
                        {isOpen ? 'Open' : 'Completed'}
                      </span>
                    </td>

                    {/* Fee */}
                    <td style={{ textAlign: 'right' }} className="vsp-td-fee">
                      {fee ?? <span className="vsp-no-notes">—</span>}
                    </td>

                    {/* Payment */}
                    <td style={{ textAlign: 'center' }}>
                      {!isOpen && fee ? (
                        <span className={`vsp-pay-pill vsp-pay-pill--${payStatus}`}>
                          {PAY_LABEL[payStatus]}
                        </span>
                      ) : (
                        <span className="vsp-no-notes">—</span>
                      )}
                    </td>

                    {/* Arrow */}
                    <td className="vsp-td-arrow">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="vsp-table-footer">
            <span>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}{filtered.length !== visits.length ? ` (${visits.length} total)` : ''}
            </span>
            {totalPages > 1 && (
              <div className="vsp-pagination">
                <button
                  className="vsp-page-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >‹ Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce((acc, n, i, arr) => {
                    if (i > 0 && n - arr[i - 1] > 1) acc.push('…')
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) =>
                    n === '…'
                      ? <span key={`ellipsis-${i}`} className="vsp-page-ellipsis">…</span>
                      : <button key={n} className={`vsp-page-btn${n === page ? ' vsp-page-btn--active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                  )
                }
                <button
                  className="vsp-page-btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >Next ›</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
