import '../../styles/dr-revenue.css'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useSessionState } from '../../hooks/useSessionState'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'
import { getRevenueDetails, getVisitStatsByDoctor } from '../../services/dashboardService'
import { recordVisitPayment, getRevenueTransactions } from '../../services/visitService'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'

async function exportCsv(txs, period, filter) {
  const BOM  = '﻿'
  const head = ['Patient', 'Visit Date', 'Status', 'Fee (Rs)', 'Paid (Rs)', 'Due (Rs)']
  const rows = txs.map(tx => {
    const due = Math.max(0, tx.consultation_fee - tx.amount_paid)
    return [tx.patient?.name ?? '', tx.visited_at ? new Date(tx.visited_at).toLocaleDateString('en-IN') : '',
      tx.payment_status, tx.consultation_fee.toFixed(2), tx.amount_paid.toFixed(2), due.toFixed(2)]
  })
  const body = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  try {
    const saved = await invoke('write_text_to_downloads', { content: BOM + body, filename: `revenue-${filter}-${period}.csv` })
    toast.success(`Exported to Downloads: ${saved}`)
  } catch { toast.error('Export failed.') }
}

const PERIODS = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'Week' },
  { key: 'this_month', label: 'Month' },
  { key: 'all_time',   label: 'All Time' },
]

function fmt(n) {
  return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RevenueChart({ txs, period }) {
  const ref = useRef(null)
  const data = useMemo(() => {
    if (!txs.length) return null
    const byDate = {}
    txs.forEach(tx => {
      const d = tx.visited_at?.slice(0, 10); if (d) byDate[d] = (byDate[d] || 0) + tx.consultation_fee
    })
    let entries = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
    if (period === 'all_time' && entries.length > 31) {
      const byM = {}
      entries.forEach(([d, v]) => { const m = d.slice(0, 7); byM[m] = (byM[m] || 0) + v })
      entries = Object.entries(byM).sort(([a], [b]) => a.localeCompare(b))
    }
    return entries
  }, [txs, period])

  useEffect(() => {
    if (!data || !ref.current) return
    const canvas = ref.current, dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth, H = 140
    canvas.width = W * dpr; canvas.height = H * dpr
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr)
    const isDark = document.documentElement.dataset.theme === 'dark'
    const barClr = '#2563eb', gridClr = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', lblClr = '#94a3b8'
    const PL = 52, PR = 12, PT = 12, PB = 28, plotW = W - PL - PR, plotH = H - PT - PB
    const vals = data.map(([, v]) => v), maxVal = Math.max(...vals, 1)
    ctx.clearRect(0, 0, W, H)
    ctx.font = '9px system-ui,sans-serif'
    for (let i = 0; i <= 4; i++) {
      const y = PT + (plotH / 4) * i
      ctx.strokeStyle = gridClr; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + plotW, y); ctx.stroke()
      ctx.fillStyle = lblClr; ctx.textAlign = 'right'
      const v = maxVal * (1 - i / 4)
      ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v), PL - 5, y + 3.5)
    }
    const n = data.length, gap = plotW / n, barW = Math.max(4, Math.min(32, gap * 0.55))
    const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const se = Math.ceil(n / 10)
    data.forEach(([lbl, val], i) => {
      const cx = PL + gap * i + gap / 2, bH = (val / maxVal) * plotH
      const bx = cx - barW / 2, by = PT + plotH - bH
      const r = Math.min(3, barW / 2, bH)
      ctx.fillStyle = barClr
      ctx.beginPath()
      ctx.moveTo(bx + r, by); ctx.lineTo(bx + barW - r, by)
      ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + r)
      ctx.lineTo(bx + barW, by + bH); ctx.lineTo(bx, by + bH); ctx.lineTo(bx, by + r)
      ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.fill()
      if (i % se === 0) {
        let l = lbl
        if (lbl.length === 10) l = new Date(lbl + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        else if (lbl.length === 7) l = MN[parseInt(lbl.split('-')[1], 10) - 1]
        ctx.fillStyle = lblClr; ctx.textAlign = 'center'
        ctx.fillText(l, cx, H - PB + 12)
      }
    })
  }, [data])

  if (!data || data.length < 2) return null
  return <canvas ref={ref} className="drv-chart" />
}

