import '../../styles/revenue-page.css'
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'
import {
  getPharmacyRevenue,
  recordPrescriptionPayment,
  getPharmacyRevenueTransactions,
} from '../../services/pharmacyService'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'

async function exportCsv(txs, period, filter) {
  const BOM  = '﻿'
  const head = ['Patient', 'Completed', 'Status', 'Bill (Rs)', 'Paid (Rs)', 'Due (Rs)']
  const rows = txs.map(tx => {
    const due = Math.max(0, tx.total_amount - tx.amount_paid)
    return [
      tx.patient_name ?? '',
      tx.completed_at ? new Date(tx.completed_at).toLocaleDateString('en-IN') : '',
      tx.payment_status,
      tx.total_amount.toFixed(2),
      tx.amount_paid.toFixed(2),
      due.toFixed(2),
    ]
  })
  const body = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const filename = `pharmacy-revenue-${filter}-${period}.csv`
  try {
    const saved = await invoke('write_text_to_downloads', { content: BOM + body, filename })
    toast.success(`Exported to Downloads: ${saved}`)
  } catch {
    toast.error('Export failed — could not write file.')
  }
}

const PERIODS = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all_time',   label: 'All Time' },
]


function fmtMoney(n) {
  return '₹' + parseFloat(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function RingChart({ value, total, color, size = 96, sw = 11 }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const cx = size / 2, cy = size / 2
  const fs = Math.round(size * 0.135)
  const fsSub = Math.round(size * 0.083)
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--clr-border)" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={fs} fontWeight="700"
        style={{ fill: 'var(--clr-text)' }}>{Math.round(pct)}%</text>
      <text x={cx} y={cy + fs * 0.9} textAnchor="middle" fontSize={fsSub}
        style={{ fill: 'var(--clr-text-muted)' }}>rate</text>
    </svg>
  )
}

