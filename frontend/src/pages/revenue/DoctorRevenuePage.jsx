import '../../styles/revenue-page.css'
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../services/api'
import { recordVisitPayment, getRevenueTransactions } from '../../services/visitService'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'

function exportCsv(txs, period, filter) {
  const BOM  = '﻿'
  const head = ['Patient', 'Visit Date', 'Status', 'Fee (₹)', 'Paid (₹)', 'Due (₹)']
  const rows = txs.map(tx => {
    const due = Math.max(0, tx.consultation_fee - tx.amount_paid)
    return [
      tx.patient_name ?? '',
      tx.visited_at ? new Date(tx.visited_at).toLocaleDateString('en-IN') : '',
      tx.payment_status,
      tx.consultation_fee.toFixed(2),
      tx.amount_paid.toFixed(2),
      due.toFixed(2),
    ]
  })
  const body = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([BOM + body], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `revenue-${filter}-${period}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const PERIODS = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all_time',   label: 'All Time' },
]

const FILTER_LABELS = {
  all:         'All Transactions',
  collected:   'Collected — Paid Visits',
  outstanding: 'Outstanding Payments',
}

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

export default function DoctorRevenuePage() {
  const [data,      setData]      = useState(null)
  const [status,    setStatus]    = useState('loading')
  const [period,    setPeriod]    = useState('this_month')
  const [filter,    setFilter]    = useState('all')
  const [txs,       setTxs]       = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [savingId,  setSavingId]  = useState(null)

  const loadStats = useCallback(() => {
    api.get('/dashboard/revenue')
      .then(({ data: r }) => { setData(r.data); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const loadTxs = useCallback((p, f) => {
    setTxLoading(true)
    getRevenueTransactions(p, f)
      .then(({ data: r }) => setTxs(r.data ?? []))
      .catch(() => toast.error('Could not load transactions.'))
      .finally(() => setTxLoading(false))
  }, [])

  useEffect(() => {
    if (status === 'done') loadTxs(period, filter)
  }, [period, filter, status, loadTxs])

  async function markPaid(tx) {
    setSavingId(tx.id)
    try {
      await recordVisitPayment(tx.id, {
        payment_status: 'paid',
        amount_paid:    tx.consultation_fee,
      })
      toast.success(`Marked paid — ${tx.patient_name}`)
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

  const p = data[period] ?? {}

  return (
    <div className="rv-page">

      {/* Period tabs */}
      <div className="rv-period-tabs">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            className={`rv-period-tab${period === key ? ' rv-period-tab--on' : ''}`}
            onClick={() => setPeriod(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat cards — clickable to filter transactions */}
      <div className="rv-cards">
        <div
          className={`rv-card rv-card--blue rv-card--clickable${filter === 'all' ? ' rv-card--active-blue' : ''}`}
          onClick={() => setFilter('all')}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setFilter('all')}
        >
          <span className="rv-card-label">Total Earned</span>
          <span className="rv-card-value">{fmtMoney(p.revenue)}</span>
          <span className="rv-card-sub">{p.total_visits ?? 0} visits</span>
          <span className="rv-card-hint">{filter === 'all' ? '● Viewing all' : 'Click to view all'}</span>
        </div>
        <div
          className={`rv-card rv-card--green rv-card--clickable${filter === 'collected' ? ' rv-card--active-green' : ''}`}
          onClick={() => setFilter('collected')}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setFilter('collected')}
        >
          <span className="rv-card-label">Collected</span>
          <span className="rv-card-value">{fmtMoney(p.amount_collected)}</span>
          <span className="rv-card-sub">{p.paid_visits ?? 0} paid visits</span>
          <span className="rv-card-hint">{filter === 'collected' ? '● Viewing paid' : 'Click to view paid'}</span>
        </div>
        <div
          className={`rv-card rv-card--amber rv-card--clickable${filter === 'outstanding' ? ' rv-card--active-amber' : ''}`}
          onClick={() => setFilter('outstanding')}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setFilter('outstanding')}
        >
          <span className="rv-card-label">Outstanding</span>
          <span className="rv-card-value">{fmtMoney(p.debt_amount)}</span>
          <span className="rv-card-sub">{p.unpaid_count ?? 0} unpaid</span>
          <span className="rv-card-hint">{filter === 'outstanding' ? '● Viewing unpaid' : 'Click to view unpaid'}</span>
        </div>
        {period === 'all_time' && (
          <div className="rv-card">
            <span className="rv-card-label">Avg. Fee</span>
            <span className="rv-card-value">{fmtMoney(p.avg_fee)}</span>
            <span className="rv-card-sub">per visit</span>
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="card rv-debt-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="rv-debt-header">
          <span className="rv-debt-title">{FILTER_LABELS[filter]}</span>
          {txLoading
            ? <Spinner size={14} />
            : <span className={`rv-debt-count${filter === 'outstanding' ? '' : ' rv-debt-count--neutral'}`}>
                {txs.length}
              </span>
          }
          {txs.length > 0 && !txLoading && (
            <button className="rv-export-btn" onClick={() => exportCsv(txs, period, filter)} title="Export CSV">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {txLoading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <Spinner size={24} />
          </div>
        ) : txs.length === 0 ? (
          <div className="rv-empty-state">
            {filter === 'outstanding'
              ? 'No outstanding payments — all clear!'
              : filter === 'collected'
              ? 'No collected payments for this period.'
              : 'No billed visits for this period.'}
          </div>
        ) : (
          <div className="rv-debt-table-wrap">
            <table className="rv-debt-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Visit Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Fee</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => {
                  const due      = Math.max(0, tx.consultation_fee - tx.amount_paid)
                  const isSaving = savingId === tx.id
                  return (
                    <tr key={tx.id} className="rv-debt-row">
                      <td>
                        <Link className="rv-debt-patient" to={`/patients/${tx.patient_id}`}>
                          {tx.patient_name ?? '—'}
                        </Link>
                      </td>
                      <td className="rv-debt-muted">{fmtDate(tx.visited_at)}</td>
                      <td>
                        <span className={`rv-status-pill rv-status-pill--${tx.payment_status}`}>
                          {tx.payment_status === 'paid' ? 'Paid' : tx.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(tx.consultation_fee)}</td>
                      <td style={{ textAlign: 'right' }} className="rv-debt-muted">{fmtMoney(tx.amount_paid)}</td>
                      <td style={{ textAlign: 'right' }} className={due > 0 ? 'rv-debt-due' : 'rv-debt-muted'}>
                        {fmtMoney(due)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <Link className="rv-view-btn" to={`/visits/${tx.id}`}>View</Link>
                          {tx.payment_status !== 'paid' && (
                            <button
                              className="rv-mark-paid-btn"
                              onClick={() => markPaid(tx)}
                              disabled={isSaving}
                            >
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
                  <td colSpan={3} style={{ fontWeight: 600, fontSize: '12px', color: 'var(--clr-text-muted)' }}>
                    Total ({txs.length})
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtMoney(txs.reduce((s, t) => s + t.consultation_fee, 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                    {fmtMoney(txs.reduce((s, t) => s + t.amount_paid, 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                    {fmtMoney(txs.reduce((s, t) => s + Math.max(0, t.consultation_fee - t.amount_paid), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {txs.length === 100 && (
          <p className="rv-debt-hint">Showing latest 100 transactions.</p>
        )}
      </div>
    </div>
  )
}