export default function DoctorRevenuePage() {
  const [data,        setData]        = useState(null)
  const [status,      setStatus]      = useState('loading')
  const [period,      setPeriod]      = useSessionState('revenue:period', 'this_month')
  const [filter,      setFilter]      = useSessionState('revenue:filter', 'all')
  const [txs,         setTxs]         = useState([])
  const [txLoading,   setTxLoading]   = useState(true)
  const [savingId,    setSavingId]    = useState(null)
  const [doctorStats, setDoctorStats] = useState([])
  const initialized = useRef(false)

  /* Parallel initial load — all 3 requests fire at once */
  useEffect(() => {
    setTxLoading(true)
    Promise.all([
      getRevenueDetails(),
      getRevenueTransactions(period, filter),
      getVisitStatsByDoctor(period),
    ])
      .then(([statsRes, txsRes, drRes]) => {
        setData(statsRes.data.data)
        setTxs(txsRes.data.data ?? [])
        setDoctorStats(drRes.data.data ?? [])
        setStatus('done')
        initialized.current = true
      })
      .catch(() => setStatus('error'))
      .finally(() => setTxLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Period change → reload txs + doctor stats in parallel */
  useEffect(() => {
    if (!initialized.current) return
    setTxLoading(true)
    Promise.all([
      getRevenueTransactions(period, filter),
      getVisitStatsByDoctor(period),
    ])
      .then(([txsRes, drRes]) => {
        setTxs(txsRes.data.data ?? [])
        setDoctorStats(drRes.data.data ?? [])
      })
      .catch(() => toast.error('Could not reload data.'))
      .finally(() => setTxLoading(false))
  }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Filter change → txs only */
  useEffect(() => {
    if (!initialized.current) return
    setTxLoading(true)
    getRevenueTransactions(period, filter)
      .then(({ data: r }) => setTxs(r.data ?? []))
      .catch(() => toast.error('Could not load transactions.'))
      .finally(() => setTxLoading(false))
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function markPaid(tx) {
    setSavingId(tx.id)
    try {
      await recordVisitPayment(tx.id, { payment_status: 'paid', amount_paid: tx.consultation_fee })
      toast.success(`Marked paid — ${tx.patient?.name}`)
      const [statsRes, txsRes, drRes] = await Promise.all([
        getRevenueDetails(),
        getRevenueTransactions(period, filter),
        getVisitStatsByDoctor(period),
      ])
      setData(statsRes.data.data)
      setTxs(txsRes.data.data ?? [])
      setDoctorStats(drRes.data.data ?? [])
    } catch { toast.error('Could not update payment.') }
    finally { setSavingId(null) }
  }

  if (status === 'loading') return <PageLoader />
  if (status === 'error') return <div className="card state-panel">Could not load revenue data.</div>

  const p = data[period] ?? {}
  const collRate = p.revenue > 0 ? Math.round((p.amount_collected / p.revenue) * 100) : 0
  const avgFee   = p.total_visits > 0 ? p.revenue / p.total_visits : 0

  const TABS = [
    { key: 'all',         label: 'All Visits',   count: p.total_visits ?? 0 },
    { key: 'outstanding', label: 'Unpaid',        count: p.unpaid_count ?? 0 },
    { key: 'collected',   label: 'Paid',          count: p.paid_visits ?? 0 },
  ]

  const totalFee  = txs.reduce((s, t) => s + t.consultation_fee, 0)
  const totalPaid = txs.reduce((s, t) => s + t.amount_paid, 0)
  const totalDue  = txs.reduce((s, t) => s + Math.max(0, t.consultation_fee - t.amount_paid), 0)

  function handleStatKeyDown(e, filterKey) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(filterKey) }
  }

  return (
    <div className="rv2-page drv-page">

      {/* ── Page header ── */}
      <div className="drv-hdr">
        <div>
          <h1 className="drv-title">Revenue</h1>
          <p className="drv-sub">Consultation fees &amp; payment status</p>
        </div>
        <div className="drv-period-seg">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              className={`drv-period-btn${period === key ? ' drv-period-btn--on' : ''}`}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat strip ── */}
      <div className="drv-strip">
        <div
          className="drv-stat drv-stat--blue"
          onClick={() => setFilter('all')}
          onKeyDown={e => handleStatKeyDown(e, 'all')}
          role="button"
          tabIndex={0}
        >
          <div className="drv-stat-val">{fmt(p.revenue)}</div>
          <div className="drv-stat-lbl">Total Billed</div>
          <div className="drv-stat-sub">{p.total_visits ?? 0} visits</div>
        </div>
        <div className="drv-stat-divider" />
        <div
          className="drv-stat drv-stat--green"
          onClick={() => setFilter('collected')}
          onKeyDown={e => handleStatKeyDown(e, 'collected')}
          role="button"
          tabIndex={0}
        >
          <div className="drv-stat-val">{fmt(p.amount_collected)}</div>
          <div className="drv-stat-lbl">Collected</div>
          <div className="drv-stat-sub">{collRate}% collection rate</div>
        </div>
        <div className="drv-stat-divider" />
        <div
          className={`drv-stat drv-stat--amber${(p.unpaid_count ?? 0) > 0 ? ' drv-stat--alert' : ''}`}
          onClick={() => setFilter('outstanding')}
          onKeyDown={e => handleStatKeyDown(e, 'outstanding')}
          role="button"
          tabIndex={0}
        >
          <div className="drv-stat-val">{fmt(p.debt_amount)}</div>
          <div className="drv-stat-lbl">Outstanding</div>
          <div className="drv-stat-sub">{p.unpaid_count ?? 0} unpaid</div>
        </div>
        <div className="drv-stat-divider" />
        <div className="drv-stat">
          <div className="drv-stat-val drv-stat-val--sm">{fmt(avgFee)}</div>
          <div className="drv-stat-lbl">Avg. Fee</div>
          <div className="drv-stat-sub">per visit</div>
        </div>
      </div>

      {/* ── Chart row ── */}
      {!txLoading && (
        <div className="drv-chart-row">
          <div className="drv-chart-card card">
            <div className="drv-chart-title">Revenue Trend</div>
            <RevenueChart txs={txs} period={period} />
            {(!txs.length || txs.length < 2) && (
              <div className="drv-chart-empty">Not enough data to render chart</div>
            )}
          </div>
          {doctorStats.length > 0 && (
            <div className="drv-doctors card">
              <div className="drv-doctors-title">By Doctor</div>
              {doctorStats.map(d => (
                <div key={d.doctor_id} className="drv-doctor-row">
                  <div>
                    <div className="drv-doctor-name">{d.doctor_name}</div>
                    <div className="drv-doctor-sub">{d.total_visits} visits · {d.paid_visits ?? 0} paid</div>
                  </div>
                  <div className="drv-doctor-val">{fmt(d.revenue_collected)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Transaction table ── */}
      <div className="drv-txn card">

        {/* Table toolbar */}
        <div className="drv-txn-toolbar">
          <div className="drv-tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`drv-tab${filter === t.key ? ' drv-tab--on' : ''}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`drv-tab-badge${t.key === 'outstanding' && t.count > 0 ? ' drv-tab-badge--warn' : ''}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {txs.length > 0 && !txLoading && (
            <button className="drv-export" onClick={() => exportCsv(txs, period, filter)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {/* Table */}
        {txLoading ? (
          <div className="drv-loading"><Spinner size={22} /></div>
        ) : txs.length === 0 ? (
          <div className="drv-empty">
            {filter === 'outstanding' ? '✅  All payments collected for this period'
              : filter === 'collected' ? 'No paid visits in this period'
              : 'No billed visits in this period'}
          </div>
        ) : (
          <div className="drv-table-wrap">
            <table className="drv-table">
              <thead>
                <tr>
                  <th className="drv-th-patient">Patient</th>
                  <th className="drv-th-date">Visit Date</th>
                  <th className="drv-th-status">Status</th>
                  <th className="drv-th-num">Fee</th>
                  <th className="drv-th-num">Paid</th>
                  <th className="drv-th-num">Due</th>
                  <th className="drv-th-act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => {
                  const due = Math.max(0, tx.consultation_fee - tx.amount_paid)
                  return (
                    <tr key={tx.id} className="drv-row">
                      <td>
                        <Link className="drv-patient-link" to={`/patients/${tx.patient_id}`}>
                          {tx.patient?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="drv-muted">{fmtDate(tx.visited_at)}</td>
                      <td>
                        <span className={`drv-pill drv-pill--${tx.payment_status}`}>
                          {tx.payment_status === 'paid' ? 'Paid' : tx.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="drv-num">{fmt(tx.consultation_fee)}</td>
                      <td className="drv-num drv-muted">{tx.amount_paid > 0 ? fmt(tx.amount_paid) : '—'}</td>
                      <td className={`drv-num${due > 0 ? ' drv-due' : ' drv-muted'}`}>{due > 0 ? fmt(due) : '—'}</td>
                      <td className="drv-act-cell">
                        <Link className="drv-view-btn" to={`/visits/${tx.id}`}>View</Link>
                        {tx.payment_status !== 'paid' && (
                          <button
                            className="drv-pay-btn"
                            onClick={() => markPaid(tx)}
                            disabled={savingId === tx.id}
                          >
                            {savingId === tx.id ? <Spinner size={10} /> : '✓ Mark Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="drv-total-row">
                  <td colSpan={3} className="drv-total-label">{txs.length} visit{txs.length !== 1 ? 's' : ''}</td>
                  <td className="drv-num drv-total-fee">{fmt(totalFee)}</td>
                  <td className="drv-num drv-total-paid">{fmt(totalPaid)}</td>
                  <td className="drv-num drv-total-due">{totalDue > 0 ? fmt(totalDue) : '—'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
