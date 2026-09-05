import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getRevenueDetails } from '../../services/dashboardService'

function fmt(amount) {
  if (!amount) return 'Rs. 0'
  return 'Rs. ' + Math.round(amount).toLocaleString('en-PK')
}

function pct(paid, total) {
  if (!total) return '0%'
  return Math.round((paid / total) * 100) + '%'
}

export default function RevenueModal({ open, onClose }) {
  const [data,   setData]   = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | done | error

  const fetch = useCallback(() => {
    setStatus('loading')
    getRevenueDetails()
      .then(({ data: res }) => { setData(res.data); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    if (!open) return
    fetch()
  }, [open, fetch])

  // ESC to close
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="rev-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Revenue overview">
      <div className="rev-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="rev-header">
          <div className="rev-header-left">
            <span className="rev-header-icon"><IconRevenue /></span>
            <div>
              <h2 className="rev-title">Revenue Overview</h2>
              <p className="rev-subtitle">Clinic financial summary — visible to doctor only</p>
            </div>
          </div>
          <button className="rev-close" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div className="rev-body">
          {status === 'loading' && <ModalSkeleton />}

          {status === 'error' && (
            <div className="rev-error">
              <p>Could not load revenue data. Please try again.</p>
              <button className="rev-retry-btn" onClick={fetch}>Retry</button>
            </div>
          )}

          {status === 'done' && data && (
            <>
              {/* Period cards */}
              <div className="rev-periods">
                <PeriodCard
                  label="Today"
                  accent="primary"
                  period={data.today}
                  icon={<IconDay />}
                />
                <PeriodCard
                  label="This Week"
                  accent="info"
                  period={data.this_week}
                  icon={<IconWeek />}
                />
                <PeriodCard
                  label="This Month"
                  accent="success"
                  period={data.this_month}
                  icon={<IconMonth />}
                />
                <PeriodCard
                  label="All Time"
                  accent="sand"
                  period={data.all_time}
                  icon={<IconTotal />}
                  showAvg
                />
              </div>

              {/* Calculations breakdown */}
              <div className="rev-calc-section">
                <h3 className="rev-calc-title">How it's calculated</h3>
                <div className="rev-calc-grid">
                  <CalcRow
                    label="Revenue"
                    formula="Sum of consultation fees for all paid visits in the period"
                    example={`${data.all_time.paid_visits} paid visits × avg ${fmt(data.all_time.avg_fee)} = ${fmt(data.all_time.revenue)}`}
                  />
                  <CalcRow
                    label="Collection Rate"
                    formula="Paid visits ÷ Total visits × 100"
                    example={`${data.all_time.paid_visits} ÷ ${data.all_time.total_visits} × 100 = ${pct(data.all_time.paid_visits, data.all_time.total_visits)}`}
                  />
                  <CalcRow
                    label="Average Fee"
                    formula="Total revenue ÷ number of paid consultations"
                    example={`${fmt(data.all_time.revenue)} ÷ ${data.all_time.paid_visits} = ${fmt(data.all_time.avg_fee)}`}
                  />
                  <CalcRow
                    label="Free Visits"
                    formula="Visits with consultation_fee = 0 or not set"
                    example={`${data.all_time.total_visits - data.all_time.paid_visits} free consultation${(data.all_time.total_visits - data.all_time.paid_visits) !== 1 ? 's' : ''} recorded`}
                  />
                </div>
              </div>

              <p className="rev-note">
                Revenue data updates in real time from visit records. Set a consultation fee when logging a visit to track earnings accurately.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Period card ──────────────────────────────────────────────────────────── */
function PeriodCard({ label, accent, period, icon, showAvg }) {
  const rate = pct(period.paid_visits, period.total_visits)
  const free = period.total_visits - period.paid_visits

  return (
    <div className={`rev-period rev-period--${accent}`}>
      <div className="rev-period-header">
        <span className="rev-period-icon">{icon}</span>
        <span className="rev-period-label">{label}</span>
      </div>
      <p className="rev-period-amount">{fmt(period.revenue)}</p>
      <div className="rev-period-stats">
        <span className="rev-period-stat">
          <strong>{period.paid_visits}</strong> paid
        </span>
        <span className="rev-period-dot" />
        <span className="rev-period-stat">
          <strong>{free}</strong> free
        </span>
        <span className="rev-period-dot" />
        <span className="rev-period-stat">
          <strong>{rate}</strong> collected
        </span>
      </div>
      {showAvg && period.avg_fee > 0 && (
        <p className="rev-period-avg">avg {fmt(period.avg_fee)} / visit</p>
      )}
      {/* Collection bar */}
      <div className="rev-bar-track">
        <div
          className="rev-bar-fill"
          style={{ width: period.total_visits ? `${(period.paid_visits / period.total_visits) * 100}%` : '0%' }}
        />
      </div>
    </div>
  )
}

/* ── Calculation row ──────────────────────────────────────────────────────── */
function CalcRow({ label, formula, example }) {
  return (
    <div className="rev-calc-row">
      <p className="rev-calc-label">{label}</p>
      <p className="rev-calc-formula">{formula}</p>
      <p className="rev-calc-example">{example}</p>
    </div>
  )
}

/* ── Loading skeleton ─────────────────────────────────────────────────────── */
function ModalSkeleton() {
  return (
    <div className="rev-skeleton">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rev-skeleton-card" />
      ))}
    </div>
  )
}

/* ── Icons ────────────────────────────────────────────────────────────────── */
function IconRevenue() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9.5h4.5a2 2 0 0 1 0 4H9.5a2 2 0 0 0 0 4H15" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M14 4L4 14M4 4l10 10" />
    </svg>
  )
}

function IconDay() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="4" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2" />
    </svg>
  )
}

function IconWeek() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="16" height="14" rx="2" />
      <path d="M1 7h16M5 1v4M13 1v4" />
    </svg>
  )
}

function IconMonth() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1,14 5,9 9,11 13,5 17,8" />
      <line x1="1" y1="17" x2="17" y2="17" />
    </svg>
  )
}

function IconTotal() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2v14M4 7l5-5 5 5" />
    </svg>
  )
}
