import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPharmacyPrescriptions, getPharmacyStats } from '../../services/pharmacyService'
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
      <div className="pharma-qcard-avatar">{rx.patient.name[0].toUpperCase()}</div>

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

  const [search, setSearch] = useState('')

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

  useEffect(() => { loadQueue(); loadStats() }, [loadQueue, loadStats])

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
            ? `Synced ${lastSync.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`
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
