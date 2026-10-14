import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getDashboardStats, getTodayPatients, getDashboardPendingRx } from '../../services/dashboardService'
import { listFollowups } from '../../services/visitService'
import PatientSearchBox from './PatientSearchBox'
import ErrorBoundary from '../../components/ErrorBoundary'
import '../../styles/dashboard.css'

const HONORIFICS = new Set(['Dr.', 'Dr', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Prof'])

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtTime(str) {
  if (!str) return ''
  return new Date(str).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function heroStatus(stats, status) {
  if (status !== 'done' || !stats) return null
  if ((stats.total_patients ?? 0) === 0) return { text: 'Register your first patient to get started', type: 'onboard' }
  const v = stats.today_visits ?? 0
  const h = new Date().getHours()
  if (v === 0 && h >= 7 && h < 19) return { text: 'No visits recorded yet today', type: 'neutral' }
  if (v === 1) return { text: "You've seen 1 patient today", type: 'positive' }
  if (v > 1) return { text: `You've seen ${v} patients today`, type: 'positive' }
  return null
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const searchRef = useRef(null)

  const [stats, setStats]             = useState(null)
  const [statsStatus, setStatsStatus] = useState('loading')
  const [refreshLabel, setRefreshLabel] = useState('')

  const [todayPatients, setTodayPatients] = useState([])
  const [todayStatus, setTodayStatus]     = useState('loading')

  const [pendingRx, setPendingRx] = useState([])
  const [rxStatus, setRxStatus]   = useState('loading')

  const [followups,      setFollowups]      = useState([])
  const [followupStatus, setFollowupStatus] = useState('loading')

  const fetchStats = useCallback(() => {
    getDashboardStats()
      .then(({ data }) => {
        setStats(data.data)
        setStatsStatus('done')
        setRefreshLabel('Updated just now')
        setTimeout(() => setRefreshLabel('Updated 1 min ago'), 55_000)
      })
      .catch(() => setStatsStatus('error'))
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchStats()

    getTodayPatients()
      .then(({ data }) => { if (!cancelled) { setTodayPatients(data.data ?? []); setTodayStatus('done') } })
      .catch(() => { if (!cancelled) setTodayStatus('error') })

    getDashboardPendingRx()
      .then(({ data }) => { if (!cancelled) { setPendingRx(data.data ?? []); setRxStatus('done') } })
      .catch(() => { if (!cancelled) setRxStatus('error') })

    listFollowups()
      .then(data => { if (!cancelled) { setFollowups(data ?? []); setFollowupStatus('done') } })
      .catch(() => { if (!cancelled) setFollowupStatus('done') })

    const interval = setInterval(fetchStats, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [fetchStats])

  // "/" focuses the search input
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const todayDate     = new Date().toISOString().split('T')[0]
  const followupsToday = followups.filter(f => f.followup_date === todayDate).length

  const nameParts = (user?.name ?? '').split(' ').filter(p => !HONORIFICS.has(p))
  const firstName  = nameParts[0] ?? 'Doctor'
  const clinicName = user?.clinic?.name ?? null
  const isNewClinic = statsStatus === 'done' && (stats?.total_patients ?? 0) === 0

  const todayVisits = stats?.today_visits ?? 0
  const todayRx     = statsStatus === 'done' ? (stats?.pending_rx ?? 0) + (stats?.draft_rx ?? 0) : null
  const pendingPharm = stats?.pending_rx ?? 0
  const totalPatients = stats?.total_patients ?? 0

  return (
    <div className="dash-root">

      {/* ── Hero card — gradient + embedded stats ── */}
      <section className="dash-hero">
        <div className="dash-hero-top">
          <div className="dash-hero-text">
            <p className="dash-hero-date">{getFormattedDate().toUpperCase()}</p>
            <h2 className="dash-hero-greeting">{getGreeting()}, Dr. {firstName}</h2>
            {clinicName && <p className="dash-hero-clinic">{clinicName}</p>}
          </div>
          <div className="dash-hero-actions">
            <button className="dash-hero-btn-primary" onClick={() => navigate('/prescriptions/new')}>
              + New Prescription
            </button>
            <button className="dash-hero-btn-ghost" onClick={() => navigate('/clinic')}>
              Open OPD
            </button>
          </div>
        </div>

        <div className="dash-hero-stats">
          <button className="dash-hs" onClick={() => navigate('/clinic')}>
            <span className="dash-hs-val">{statsStatus === 'done' ? todayVisits : '—'}</span>
            <span className="dash-hs-lbl">Seen Today</span>
          </button>
          <div className="dash-hs-sep" />
          <button className="dash-hs" onClick={() => navigate('/prescriptions')}>
            <span className="dash-hs-val">{statsStatus === 'done' ? (todayRx ?? 0) : '—'}</span>
            <span className="dash-hs-lbl">Prescriptions</span>
          </button>
          <div className="dash-hs-sep" />
          <button className="dash-hs" onClick={() => navigate('/prescriptions')}>
            <span className="dash-hs-val">{statsStatus === 'done' ? pendingPharm : '—'}</span>
            <span className="dash-hs-lbl">At Pharmacy</span>
          </button>
          <div className="dash-hs-sep" />
          <button className="dash-hs" onClick={() => navigate('/patients')}>
            <span className="dash-hs-val">{statsStatus === 'done' ? totalPatients : '—'}</span>
            <span className="dash-hs-lbl">Total Patients</span>
          </button>
        </div>
      </section>

      {/* ── Draft alert ── */}
      {statsStatus === 'done' && (stats?.draft_rx ?? 0) > 0 && (
        <button className="dash-draft-alert" onClick={() => navigate('/prescriptions')}>
          <span className="dash-draft-icon"><IconDraftAlert /></span>
          <span className="dash-draft-text">
            <strong>{stats.draft_rx}</strong> unsent draft prescription{stats.draft_rx !== 1 ? 's' : ''} — not yet sent to pharmacy
          </span>
          <span className="dash-draft-cta">Review →</span>
        </button>
      )}

      {/* ── Onboarding or main content ── */}
      {isNewClinic ? (
        <div className="dash-onboard">
          <div className="dash-onboard-icon"><IconPatientPlus /></div>
          <h3 className="dash-onboard-title">Welcome to Clinora</h3>
          <p className="dash-onboard-sub">
            Register your first patient to start tracking visits, prescriptions, and revenue.
          </p>
          <button className="btn-primary dash-onboard-btn" onClick={() => navigate('/prescriptions/new')}>
            Write First Prescription
          </button>
        </div>
      ) : (
        <>
          {/* ── Patient search ── */}
          <section className="dash-search-section">
            <PatientSearchBox ref={searchRef} onRegister={() => navigate('/patients?new=1')} />
          </section>

          {/* ── Main asymmetric 2-col layout ── */}
          <div className="dash-main-grid">

            {/* LEFT: Today's Prescriptions — primary wide column */}
            <ErrorBoundary>
              <div className="card dash-card dash-card--rx">
                <div className="dash-card-header">
                  <span className="dash-card-title dash-card-title--rx">Today's Prescriptions</span>
                  <div className="dash-card-header-right">
                    {statsStatus === 'done' && (stats?.completed_today ?? 0) > 0 && (
                      <span className="dash-completed-badge">{stats.completed_today} filled</span>
                    )}
                    <button className="btn-link" onClick={() => navigate('/prescriptions')}>View all</button>
                  </div>
                </div>
                <SidePanel
                  status={rxStatus}
                  items={pendingRx}
                  emptyIcon={<IconPillEmpty />}
                  emptyTitle="No prescriptions yet today"
                  emptySub="Prescriptions written today will appear here."
                >
                  {pendingRx.map((rx) => {
                    const meds = rx.items?.slice(0, 3).map(i => i.medicine_name).filter(Boolean) ?? []
                    const extra = (rx.items?.length ?? 0) - 3
                    return (
                      <li key={rx.id}>
                        <button className="dash-list-item" onClick={() => navigate('/prescriptions')}>
                          <div className="dash-avatar rx-avatar"><IconRx /></div>
                          <div className="dash-item-body">
                            <div className="dash-item-name">
                              {rx.patient?.name ?? `Patient #${rx.patient_id}`}
                            </div>
                            <div className="dash-item-sub dash-rx-meds">
                              {meds.length > 0
                                ? <>{meds.join(', ')}{extra > 0 && <span className="dash-rx-extra"> +{extra}</span>}</>
                                : `${rx.items?.length ?? 0} item${rx.items?.length !== 1 ? 's' : ''}`
                              }
                            </div>
                          </div>
                          <span className="dash-badge">Pending</span>
                          <span className="dash-arrow" aria-hidden="true">→</span>
                        </button>
                      </li>
                    )
                  })}
                </SidePanel>
                <button className="dash-new-rx-btn" onClick={() => navigate('/prescriptions/new')}>
                  + New Prescription
                </button>
              </div>
            </ErrorBoundary>

            {/* RIGHT: Stacked sidebar */}
            <div className="dash-right-col">

              {/* Seen Today */}
              <ErrorBoundary>
                <div className="card dash-card">
                  <div className="dash-card-header">
                    <span className="dash-card-title">Seen Today</span>
                    <button className="btn-link" onClick={() => navigate('/clinic')}>View Clinic</button>
                  </div>
                  <SidePanel
                    status={todayStatus}
                    items={todayPatients}
                    emptyIcon={<IconCalendarEmpty />}
                    emptyTitle="No patients yet today"
                    emptySub="Patients seen today will appear here."
                  >
                    {todayPatients.map((v) => (
                      <li key={v.id}>
                        <button className="dash-list-item" onClick={() => navigate(`/patients/${v.patient_id}`)}>
                          <div className="dash-avatar">{v.patient?.name?.[0]?.toUpperCase() ?? '?'}</div>
                          <div className="dash-item-body">
                            <div className="dash-item-name">{v.patient?.name ?? 'Unknown'}</div>
                            <div className="dash-item-sub">
                              {fmtTime(v.visited_at)}
                              {v.consultation_fee > 0
                                ? <span className="dash-fee-tag">₹{Math.round(v.consultation_fee).toLocaleString('en-IN')}</span>
                                : <span className="dash-fee-missing">no fee</span>
                              }
                            </div>
                          </div>
                          <span className="dash-arrow" aria-hidden="true">→</span>
                        </button>
                      </li>
                    ))}
                  </SidePanel>
                </div>
              </ErrorBoundary>

              {/* Today's breakdown mini-stats */}
              {statsStatus === 'done' && (
                <div className="card dash-mini-stats">
                  <p className="dash-mini-stats-label">Today's Breakdown</p>
                  <div className="dash-mini-stats-row">
                    <div className="dash-mini-stat">
                      <span className="dash-mini-stat-val dash-mini-stat-val--green">{stats?.completed_today ?? 0}</span>
                      <span className="dash-mini-stat-lbl">Rx Filled</span>
                    </div>
                    <div className="dash-mini-stat">
                      <span className="dash-mini-stat-val dash-mini-stat-val--amber">{stats?.draft_rx ?? 0}</span>
                      <span className="dash-mini-stat-lbl">Drafts</span>
                    </div>
                    <div className="dash-mini-stat">
                      <span className="dash-mini-stat-val">{stats?.yesterday_visits ?? 0}</span>
                      <span className="dash-mini-stat-lbl">Yesterday</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-ups (if any) */}
              {followupStatus !== 'loading' && followups.length > 0 && (
                <ErrorBoundary>
                  <div className="card dash-card">
                    <div className="dash-card-header">
                      <span className="dash-card-title">Follow-ups</span>
                      <button className="btn-link" onClick={() => navigate('/clinic')}>View Clinic</button>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {followups.slice(0, 5).map(f => {
                        const isToday = f.followup_date === new Date().toISOString().split('T')[0]
                        return (
                          <li key={f.id}>
                            <button className="dash-list-item" onClick={() => navigate(`/visits/${f.id}`)}>
                              <div className="dash-avatar" style={{ background: isToday ? 'var(--clr-danger)' : 'var(--clr-primary)', color: '#fff', fontSize: 11 }}>
                                {isToday ? 'NOW' : f.followup_date?.slice(5)}
                              </div>
                              <div className="dash-item-body">
                                <div className="dash-item-name">{f.patient?.name}</div>
                                <div className="dash-item-sub">
                                  {isToday ? 'Today' : new Date(f.followup_date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  {f.followup_notes && ` — ${f.followup_notes}`}
                                </div>
                              </div>
                              <span className="dash-arrow" aria-hidden="true">→</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </ErrorBoundary>
              )}

            </div>
          </div>

          {/* ── Week strip ── */}
          <WeekStrip days={stats?.week_activity} loading={statsStatus === 'loading'} />
          {refreshLabel && (
            <p className="dash-refresh-label">{refreshLabel} · auto-refreshes every minute</p>
          )}
        </>
      )}
    </div>
  )
}

/* ── Quick action tile ──────────────────────────────────────────────────── */
function QuickTile({ icon, label, sub, color, onClick }) {
  return (
    <button className="dash-action-tile" data-color={color} onClick={onClick}>
      <div className="dash-action-icon">{icon}</div>
      <div className="dash-action-text">
        <span className="dash-action-label">{label}</span>
        {sub && <span className="dash-action-sub">{sub}</span>}
      </div>
    </button>
  )
}

/* ── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ icon, value, label, accent, status, onClick, delta }) {
  if (status === 'loading') {
    return <div className="stat-card stat-card--skeleton" aria-hidden="true" />
  }

  const clickProps = onClick
    ? { role: 'button', tabIndex: 0, onClick, onKeyDown: e => e.key === 'Enter' && onClick() }
    : {}

  return (
    <div className={`stat-card stat-card--${accent}`} {...clickProps}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-value">{status === 'error' ? '—' : (value ?? 0)}</div>
      <div className="stat-card-label">{label}</div>
      {delta != null && (
        <div className={`stat-card-delta stat-card-delta--${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`}>
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta)} vs yesterday
        </div>
      )}
    </div>
  )
}

/* ── Week activity strip ────────────────────────────────────────────────── */
function WeekStrip({ days, loading }) {
  if (loading) {
    return (
      <div className="dash-week-strip" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="dash-week-day">
            <div className="dash-week-bar-track">
              <div className="dash-week-bar-skel" style={{ height: `${25 + (i * 13) % 55}%` }} />
            </div>
            <span className="dash-week-label">—</span>
          </div>
        ))}
      </div>
    )
  }

  if (!days?.length) return null

  const max = Math.max(...days.map(d => d.count), 1)
  const totalWeek = days.reduce((s, d) => s + d.count, 0)

  function fmtDayLabel(raw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date(raw + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short' })
    }
    return raw
  }

  return (
    <div className="card dash-week-card">
      <div className="dash-week-card-header">
        <span className="dash-week-card-title">This Week</span>
        <span className="dash-week-card-total">{totalWeek} visit{totalWeek !== 1 ? 's' : ''}</span>
      </div>
      <div className="dash-week-strip" role="img" aria-label="Visits this week">
        {days.map((day, i) => (
          <div
            key={i}
            className={`dash-week-day${day.is_today ? ' dash-week-day--today' : ''}`}
            title={`${fmtDayLabel(day.label)}: ${day.count} visit${day.count !== 1 ? 's' : ''}`}
          >
            {day.count > 0 && <span className="dash-week-count">{day.count}</span>}
            <div className="dash-week-bar-track">
              <div
                className="dash-week-bar-fill"
                style={{ height: `${Math.max((day.count / max) * 100, day.count > 0 ? 8 : 0)}%` }}
              />
            </div>
            <span className="dash-week-label">{fmtDayLabel(day.label)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Side panel ─────────────────────────────────────────────────────────── */
function SidePanel({ status, items, emptyIcon, emptyTitle, emptySub, children }) {
  if (status === 'loading') {
    return (
      <ul className="dash-list" aria-busy="true">
        {[0, 1, 2].map(i => (
          <li key={i} className="dash-skeleton-row" aria-hidden="true">
            <div className="dash-skeleton-avatar" />
            <div className="dash-skeleton-lines">
              <div className="dash-skeleton-line dash-skeleton-line--name" />
              <div className="dash-skeleton-line dash-skeleton-line--sub" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (status === 'error') {
    return (
      <div className="dash-empty">
        <div className="dash-empty-icon"><IconError /></div>
        <p className="dash-empty-title">Could not load data</p>
        <p className="dash-empty-sub">Check your connection and refresh the page.</p>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="dash-empty">
        {emptyIcon && <div className="dash-empty-icon">{emptyIcon}</div>}
        <p className="dash-empty-title">{emptyTitle}</p>
        {emptySub && <p className="dash-empty-sub">{emptySub}</p>}
      </div>
    )
  }

  return <ul className="dash-list">{children}</ul>
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
function IconToday() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="16" height="14" rx="2" />
      <path d="M1 7h16M5 1v4M13 1v4" />
      <rect x="5" y="10" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="8.5" y="10" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1,14 5,9 9,11 13,5 17,8" />
      <line x1="1" y1="17" x2="17" y2="17" />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6.5" cy="5" r="2.8" />
      <path d="M1 16c0-3.038 2.462-5.5 5.5-5.5S12 12.962 12 16" />
      <path d="M11.5 3.2a2.8 2.8 0 0 1 0 5.6" strokeOpacity="0.55" />
      <path d="M13.5 10.7C15.5 11.5 17 13.5 17 16" strokeOpacity="0.55" />
    </svg>
  )
}

function IconPill() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="14" height="6" rx="3" />
      <line x1="9" y1="6" x2="9" y2="12" strokeOpacity="0.4" />
    </svg>
  )
}

function IconRx() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="1" width="12" height="16" rx="2" />
      <path d="M6 6h6M6 9h6M6 12h4" />
    </svg>
  )
}

function IconPatientPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="5.5" r="3" />
      <path d="M1 16c0-3.314 2.686-6 6-6" />
      <line x1="13" y1="9" x2="13" y2="17" />
      <line x1="9" y1="13" x2="17" y2="13" />
    </svg>
  )
}

function IconStethoscope() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2v7a5 5 0 0 0 10 0V2" />
      <circle cx="14" cy="14.5" r="2" />
      <line x1="9" y1="16" x2="12" y2="14" />
    </svg>
  )
}

function IconRxDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="1" width="12" height="16" rx="2" />
      <path d="M6 6h6M6 9h6M6 12h4" />
    </svg>
  )
}

function IconSettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" />
    </svg>
  )
}

function IconDraftAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 1L1 16h16L9 1z" />
      <line x1="9" y1="7" x2="9" y2="11" />
      <circle cx="9" cy="13.5" r=".5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconCalendarEmpty() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="18" rx="3" />
      <path d="M2 9h20M7 2v4M17 2v4" />
      <path d="M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01" />
    </svg>
  )
}

function IconPillEmpty() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" strokeOpacity="0.4" />
    </svg>
  )
}

function IconError() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