function BarChart({ bars, h = 80 }) {
  const max = Math.max(...bars.map(b => b.v), 1)
  const W = 40, G = 14
  const tw = bars.length * (W + G) - G
  function fmtBar(v) {
    if (v === 0) return '—'
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
    if (v >= 1000) return `₹${Math.round(v / 1000)}k`
    return `₹${Math.round(v)}`
  }
  return (
    <svg width={tw} height={h + 44} style={{ overflow: 'visible', display: 'block' }}>
      {bars.map((b, i) => {
        const bh = b.v > 0 ? Math.max(6, (b.v / max) * h) : 4
        const x = i * (W + G)
        const y = h - bh
        return (
          <g key={i}>
            <rect x={x} y={y} width={W} height={bh} rx={5} fill={b.c} opacity={b.dim ? .28 : .88} />
            <text x={x + W / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700"
              style={{ fill: b.v > 0 ? b.c : 'var(--clr-text-muted)', opacity: b.dim ? .5 : 1 }}>{fmtBar(b.v)}</text>
            <text x={x + W / 2} y={h + 16} textAnchor="middle" fontSize="10.5"
              style={{ fill: 'var(--clr-text-muted)' }}>{b.l}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DotMatrix({ paid, partial, unpaid }) {
  const total = paid + partial + unpaid
  if (total === 0) return null
  const cols = 10
  const dots = []
  let idx = 0
  for (let i = 0; i < paid;    i++, idx++) dots.push({ type: 'paid',    i: idx })
  for (let i = 0; i < partial; i++, idx++) dots.push({ type: 'partial', i: idx })
  for (let i = 0; i < unpaid;  i++, idx++) dots.push({ type: 'unpaid',  i: idx })
  const rows = Math.ceil(total / cols)
  const S = 11, G = 3
  const colors = { paid: '#10b981', partial: '#f59e0b', unpaid: '#ef4444' }
  return (
    <svg width={cols * (S + G) - G} height={rows * (S + G) - G} style={{ display: 'block' }}>
      {dots.map(d => {
        const col = d.i % cols
        const row = Math.floor(d.i / cols)
        return (
          <rect key={d.i} x={col * (S + G)} y={row * (S + G)} width={S} height={S} rx={3}
            fill={colors[d.type]} opacity={.85} />
        )
      })}
    </svg>
  )
}

export default function PharmacyRevenuePage() {
  const [data,      setData]      = useState(null)
  const [status,    setStatus]    = useState('loading')
  const [period,    setPeriod]    = useState('this_month')
  const [filter,    setFilter]    = useState('all')
  const [txs,       setTxs]       = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [savingId,  setSavingId]  = useState(null)

  const loadStats = useCallback(() => {
    getPharmacyRevenue()
      .then(({ data: r }) => { setData(r.data); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const loadTxs = useCallback((p, f) => {
    setTxLoading(true)
    getPharmacyRevenueTransactions(p, f)
      .then(({ data: r }) => setTxs(r.data ?? []))
      .catch(() => toast.error('Could not load transactions.'))
      .finally(() => setTxLoading(false))
  }, [])

  useEffect(() => {
    if (status === 'done') loadTxs(period, filter)
  }, [period, filter, status, loadTxs])

  async function markPaid(rx) {
    setSavingId(rx.id)
    try {
      await recordPrescriptionPayment(rx.id, {
        payment_status: 'paid',
        amount_paid:    rx.total_amount,
      })
      toast.success(`Marked paid — ${rx.patient_name}`)
      loadStats()
      loadTxs(period, filter)
    } catch {
      toast.error('Could not update payment — try again.')
    } finally {
      setSavingId(null)
    }
  }

  if (status === 'loading') return <PageLoader />
  if (status === 'error') return <div className="card state-panel">Could not load revenue data.</div>

  const p           = data[period] ?? {}
  const outstanding = Math.max(0, (p.revenue ?? 0) - (p.amount_collected ?? 0))
  const collRate    = p.revenue > 0 ? Math.round(((p.amount_collected ?? 0) / p.revenue) * 100) : 0

  const paidCount    = txs.filter(t => t.payment_status === 'paid').length
  const partialCount = txs.filter(t => t.payment_status === 'partial').length
  const unpaidCount  = txs.filter(t => t.payment_status === 'unpaid').length

  const TX_FILTERS = [
    { key: 'all',         label: 'All' },
    { key: 'collected',   label: 'Paid' },
    { key: 'outstanding', label: 'Unpaid' },
  ]

  return (
    <div className="rv2-page">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="rv2-hdr">
        <div className="rv2-hdr-left">
          <h2 className="rv2-hdr-title">Pharmacy Revenue</h2>
          <p className="rv2-hdr-sub">Dispensing revenue &amp; payment overview</p>
        </div>
        <div className="rv2-period-seg">
          {PERIODS.map(({ key, label }) => (
            <button key={key}
              className={`rv2-period-btn${period === key ? ' rv2-period-btn--on' : ''}`}
              onClick={() => setPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero metrics ──────────────────────────────────────────────── */}
      <div className="rv2-metrics">

        {/* Total Revenue */}
        <div className={`rv2-metric rv2-metric--teal${filter === 'all' ? ' rv2-metric--active' : ''}`}
          onClick={() => setFilter('all')} role="button" tabIndex={0}>
          <div className="rv2-metric-top">
            <span className="rv2-metric-label">Total Revenue</span>
            <span className="rv2-metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </span>
          </div>
          <div className="rv2-metric-value">{fmtMoney(p.revenue)}</div>
          <div className="rv2-metric-foot">
            {p.total_dispensed ?? 0} prescriptions dispensed
          </div>
        </div>

        {/* Collected */}
        <div className={`rv2-metric rv2-metric--green${filter === 'collected' ? ' rv2-metric--active' : ''}`}
          onClick={() => setFilter('collected')} role="button" tabIndex={0}>
          <div className="rv2-metric-top">
            <span className="rv2-metric-label">Collected</span>
            <span className="rv2-metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          </div>
          <div className="rv2-metric-value">{fmtMoney(p.amount_collected)}</div>
          <div className="rv2-metric-foot">
            <div className="rv2-bar-track">
              <div className="rv2-bar-fill rv2-bar-fill--green" style={{ width: `${collRate}%` }} />
            </div>
            {p.paid_count ?? 0} paid bills · {collRate}% collection rate
          </div>
        </div>

        {/* Outstanding */}
        <div className={`rv2-metric rv2-metric--amber${filter === 'outstanding' ? ' rv2-metric--active' : ''}`}
          onClick={() => setFilter('outstanding')} role="button" tabIndex={0}>
          <div className="rv2-metric-top">
            <span className="rv2-metric-label">Outstanding</span>
            <span className="rv2-metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
          </div>
          <div className="rv2-metric-value">{fmtMoney(outstanding)}</div>
          <div className="rv2-metric-foot">
            {p.unpaid_count ?? 0} unpaid bills pending payment
          </div>
        </div>
      </div>

      {/* ── Revenue report — 3 columns ────────────────────────────────── */}
      <div className="rv2-report">

        {/* Collection rate donut */}
        <div className="rv2-panel">
          <div className="rv2-panel-title">Collection Rate</div>
          <div className="rv2-panel-row">
            <RingChart value={p.amount_collected ?? 0} total={p.revenue ?? 0} color="#10b981" size={96} sw={11} />
            <div className="rv2-legend">
              <div className="rv2-legend-item">
                <span className="rv2-legend-dot" style={{ background: '#10b981' }} />
                <span className="rv2-legend-label">Collected</span>
                <span className="rv2-legend-value">{fmtMoney(p.amount_collected)}</span>
              </div>
              <div className="rv2-legend-item">
                <span className="rv2-legend-dot" style={{ background: '#ef4444' }} />
                <span className="rv2-legend-label">Outstanding</span>
                <span className="rv2-legend-value">{fmtMoney(outstanding)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--clr-text-muted)', lineHeight: 1.5 }}>
                {p.paid_count ?? 0} paid · {p.unpaid_count ?? 0} unpaid
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by period bar chart */}
        <div className="rv2-panel">
          <div className="rv2-panel-title">Revenue by Period</div>
          <div style={{ overflowX: 'auto', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <BarChart bars={[
              { l: 'Today',    v: data.today?.revenue      ?? 0, c: '#6366f1', dim: period !== 'today' },
              { l: 'Week',     v: data.this_week?.revenue  ?? 0, c: '#0d9488', dim: period !== 'this_week' },
              { l: 'Month',    v: data.this_month?.revenue ?? 0, c: '#10b981', dim: period !== 'this_month' },
              { l: 'All Time', v: data.all_time?.revenue   ?? 0, c: '#f59e0b', dim: period !== 'all_time' },
            ]} h={80} />
          </div>
        </div>

        {/* Payment breakdown dot matrix */}
        <div className="rv2-panel">
          <div className="rv2-panel-title">Payment Breakdown · {txs.length} rx</div>
          {txs.length > 0 ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <DotMatrix paid={paidCount} partial={partialCount} unpaid={unpaidCount} />
              </div>
              <div className="rv2-dot-legend">
                {[
                  { label: 'Paid',    count: paidCount,    color: '#10b981' },
                  { label: 'Partial', count: partialCount, color: '#f59e0b' },
                  { label: 'Unpaid',  count: unpaidCount,  color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} className="rv2-dot-legend-item">
                    <span className="rv2-dot-legend-swatch" style={{ background: s.color }} />
                    <span className="rv2-dot-legend-lbl">{s.label}</span>
                    <span className="rv2-dot-legend-cnt">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--clr-text-muted)' }}>
              No transactions this period
            </div>
          )}
        </div>
      </div>

      {/* ── Transactions ──────────────────────────────────────────────── */}
      <div className="rv2-txn">

        {/* Filter + export header */}
        <div className="rv2-txn-hdr">
          <div className="rv2-txn-seg">
            {TX_FILTERS.map(f => (
              <button key={f.key}
                className={`rv2-txn-tab${filter === f.key ? ' rv2-txn-tab--on' : ''}`}
                onClick={() => setFilter(f.key)}>
                {f.label}
                {filter === f.key && !txLoading && (
                  <span className="rv2-txn-tab-badge">{txs.length}</span>
                )}
              </button>
            ))}
          </div>
          {txLoading && <Spinner size={14} />}
          {txs.length > 0 && !txLoading && (
            <button className="rv2-export" onClick={() => exportCsv(txs, period, filter)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {/* Table body */}
        {txLoading ? (
          <div className="rv2-loading"><Spinner size={24} /></div>
        ) : txs.length === 0 ? (
          <div className="rv2-empty">
            {filter === 'outstanding'
              ? '✓ No outstanding bills — all clear!'
              : filter === 'collected'
              ? 'No paid bills for this period.'
              : 'No completed prescriptions for this period.'}
          </div>
        ) : (
          <div className="rv-debt-table-wrap">
            <table className="rv-debt-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Completed</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Bill</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => {
                  const due      = Math.max(0, tx.total_amount - tx.amount_paid)
                  const isSaving = savingId === tx.id
                  return (
                    <tr key={tx.id} className="rv-debt-row">
                      <td>
                        <Link className="rv-debt-patient" to={`/pharmacy/prescriptions/${tx.id}`}>
                          {tx.patient_name ?? '—'}
                        </Link>
                      </td>
                      <td className="rv-debt-muted">{fmtDate(tx.completed_at)}</td>
                      <td>
                        <span className={`rv-status-pill rv-status-pill--${tx.payment_status}`}>
                          {tx.payment_status === 'paid' ? 'Paid' : tx.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(tx.total_amount)}</td>
                      <td style={{ textAlign: 'right' }} className="rv-debt-muted">{fmtMoney(tx.amount_paid)}</td>
                      <td style={{ textAlign: 'right' }} className={due > 0 ? 'rv-debt-due' : 'rv-debt-muted'}>
                        {fmtMoney(due)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Link className="rv-view-btn" to={`/pharmacy/prescriptions/${tx.id}`}>View</Link>
                          {tx.payment_status !== 'paid' && (
                            <button className="rv-mark-paid-btn" onClick={() => markPaid(tx)} disabled={isSaving}>
                              {isSaving ? <Spinner size={11} /> : 'Mark Paid'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="rv-totals-row">
                  <td colSpan={3} style={{ fontWeight: 600, fontSize: 12, color: 'var(--clr-text-muted)' }}>
                    Total ({txs.length})
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtMoney(txs.reduce((s, t) => s + t.total_amount, 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                    {fmtMoney(txs.reduce((s, t) => s + t.amount_paid, 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                    {fmtMoney(txs.reduce((s, t) => s + Math.max(0, t.total_amount - t.amount_paid), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {txs.length === 100 && (
          <p className="rv-debt-hint">Showing latest 100 prescriptions.</p>
        )}
      </div>
    </div>
  )
}
