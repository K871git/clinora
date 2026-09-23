import '../../styles/pharmacy-pages.css'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPharmacyPrescriptions, getPharmacyStats, getPharmacyStockSummary } from '../../services/pharmacyService'
import { getStockAlerts } from '../../services/medicineService'
import { getStockItems } from '../../services/stockItemService'
import Spinner from '../../components/ui/Spinner'

const POLL_MS   = 30_000
const URGENT_MS = 30 * 60_000   // 30 min

/* ── Helpers ──────────────────────────────────────────────────────────── */

function timeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function isUrgent(rx) {
  if (rx.status !== 'sent_to_pharmacy') return false
  const ref = rx.sent_to_pharmacy_at ?? rx.prescribed_at
  return ref && (Date.now() - new Date(ref).getTime()) > URGENT_MS
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
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

function RxCard({ rx, onClick }) {
  const ongoing = rx.status === 'dispensing'
  const urgent  = isUrgent(rx)
  const timeRef = rx.sent_to_pharmacy_at ?? rx.prescribed_at

  return (
    <button
      className={[
        'pharma-qcard',
        ongoing ? 'pharma-qcard--ongoing' : '',
        urgent  ? 'pharma-qcard--urgent'  : '',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="pharma-qcard-avatar">{(rx.patient.name?.[0] ?? '?').toUpperCase()}</div>

      <div className="pharma-qcard-body">
        <div className="pharma-qcard-name">{rx.patient.name}</div>
        {rx.doctor && (
          <div className="pharma-qcard-doctor">{doctorLabel(rx.doctor.name)}</div>
        )}
        {rx.items?.length > 0 && (
          <div className="pharma-qcard-meds">
            {rx.items.slice(0, 2).map(i => i.medicine_name).join(', ')}
            {rx.items.length > 2 && (
              <span className="pharma-qcard-meds-more"> +{rx.items.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <div className="pharma-qcard-right">
        <div className="pharma-qcard-badges">
          <span className={`pharma-status-pill${ongoing ? ' pharma-status-pill--ongoing' : ' pharma-status-pill--pending'}`}>
            {ongoing && <span className="pharma-pulse" />}
            {ongoing ? 'Dispensing' : 'Pending'}
          </span>
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

/* ── Main page ────────────────────────────────────────────────────────── */

export default function PharmacyPage() {
  const navigate = useNavigate()

  const [allRx,       setAllRx]       = useState([])
  const [queueStatus, setQueueStatus] = useState('loading')
  const [lastSync,    setLastSync]    = useState(null)

  const [stats,       setStats]       = useState({ pending: 0, dispensing: 0, today_done: 0 })
  const [statsStatus, setStatsStatus] = useState('loading')

  const [search,       setSearch]       = useState('')
  const [alerts,       setAlerts]       = useState(null)
  const [stockSummary, setStockSummary] = useState(null)
  const [itemSummary,  setItemSummary]  = useState(null)

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
      .then(({ data }) => {
        setStats(data.data)
        setStatsStatus('done')
      })
      .catch(() => setStatsStatus(prev => prev === 'loading' ? 'error' : prev))
  }, [])

  useEffect(() => {
    loadQueue(); loadStats()
    getStockAlerts().then(({ data }) => setAlerts(data)).catch(() => {})
    getPharmacyStockSummary().then(({ data }) => setStockSummary(data)).catch(() => {})
    getStockItems().then(({ data }) => {
      const items = data.data ?? []
      setItemSummary({
        total:        items.length,
        out_of_stock: items.filter(i => (i.stock_quantity ?? 0) === 0).length,
        low_stock:    items.filter(i => (i.stock_quantity ?? 0) > 0 && (i.stock_quantity ?? 0) <= 5).length,
        stock_value:  items.reduce((s, i) => s + ((i.selling_price ?? 0) * (i.stock_quantity ?? 0)), 0),
      })
    }).catch(() => {})
  }, [loadQueue, loadStats])

  useEffect(() => {
    const qt = setInterval(() => loadQueue(true), POLL_MS)
    const st = setInterval(() => loadStats(true), POLL_MS)
    return () => { clearInterval(qt); clearInterval(st) }
  }, [loadQueue, loadStats])

  /* Client-side filter — all active rx are already loaded */
  const q = search.trim().toLowerCase()
  const filtered = q
    ? allRx.filter(rx =>
        rx.patient.name.toLowerCase().includes(q) ||
        rx.doctor?.name.toLowerCase().includes(q) ||
        rx.items?.some(i => i.medicine_name.toLowerCase().includes(q))
      )
    : allRx

  const pending    = filtered.filter(r => r.status === 'sent_to_pharmacy')
  const ongoing    = filtered.filter(r => r.status === 'dispensing')
  const statsLoading = statsStatus === 'loading'

  function handleRefresh() { loadQueue(); loadStats() }

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

      {/* ── Stat cards — values from /pharmacy/stats (no pagination cap) ── */}
      <div className="pharma-stat-cards">
        <StatCard
          label="Total Active"
          value={stats.pending + stats.dispensing}
          accent="total"
          loading={statsLoading}
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="1" width="12" height="16" rx="2" />
              <path d="M6 6h6M6 9h6M6 12h4" />
            </svg>
          }
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          accent="pending"
          loading={statsLoading}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatCard
          label="Dispensing"
          value={stats.dispensing}
          accent="dispensing"
          loading={statsLoading}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />
        <StatCard
          label="Done Today"
          value={stats.today_done}
          accent="done"
          loading={statsLoading}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
      </div>

      {/* ── Inventory Health ─────────────────────────────────────────────── */}
      {stockSummary && (
        <div className="pharma-inv-panel">

          {/* Panel header */}
          <div className="pharma-inv-panel-hdr">
            <div className="pharma-inv-panel-title">
              <div className="pharma-inv-panel-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              Inventory Health
            </div>
            <button className="pharma-inv-view-btn" onClick={() => navigate('/pharmacy/stock')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View Stock
            </button>
          </div>

          {/* Medicines sub-section */}
          <div className="pharma-inv-sub-row">
            <span className="pharma-inv-sub-icon pharma-inv-sub-icon--med">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="1" width="12" height="16" rx="2" /><path d="M6 6h6M6 9h6M6 12h4" />
              </svg>
            </span>
            <span className="pharma-inv-sub-label">Medicines</span>
            <span className="pharma-inv-sub-count">{stockSummary.total_skus} SKUs</span>
          </div>

          <div className="pharma-inv-grid">
            {/* Out of Stock */}
            <button
              className={`pharma-inv-scard pharma-inv-scard--${stockSummary.out_of_stock > 0 ? 'red' : 'green'}`}
              onClick={() => navigate('/pharmacy/stock?filter=out_of_stock')}
            >
              <div className="pharma-inv-scard-top">
                <span className="pharma-inv-scard-label">Out of{'\n'}Stock</span>
                <span className="pharma-inv-scard-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </span>
              </div>
              <div className="pharma-inv-scard-value">{stockSummary.out_of_stock}</div>
            </button>

            {/* Low Stock */}
            <button
              className={`pharma-inv-scard pharma-inv-scard--${stockSummary.low_stock > 0 ? 'amber' : 'green'}`}
              onClick={() => navigate('/pharmacy/stock?filter=low_stock')}
            >
              <div className="pharma-inv-scard-top">
                <span className="pharma-inv-scard-label">Low{'\n'}Stock</span>
                <span className="pharma-inv-scard-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
              </div>
              <div className="pharma-inv-scard-value">{stockSummary.low_stock}</div>
            </button>

            {/* Expiring Soon */}
            <button
              className={`pharma-inv-scard pharma-inv-scard--${stockSummary.expiring_soon > 0 ? 'amber' : 'green'}`}
              onClick={() => navigate('/pharmacy/stock?filter=expiring_soon')}
            >
              <div className="pharma-inv-scard-top">
                <span className="pharma-inv-scard-label">Expiring{'\n'}Soon</span>
                <span className="pharma-inv-scard-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
              </div>
              <div className="pharma-inv-scard-value">{stockSummary.expiring_soon}</div>
            </button>

            {/* Expired */}
            <button
              className={`pharma-inv-scard pharma-inv-scard--${stockSummary.expired > 0 ? 'crimson' : 'green'}`}
              onClick={() => navigate('/pharmacy/stock?filter=expired')}
            >
              <div className="pharma-inv-scard-top">
                <span className="pharma-inv-scard-label">Expired</span>
                <span className="pharma-inv-scard-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                  </svg>
                </span>
              </div>
              <div className="pharma-inv-scard-value">{stockSummary.expired}</div>
            </button>

            {/* Total SKUs */}
            <button
              className="pharma-inv-scard pharma-inv-scard--teal"
              onClick={() => navigate('/pharmacy/stock')}
            >
              <div className="pharma-inv-scard-top">
                <span className="pharma-inv-scard-label">Total{'\n'}SKUs</span>
                <span className="pharma-inv-scard-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="1" width="12" height="16" rx="2" /><path d="M6 6h6M6 9h6M6 12h4" />
                  </svg>
                </span>
              </div>
              <div className="pharma-inv-scard-value">{stockSummary.total_skus}</div>
            </button>

            {/* Stock Value */}
            <button
              className="pharma-inv-scard pharma-inv-scard--indigo"
              onClick={() => navigate('/pharmacy/stock')}
            >
              <div className="pharma-inv-scard-top">
                <span className="pharma-inv-scard-label">Stock{'\n'}Value</span>
                <span className="pharma-inv-scard-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
              </div>
              <div className="pharma-inv-scard-value" style={{ fontSize: '1.1rem' }}>
                ₹{Number(stockSummary.stock_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </button>
          </div>

          {/* Alert detail rows */}
          {alerts && (alerts.expired?.length > 0 || alerts.expiring_soon?.length > 0 || alerts.low_stock?.length > 0) && (
            <div className="pharma-inv-alerts">
              {alerts.expired?.length > 0 && (
                <button className="pharma-inv-alert pharma-inv-alert--expired" onClick={() => navigate('/pharmacy/stock?filter=expired')}>
                  <div className="pharma-inv-alert-hdr">
                    Expired · {alerts.expired.length}
                    <svg className="pharma-inv-alert-arrow" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                  {alerts.expired.slice(0, 3).map(m => (
                    <div key={m.id} className="pharma-inv-alert-item">
                      <strong>{m.name}</strong>{m.batch_number ? ` · ${m.batch_number}` : ''} · {m.expiry_date}
                    </div>
                  ))}
                  {alerts.expired.length > 3 && <div className="pharma-inv-alert-more">+{alerts.expired.length - 3} more</div>}
                </button>
              )}
              {alerts.expiring_soon?.length > 0 && (
                <button className="pharma-inv-alert pharma-inv-alert--expiring" onClick={() => navigate('/pharmacy/stock?filter=expiring_soon')}>
                  <div className="pharma-inv-alert-hdr">
                    Expiring · {alerts.expiring_soon.length}
                    <svg className="pharma-inv-alert-arrow" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                  {alerts.expiring_soon.slice(0, 3).map(m => (
                    <div key={m.id} className="pharma-inv-alert-item">
                      <strong>{m.name}</strong>{m.batch_number ? ` · ${m.batch_number}` : ''} · {m.expiry_date}
                    </div>
                  ))}
                  {alerts.expiring_soon.length > 3 && <div className="pharma-inv-alert-more">+{alerts.expiring_soon.length - 3} more</div>}
                </button>
              )}
              {alerts.low_stock?.length > 0 && (
                <button className="pharma-inv-alert pharma-inv-alert--lowstock" onClick={() => navigate('/pharmacy/stock?filter=low_stock')}>
                  <div className="pharma-inv-alert-hdr">
                    Low Stock · {alerts.low_stock.length}
                    <svg className="pharma-inv-alert-arrow" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                  {alerts.low_stock.slice(0, 3).map(m => (
                    <div key={m.id} className="pharma-inv-alert-item">
                      <strong>{m.name}</strong> · {m.quantity} left (min {m.reorder_level})
                    </div>
                  ))}
                  {alerts.low_stock.length > 3 && <div className="pharma-inv-alert-more">+{alerts.low_stock.length - 3} more</div>}
                </button>
              )}
            </div>
          )}

          {/* Other Items sub-section */}
          {itemSummary !== null && (
            <>
              <div className="pharma-inv-divider" />
              <div className="pharma-inv-sub-row">
                <span className="pharma-inv-sub-icon pharma-inv-sub-icon--item">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </span>
                <span className="pharma-inv-sub-label">Other Items</span>
                <span className="pharma-inv-sub-count">{itemSummary.total} items</span>
                <button className="pharma-inv-sub-link" onClick={() => navigate('/pharmacy/stock?tab=stock')}>
                  View
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>

              <div className="pharma-inv-grid">
                <button className="pharma-inv-scard pharma-inv-scard--teal" onClick={() => navigate('/pharmacy/stock?tab=stock')}>
                  <div className="pharma-inv-scard-top">
                    <span className="pharma-inv-scard-label">Total{'\n'}Items</span>
                    <span className="pharma-inv-scard-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                    </span>
                  </div>
                  <div className="pharma-inv-scard-value">{itemSummary.total}</div>
                </button>

                <button
                  className={`pharma-inv-scard pharma-inv-scard--${itemSummary.out_of_stock > 0 ? 'red' : 'green'}`}
                  onClick={() => navigate('/pharmacy/stock?tab=stock')}
                >
                  <div className="pharma-inv-scard-top">
                    <span className="pharma-inv-scard-label">Out of{'\n'}Stock</span>
                    <span className="pharma-inv-scard-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </span>
                  </div>
                  <div className="pharma-inv-scard-value">{itemSummary.out_of_stock}</div>
                </button>

                <button
                  className={`pharma-inv-scard pharma-inv-scard--${itemSummary.low_stock > 0 ? 'amber' : 'green'}`}
                  onClick={() => navigate('/pharmacy/stock?tab=stock')}
                >
                  <div className="pharma-inv-scard-top">
                    <span className="pharma-inv-scard-label">Low{'\n'}Stock</span>
                    <span className="pharma-inv-scard-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </span>
                  </div>
                  <div className="pharma-inv-scard-value">{itemSummary.low_stock}</div>
                </button>

                <button className="pharma-inv-scard pharma-inv-scard--indigo" onClick={() => navigate('/pharmacy/stock?tab=stock')}>
                  <div className="pharma-inv-scard-top">
                    <span className="pharma-inv-scard-label">Stock{'\n'}Value</span>
                    <span className="pharma-inv-scard-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                  </div>
                  <div className="pharma-inv-scard-value" style={{ fontSize: '1.1rem' }}>
                    ₹{Number(itemSummary.stock_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Search ────────────────────────────────────────────────────────── */}
      {(queueStatus === 'done' && allRx.length > 0) && (
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
          {q && (
            <span className="pharma-search-count">
              {filtered.length} of {allRx.length} shown
            </span>
          )}
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
          <button className="btn-link" style={{ marginTop: 'var(--space-sm)' }} onClick={handleRefresh}>
            Try again
          </button>
        </div>
      )}

      {/* Queue empty (no active rx at all) */}
      {queueStatus === 'done' && allRx.length === 0 && (
        <div className="pharma-empty-state">
          <div className="pharma-empty-card">

            {/* Rx badge with orbiting ring */}
            <div className="pharma-empty-illus">
              <svg className="pharma-empty-orbit" width="116" height="116" viewBox="0 0 116 116" fill="none">
                <circle cx="58" cy="58" r="54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 5" strokeOpacity="0.35" />
                {/* Capsule top */}
                <g transform="translate(58,4) rotate(-90)">
                  <rect x="-11" y="-4.5" width="22" height="9" rx="4.5" fill="currentColor" fillOpacity="0.50" />
                  <line x1="0" y1="-4" x2="0" y2="4" stroke="white" strokeWidth="1.2" strokeOpacity="0.55" />
                </g>
                {/* Dot bottom-right */}
                <circle cx="104" cy="85" r="4.5" fill="currentColor" fillOpacity="0.40" />
                {/* Mini pill bottom-left */}
                <g transform="translate(12,85) rotate(30)">
                  <rect x="-8" y="-3.5" width="16" height="7" rx="3.5" fill="currentColor" fillOpacity="0.45" />
                </g>
              </svg>

              <div className="pharma-empty-badge-wrap">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize="20" fontWeight="700" fontFamily="Georgia, serif">Rx</text>
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
            <div className="pharma-empty-sub">
              New prescriptions from the doctor will appear here automatically.
            </div>
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

      {/* Active queue */}
      {queueStatus === 'done' && filtered.length > 0 && (
        <div className="pharma-queue">
          {ongoing.length > 0 && (
            <section className="pharma-section">
              <div className="pharma-section-hdr">
                <span className="pharma-section-hdr-title">Dispensing</span>
                <span className="pharma-section-hdr-count">{ongoing.length}</span>
              </div>
              <ul className="pharma-qlist">
                {ongoing.map(rx => (
                  <li key={rx.id}>
                    <RxCard rx={rx} onClick={() => navigate(`/pharmacy/prescriptions/${rx.id}`)} />
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
                    <RxCard rx={rx} onClick={() => navigate(`/pharmacy/prescriptions/${rx.id}`)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
