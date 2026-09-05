import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPharmacyHistory } from '../../services/pharmacyService'
import Spinner from '../../components/ui/Spinner'

const POLL_MS = 120_000

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function isYesterday(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const y = new Date(); y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

function groupHistory(list) {
  const today = [], yesterday = [], older = []
  for (const rx of list) {
    const ref = rx.completed_at
    if (isToday(ref))          today.push(rx)
    else if (isYesterday(ref)) yesterday.push(rx)
    else                       older.push(rx)
  }
  return { today, yesterday, older }
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconReceipt() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function HistoryCard({ rx, onInvoice, onDetails }) {
  return (
    <div className="pharma-hcard">
      <div className="pharma-hcard-avatar">{rx.patient.name[0].toUpperCase()}</div>

      <div className="pharma-hcard-body">
        <div className="pharma-hcard-name">{rx.patient.name}</div>
        {rx.doctor && <div className="pharma-hcard-doctor">{doctorLabel(rx.doctor.name)}</div>}
        {rx.items?.length > 0 && (
          <div className="pharma-hcard-meds">
            {rx.items.slice(0, 2).map(i => i.medicine_name).join(', ')}
            {rx.items.length > 2 && <span className="pharma-qcard-meds-more"> +{rx.items.length - 2}</span>}
          </div>
        )}
      </div>

      <div className="pharma-hcard-right">
        {/* Meta row: pill + time + tick */}
        <div className="pharma-hcard-meta">
          {rx.items?.length > 0 && (
            <span className="pharma-med-pill">{rx.items.length} med{rx.items.length !== 1 ? 's' : ''}</span>
          )}
          <div className="pharma-hcard-time">{fmtTime(rx.completed_at)}</div>
          <span className="pharma-done-tick"><IconCheck /></span>
        </div>

        {/* Action buttons */}
        <div className="pharma-hcard-actions">
          <button className="pharma-hcard-btn pharma-hcard-btn--invoice" onClick={onInvoice}>
            <IconReceipt />
            View Invoice
          </button>
          <button className="pharma-hcard-btn pharma-hcard-btn--detail" onClick={onDetails}>
            View Details
            <IconArrowRight />
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryGroup({ label, items, navigate, showDate }) {
  return (
    <div className="pharma-hgroup">
      <div className="pharma-hgroup-label">{label}</div>
      <ul className="pharma-qlist">
        {items.map(rx => (
          <li key={rx.id} style={{ position: 'relative' }}>
            {showDate && rx.completed_at && (
              <span className="pharma-hcard-date-badge">{fmtDate(rx.completed_at)}</span>
            )}
            <HistoryCard
              rx={rx}
              onInvoice={() => window.open(`/pharmacy/prescriptions/${rx.id}/invoice`, '_blank')}
              onDetails={() => navigate(`/pharmacy/prescriptions/${rx.id}`)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PharmacyHistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [status, setStatus]   = useState('loading')

  /* Search — debounced 400ms before hitting API */
  const [inputVal, setInputVal] = useState('')
  const [q, setQ]               = useState('')

  useEffect(() => {
    const t = setTimeout(() => setQ(inputVal.trim()), 400)
    return () => clearTimeout(t)
  }, [inputVal])

  /* load is keyed on q so a new search reruns automatically */
  const load = useCallback((silent = false) => {
    if (!silent) setStatus('loading')
    getPharmacyHistory(q)
      .then(({ data }) => {
        setHistory(data.data ?? [])
        setStatus('done')
      })
      .catch(() => setStatus(prev => prev === 'loading' ? 'error' : prev))
  }, [q])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const { today, yesterday, older } = groupHistory(history)
  const isSearching = inputVal !== q   // debounce in-flight

  return (
    <div className="pharma-page">

      {/* Header */}
      <div className="pharma-page-hdr">
        <div>
          <h2 className="pharma-page-hdr-title">Dispensed History</h2>
          <p className="pharma-page-hdr-sub">
            {q ? `Results for "${q}"` : 'All completed prescriptions'}
          </p>
        </div>
        <button
          className="pharma-sync-pill"
          onClick={() => load()}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? <Spinner size={12} /> : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          )}
          Sync
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="pharma-search">
        <span className="pharma-search-icon">
          {isSearching
            ? <Spinner size={13} />
            : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            )}
        </span>
        <input
          className="pharma-search-input"
          type="text"
          placeholder="Search patient name or mobile…"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
        />
        {q && status === 'done' && (
          <span className="pharma-search-count">
            {history.length} result{history.length !== 1 ? 's' : ''}
            {history.length === 50 && ' — showing first 50'}
          </span>
        )}
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size={26} />
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="card state-panel">
          <p>Could not load history — check your connection.</p>
          <button className="btn-link" style={{ marginTop: 'var(--space-sm)' }} onClick={() => load()}>
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {status === 'done' && history.length === 0 && (
        <div className="pharma-empty">
          {q ? (
            <>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="pharma-empty-title">No results</div>
              <div className="pharma-empty-sub">No completed prescriptions match &ldquo;{q}&rdquo;</div>
            </>
          ) : (
            <>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <div className="pharma-empty-title">No history yet</div>
              <div className="pharma-empty-sub">Completed prescriptions will appear here</div>
            </>
          )}
        </div>
      )}

      {/* History groups */}
      {status === 'done' && history.length > 0 && (
        <div className="pharma-history-body">
          {/* When searching, skip date groups — just show a flat result list */}
          {q ? (
            <HistoryGroup
              label={`${history.length} result${history.length !== 1 ? 's' : ''}`}
              items={history}
              navigate={navigate}
              showDate
            />
          ) : (
            <>
              {today.length > 0 && (
                <HistoryGroup
                  label={`Today — ${today.length} dispensed`}
                  items={today}
                  navigate={navigate}
                />
              )}
              {yesterday.length > 0 && (
                <HistoryGroup
                  label={`Yesterday — ${yesterday.length}`}
                  items={yesterday}
                  navigate={navigate}
                />
              )}
              {older.length > 0 && (
                <HistoryGroup
                  label="Older"
                  items={older}
                  navigate={navigate}
                  showDate
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
