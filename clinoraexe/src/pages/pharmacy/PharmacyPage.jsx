import '../../styles/pharmacy-pages.css'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getPharmacyPrescriptions, getPharmacyStats,
  getPharmacyPrescription,
  startDispensingPharmacyPrescription,
  completePharmacyPrescription,
} from '../../services/pharmacyService'
import { getStockAlerts } from '../../services/medicineService'
import Spinner from '../../components/ui/Spinner'

const POLL_MS    = 30_000
const URGENT_MS  = 30 * 60_000
const OVERDUE_MS = 60 * 60_000

/* ── Helpers ──────────────────────────────────────────────────────────── */

function timeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  return `${Math.floor(h / 24)}d ago`
}

function isUrgent(rx) {
  if (rx.status !== 'sent_to_pharmacy') return false
  const ref = rx.sent_to_pharmacy_at ?? rx.prescribed_at
  return ref && (Date.now() - new Date(ref).getTime()) > URGENT_MS
}

function isOverdue(rx) {
  if (rx.status !== 'sent_to_pharmacy') return false
  const ref = rx.sent_to_pharmacy_at ?? rx.prescribed_at
  return ref && (Date.now() - new Date(ref).getTime()) > OVERDUE_MS
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

function fmtPrice(v) {
  return '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── Stat card ────────────────────────────────────────────────────────── */

function StatCard({ label, value, accent, loading, icon }) {
  return (
    <div className={`pharma-stat-card pharma-stat-card--${accent}`}>
      <div className="pharma-stat-top">
        <span className="pharma-stat-label">{label}</span>
        <div className="pharma-stat-icon">{icon}</div>
      </div>
      <div className="pharma-stat-value">
        {loading ? <span className="pharma-stat-skeleton" /> : value}
      </div>
    </div>
  )
}

/* ── Queue card ───────────────────────────────────────────────────────── */

function RxCard({ rx, selected, onClick }) {
  const ongoing = rx.status === 'dispensing'
  const urgent  = isUrgent(rx)
  const timeRef = rx.sent_to_pharmacy_at ?? rx.prescribed_at

  return (
    <button
      className={[
        'pharma-qcard',
        ongoing  ? 'pharma-qcard--ongoing'  : '',
        urgent   ? 'pharma-qcard--urgent'   : '',
        selected ? 'pharma-qcard--selected' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <div className="pharma-qcard-avatar">{(rx.patient.name?.[0] ?? '?').toUpperCase()}</div>

      <div className="pharma-qcard-body">
        <div className="pharma-qcard-name">{rx.patient.name}</div>
        {rx.doctor && <div className="pharma-qcard-doctor">{doctorLabel(rx.doctor.name)}</div>}
        {rx.items?.length > 0 && (
          <div className="pharma-qcard-meds">
            {rx.items.slice(0, 2).map(i => i.medicine_name).join(', ')}
            {rx.items.length > 2 && <span className="pharma-qcard-meds-more"> +{rx.items.length - 2}</span>}
          </div>
        )}
      </div>

      <div className="pharma-qcard-right">
        <div className="pharma-qcard-badges">
          <span className={`pharma-status-pill${ongoing ? ' pharma-status-pill--ongoing' : ' pharma-status-pill--pending'}`}>
            {ongoing && <span className="pharma-pulse" />}
            {ongoing ? 'Dispensing' : 'Pending'}
          </span>
          {isOverdue(rx) && <span className="pharma-qcard-overdue">Overdue</span>}
          {rx.items?.length > 0 && (
            <span className="pharma-med-pill">{rx.items.length} med{rx.items.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className={`pharma-qcard-time${urgent ? ' pharma-qcard-time--urgent' : ''}`}>
          {timeAgo(timeRef)}
        </div>
      </div>
    </button>
  )
}

/* ── Inline dispense panel ────────────────────────────────────────────── */

function IconCheck() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function DispensePanel({ rxId, onClose, onCompleted, navigate }) {
  const [rx,         setRx]         = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [checked,    setChecked]    = useState(new Set())
  const [prices,     setPrices]     = useState({})
  const [starting,   setStarting]   = useState(false)
  const [completing, setCompleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setChecked(new Set())
    setPrices({})
    setConfirming(false)
    setRx(null)
    getPharmacyPrescription(rxId)
      .then(({ data }) => { if (!cancelled) { setRx(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { toast.error('Could not load prescription'); setLoading(false) } })
    return () => { cancelled = true }
  }, [rxId])

  function toggleCheck(idx) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function handleStart() {
    setStarting(true)
    try {
      const { data } = await startDispensingPharmacyPrescription(rxId)
      setRx(data)
      toast.success('Started dispensing')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not start dispensing')
    } finally { setStarting(false) }
  }

  async function handleComplete() {
    setCompleting(true)
    setConfirming(false)
    try {
      const itemPrices = (rx.items ?? []).map(item => ({
        id: item.id,
        unit_price: prices[item.id] ? parseFloat(prices[item.id]) : null,
      }))
      const { data } = await completePharmacyPrescription(rxId, itemPrices, [])
      setRx(data)
      toast.success(`Dispensed for ${rx.patient.name}`)
      onCompleted()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not complete — try again.')
      setCompleting(false)
    }
  }

  const isPending    = rx?.status === 'sent_to_pharmacy'
  const isDispensing = rx?.status === 'dispensing'
  const isCompleted  = rx?.status === 'completed'
  const items        = rx?.items ?? []
  const totalMeds    = items.length
  const checkedCount = checked.size
  const unchecked    = totalMeds - checkedCount
  const liveTotal    = Object.values(prices).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  return (
    <div className="pharma-dpanel">

      {/* Panel header */}
      <div className="pharma-dpanel-hdr">
        <div className="pharma-dpanel-hdr-left">
          {loading
            ? <span className="pharma-dpanel-hdr-title">Loading…</span>
            : rx
              ? <span className="pharma-dpanel-hdr-title">{rx.patient.name}</span>
              : <span className="pharma-dpanel-hdr-title">Prescription</span>
          }
        </div>
        <div className="pharma-dpanel-hdr-right">
          {rx && (
            <button
              className="pharma-dpanel-full-btn"
              onClick={() => navigate(`/pharmacy/prescriptions/${rxId}`)}
              title="Open full detail page"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Full page
            </button>
          )}
          <button className="pharma-dpanel-close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Spinner size={22} />
        </div>
      )}

      {rx && (
        <div className="pharma-dpanel-body">

          {/* Patient info strip */}
          <div className="pharma-dpanel-patient">
            <div className="pharma-dpanel-avatar">{(rx.patient.name?.[0] ?? '?').toUpperCase()}</div>
            <div className="pharma-dpanel-patient-info">
              <div className="pharma-dpanel-pname">{rx.patient.name}</div>
              {rx.doctor && <div className="pharma-dpanel-doctor">{doctorLabel(rx.doctor.name)}</div>}
              {(rx.patient.age != null || rx.patient.gender) && (
                <div className="pharma-dpanel-meta">
                  {[rx.patient.age != null && `${rx.patient.age} yrs`, rx.patient.gender].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            <span className={`status-badge ${rx.status}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
              {isPending ? 'Pending' : isDispensing ? 'Dispensing' : 'Completed'}
            </span>
          </div>

          {/* Progress when dispensing */}
          {isDispensing && totalMeds > 0 && (
            <div className="pharma-dpanel-progress">
              <div className="pharma-prg-track">
                <div className="pharma-prg-fill" style={{ width: `${Math.round((checkedCount / totalMeds) * 100)}%` }} />
              </div>
              <span className="pharma-prg-label">{checkedCount}/{totalMeds} checked</span>
            </div>
          )}

          {/* Medicines */}
          {items.length > 0 ? (
            <div className="pharma-dpanel-meds">
              <div className="pharma-dpanel-section-hdr">
                <span>Medicines</span>
                {(isDispensing || isCompleted) && items.length > 0 && (
                  <span className="pharma-dpanel-inv-hint">Price per item</span>
                )}
              </div>
              <ul className="pharma-dpanel-med-list">
                {items.map((item, idx) => (
                  <li key={item.id ?? idx}
                    className={`pharma-dpanel-med${isDispensing && checked.has(idx) ? ' pharma-dpanel-med--checked' : ''}`}
                  >
                    {isDispensing ? (
                      <button
                        className={`pharma-check-btn${checked.has(idx) ? ' pharma-check-btn--checked' : ''}`}
                        onClick={() => toggleCheck(idx)}
                        title={checked.has(idx) ? 'Uncheck' : 'Mark dispensed'}
                      >
                        {checked.has(idx) && <IconCheck />}
                      </button>
                    ) : (
                      <div className="pharma-dpanel-med-num">{idx + 1}</div>
                    )}

                    <div className="pharma-dpanel-med-info">
                      <div className="pharma-dpanel-med-name">{item.medicine_name}</div>
                      {(item.dosage || item.frequency || item.duration) && (
                        <div className="pharma-dpanel-med-meta">
                          {[item.dosage, item.frequency, item.duration ? `${item.duration}d` : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {isDispensing && (
                      <div className="rx-price-wrap" style={{ flex: 'none' }}>
                        <span className="rx-price-currency">₹</span>
                        <input
                          className="rx-price-input"
                          type="number" min="0" step="0.01" placeholder="0"
                          value={prices[item.id] ?? ''}
                          onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value }))}
                          style={{ width: 64 }}
                        />
                      </div>
                    )}
                    {isCompleted && item.unit_price != null && (
                      <span className="pharma-dpanel-med-price">{fmtPrice(item.unit_price)}</span>
                    )}
                  </li>
                ))}
              </ul>

              {isDispensing && liveTotal > 0 && (
                <div className="pharma-dpanel-total">
                  Total: <strong>{fmtPrice(liveTotal)}</strong>
                </div>
              )}

              {isCompleted && (rx.total_amount ?? 0) > 0 && (
                <div className="pharma-dpanel-total pharma-dpanel-total--done">
                  Total: <strong>{fmtPrice(rx.total_amount)}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="pharma-dpanel-empty">No medicines on this prescription.</div>
          )}

          {/* Action area */}
          <div className="pharma-dpanel-actions">
            {isPending && (
              <button
                className="btn-primary pharma-dpanel-primary-btn"
                onClick={handleStart}
                disabled={starting}
              >
                {starting ? <Spinner size={13} /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
                {starting ? 'Starting…' : 'Start Dispensing'}
              </button>
            )}

            {isDispensing && !confirming && (
              <button
                className="btn-primary pharma-dpanel-primary-btn"
                onClick={() => setConfirming(true)}
                disabled={completing}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Complete Dispensing
              </button>
            )}

            {isDispensing && confirming && (
              <div className="pharma-dpanel-confirm">
                {unchecked > 0 && (
                  <div className="rx-complete-warn">
                    ⚠ {unchecked} item{unchecked > 1 ? 's' : ''} not checked — all dispensed?
                  </div>
                )}
                <div className="pharma-dpanel-confirm-row">
                  <button
                    className="btn-primary pharma-dpanel-primary-btn"
                    style={{ flex: 1 }}
                    onClick={handleComplete}
                    disabled={completing}
                  >
                    {completing ? <Spinner size={12} /> : 'Yes, Complete'}
                  </button>
                  <button className="btn-secondary" onClick={() => setConfirming(false)} disabled={completing}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="pharma-dpanel-done">
                <div className="pharma-dpanel-done-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Dispensed successfully
                </div>
                <div className="pharma-dpanel-done-btns">
                  <button className="btn-secondary" style={{ flex: 1 }}
                    onClick={() => navigate(`/pharmacy/prescriptions/${rxId}/invoice`)}>
                    Invoice
                  </button>
                  <button className="btn-secondary" style={{ flex: 1 }}
                    onClick={() => navigate(`/pharmacy/prescriptions/${rxId}`)}>
                    Full Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function PharmacyPage() {
  const navigate = useNavigate()

  const [allRx,        setAllRx]        = useState([])
  const [queueStatus,  setQueueStatus]  = useState('loading')
  const [lastSync,     setLastSync]     = useState(null)
  const [stats,        setStats]        = useState({ pending: 0, dispensing: 0, today_done: 0 })
  const [statsStatus,  setStatsStatus]  = useState('loading')
  const [search,       setSearch]       = useState('')
  const [alerts,       setAlerts]       = useState(null)
  const [selectedRxId, setSelectedRxId] = useState(null)

  const loadQueue = useCallback((silent = false) => {
    if (!silent) setQueueStatus('loading')
    getPharmacyPrescriptions()
      .then(({ data }) => {
        setAllRx(data.data ?? [])
        setQueueStatus('done')
        setLastSync(new Date())
      })
      .catch(() => setQueueStatus(prev => prev === 'loading' ? 'error' : prev))
  }, [])

  const loadStats = useCallback((silent = false) => {
    if (!silent) setStatsStatus('loading')
    getPharmacyStats()
      .then(({ data }) => { setStats(data.data); setStatsStatus('done') })
      .catch(() => setStatsStatus(prev => prev === 'loading' ? 'error' : prev))
  }, [])

  useEffect(() => {
    loadQueue(); loadStats()
    getStockAlerts().then(({ data }) => setAlerts(data)).catch(() => {})
  }, [loadQueue, loadStats])

  useEffect(() => {
    const qt = setInterval(() => loadQueue(true), POLL_MS)
    const st = setInterval(() => loadStats(true), POLL_MS)
    return () => { clearInterval(qt); clearInterval(st) }
  }, [loadQueue, loadStats])

  const q        = search.trim().toLowerCase()
  const filtered = q
    ? allRx.filter(rx =>
        rx.patient.name.toLowerCase().includes(q) ||
        rx.doctor?.name.toLowerCase().includes(q) ||
        rx.items?.some(i => i.medicine_name.toLowerCase().includes(q))
      )
    : allRx

  const pending      = filtered.filter(r => r.status === 'sent_to_pharmacy')
  const ongoing      = filtered.filter(r => r.status === 'dispensing')
  const statsLoading = statsStatus === 'loading'
  const hasAlerts    = alerts && (alerts.expired?.length > 0 || alerts.expiring_soon?.length > 0 || alerts.low_stock?.length > 0)

  const alertParts = hasAlerts ? [
    alerts.expired?.length      > 0 && `${alerts.expired.length} expired`,
    alerts.expiring_soon?.length > 0 && `${alerts.expiring_soon.length} expiring soon`,
    alerts.low_stock?.length    > 0 && `${alerts.low_stock.length} low stock`,
  ].filter(Boolean) : []

  function handleRefresh() { loadQueue(); loadStats() }

  function openPanel(rxId) {
    setSelectedRxId(prev => prev === rxId ? null : rxId)
  }

  return (
    <div className="pharma-page">

      {/* Header */}
      <div className="pharma-page-hdr">
        <h2 className="pharma-page-hdr-title">Prescription Queue</h2>
        <button className="pharma-sync-pill" onClick={handleRefresh} disabled={queueStatus === 'loading'}>
          {queueStatus === 'loading' ? <Spinner size={12} /> : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          )}
          {lastSync
            ? `Synced ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Sync'
          }
        </button>
      </div>

      {/* Stat cards */}
      <div className="pharma-stat-cards">
        <StatCard label="Total Active" value={stats.pending + stats.dispensing} accent="total" loading={statsLoading}
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="1" width="12" height="16" rx="2" /><path d="M6 6h6M6 9h6M6 12h4" /></svg>}
        />
        <StatCard label="Pending" value={stats.pending} accent="pending" loading={statsLoading}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
        />
        <StatCard label="Dispensing" value={stats.dispensing} accent="dispensing" loading={statsLoading}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
        />
        <StatCard label="Done Today" value={stats.today_done} accent="done" loading={statsLoading}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
        />
      </div>

      {/* Stock alert strip — only shown if there are issues */}
      {hasAlerts && (
        <button className="pharma-alert-strip" onClick={() => navigate('/pharmacy/stock')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="pharma-alert-strip-text">Stock attention needed: {alertParts.join(' · ')}</span>
          <span className="pharma-alert-strip-cta">View Stock →</span>
        </button>
      )}

      {/* Search */}
      {queueStatus === 'done' && allRx.length > 0 && (
        <div className="pharma-search">
          <span className="pharma-search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className="pharma-search-input"
            type="text"
            placeholder="Search patient, doctor or medicine…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {q && <span className="pharma-search-count">{filtered.length} of {allRx.length} shown</span>}
        </div>
      )}

      {/* Queue loading */}
      {queueStatus === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size={26} />
        </div>
      )}

      {/* Queue error */}
      {queueStatus === 'error' && (
        <div className="card state-panel">
          <p>Could not load prescriptions — check your connection.</p>
          <button className="btn-link" style={{ marginTop: 'var(--space-sm)' }} onClick={handleRefresh}>Try again</button>
        </div>
      )}

      {/* Queue empty */}
      {queueStatus === 'done' && allRx.length === 0 && (
        <div className="pharma-empty-state">
          <div className="pharma-empty-card">
            <div className="pharma-empty-illus">
              <svg className="pharma-empty-orbit" width="116" height="116" viewBox="0 0 116 116" fill="none">
                <circle cx="58" cy="58" r="54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 5" strokeOpacity="0.35" />
                <g transform="translate(58,4) rotate(-90)">
                  <rect x="-11" y="-4.5" width="22" height="9" rx="4.5" fill="currentColor" fillOpacity="0.50" />
                  <line x1="0" y1="-4" x2="0" y2="4" stroke="white" strokeWidth="1.2" strokeOpacity="0.55" />
                </g>
                <circle cx="104" cy="85" r="4.5" fill="currentColor" fillOpacity="0.40" />
                <g transform="translate(12,85) rotate(30)">
                  <rect x="-8" y="-3.5" width="16" height="7" rx="3.5" fill="currentColor" fillOpacity="0.45" />
                </g>
              </svg>
              <div className="pharma-empty-badge-wrap">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="Georgia, serif">Rx</text>
                </svg>
              </div>
            </div>
            <div className="pharma-empty-chip">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1.5,6 4.5,9 10.5,3" />
              </svg>
              All caught up
            </div>
            <div className="pharma-empty-title">Queue is clear</div>
            <div className="pharma-empty-sub">New prescriptions from the doctor will appear here automatically.</div>
            <button className="pharma-empty-refresh-btn" onClick={handleRefresh}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
              Check for new prescriptions
            </button>
          </div>
        </div>
      )}

      {/* No search matches */}
      {queueStatus === 'done' && allRx.length > 0 && filtered.length === 0 && (
        <div className="pharma-no-match">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <div className="pharma-no-match-title">No matches</div>
          <div className="pharma-no-match-sub">No prescriptions match &ldquo;{search}&rdquo;</div>
        </div>
      )}

      {/* Active queue — split layout when panel is open */}
      {queueStatus === 'done' && filtered.length > 0 && (
        <div className={`pharma-queue-wrap${selectedRxId ? ' pharma-queue-wrap--split' : ''}`}>

          {/* Queue list */}
          <div className="pharma-queue-main">
            {ongoing.length > 0 && (
              <section className="pharma-section">
                <div className="pharma-section-hdr">
                  <span className="pharma-section-hdr-title">Dispensing</span>
                  <span className="pharma-section-hdr-count">{ongoing.length}</span>
                </div>
                <ul className="pharma-qlist">
                  {ongoing.map(rx => (
                    <li key={rx.id}>
                      <RxCard rx={rx} selected={selectedRxId === rx.id} onClick={() => openPanel(rx.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pending.length > 0 && (
              <section className="pharma-section">
                <div className="pharma-section-hdr">
                  <span className="pharma-section-hdr-title">Pending</span>
                  <span className="pharma-section-hdr-count">{pending.length}</span>
                </div>
                <ul className="pharma-qlist">
                  {pending.map(rx => (
                    <li key={rx.id}>
                      <RxCard rx={rx} selected={selectedRxId === rx.id} onClick={() => openPanel(rx.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Inline dispense panel */}
          {selectedRxId && (
            <div className="pharma-dpanel-wrap">
              <DispensePanel
                rxId={selectedRxId}
                onClose={() => setSelectedRxId(null)}
                onCompleted={() => { loadQueue(true); loadStats(true) }}
                navigate={navigate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
