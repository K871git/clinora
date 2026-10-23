import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { listOpdRegister } from '../../services/visitService'
import '../../styles/opd.css'

function todayStr() { return new Date().toISOString().split('T')[0] }

function fmtTime(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateFull(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function OpdSort({ col, sortCol, sortDir }) {
  const active = sortCol === col
  const up   = !active || sortDir === 'asc'
  const down = !active || sortDir === 'desc'
  return (
    <span className={`opd-sort${active ? ' opd-sort--active' : ''}`} aria-hidden="true">
      {up   && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 4L3.5 1L6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'desc' ? 0.3 : 1}/></svg>}
      {down && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 1L3.5 4L6 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'asc' ? 0.3 : 1}/></svg>}
    </span>
  )
}

const PAY_COLOR = { paid: 'var(--clr-success)', partial: 'var(--clr-warning)', unpaid: 'var(--clr-danger)' }
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#0d9488']
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length] }

export default function OPDRegisterPage() {
  const navigate = useNavigate()
  const [date,    setDate]    = useState(todayStr())
  const [visits,  setVisits]  = useState([])
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return visits
    return [...visits].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = (a.patient?.name ?? '').localeCompare(b.patient?.name ?? '')
      else if (sortCol === 'time') cmp = new Date(a.visited_at ?? 0) - new Date(b.visited_at ?? 0)
      else if (sortCol === 'status') cmp = (a.status ?? '').localeCompare(b.status ?? '')
      else if (sortCol === 'fee') cmp = (a.consultation_fee || 0) - (b.consultation_fee || 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [visits, sortCol, sortDir])

  const load = useCallback(() => {
    setLoading(true)
    listOpdRegister(date)
      .then(setVisits)
      .catch(() => toast.error('Could not load OPD register'))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(() => { load() }, [load])

  function pickDate(offset) {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(d.toISOString().split('T')[0])
  }

  const isToday    = date === todayStr()
  const totalFee   = visits.reduce((s, v) => s + (v.consultation_fee || 0), 0)
  const openCount  = visits.filter(v => v.status === 'open').length
  const doneCount  = visits.filter(v => v.status === 'completed').length
  const paidFee    = visits.filter(v => v.payment_status === 'paid').reduce((s, v) => s + (v.consultation_fee || 0), 0)

  return (
    <div className="opd-page">

      {/* Header */}
      <div className="opd-header">
        <div>
          <h1 className="opd-title">OPD Register</h1>
          <div className="opd-date-label">{fmtDateFull(date)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {visits.length > 0 && (
            <button
              className="btn-secondary opd-print-btn"
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Summary
            </button>
          )}
          <button className="btn-primary opd-new-btn" onClick={() => navigate('/patients')}>
            + New Visit
          </button>
        </div>
      </div>

      {/* Date navigator */}
      <div className="opd-date-nav">
        <button className="opd-nav-btn" onClick={() => pickDate(-1)}>‹ Prev</button>
        <input type="date" className="opd-date-input" value={date} onChange={e => setDate(e.target.value)} />
        <button className="opd-nav-btn" onClick={() => pickDate(1)} disabled={isToday}>Next ›</button>
        {!isToday && (
          <button className="opd-nav-btn opd-nav-btn--today" onClick={() => setDate(todayStr())}>Today</button>
        )}
      </div>

      {/* Stats bar */}
      {visits.length > 0 && (
        <div className="opd-stats">
          <div className="opd-stat"><span className="opd-stat-val">{visits.length}</span><span className="opd-stat-lbl">Total</span></div>
          <div className="opd-stat opd-stat--open"><span className="opd-stat-val">{openCount}</span><span className="opd-stat-lbl">Open</span></div>
          <div className="opd-stat opd-stat--done"><span className="opd-stat-val">{doneCount}</span><span className="opd-stat-lbl">Done</span></div>
          <div className="opd-stat opd-stat--fee"><span className="opd-stat-val">₹{totalFee.toLocaleString('en-IN')}</span><span className="opd-stat-lbl">Billed</span></div>
          <div className="opd-stat opd-stat--paid"><span className="opd-stat-val">₹{paidFee.toLocaleString('en-IN')}</span><span className="opd-stat-lbl">Collected</span></div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="opd-empty">Loading…</div>
      ) : visits.length === 0 ? (
        <div className="opd-empty">
          No visits recorded for {isToday ? 'today' : fmtDateShort(date)}.
          {isToday && (
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/patients')}>
              Start First Visit
            </button>
          )}
        </div>
      ) : (
        <div className="opd-table-wrap">
          <table className="opd-table">
            <thead>
              <tr>
                <th className="opd-th-num">#</th>
                <th className="opd-th--sortable" onClick={() => toggleSort('name')}>
                  Patient <OpdSort col="name" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="opd-th-time opd-th--sortable" onClick={() => toggleSort('time')}>
                  Time <OpdSort col="time" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="opd-th-age">Age / Sex</th>
                <th>Notes / Complaint</th>
                <th className="opd-th-status opd-th--sortable" onClick={() => toggleSort('status')}>
                  Status <OpdSort col="status" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="opd-th-fee opd-th--sortable" onClick={() => toggleSort('fee')}>
                  Fee <OpdSort col="fee" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="opd-th-pay">Payment</th>
                <th className="opd-th-fu">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, idx) => {
                const name = v.patient?.name ?? '—'
                const isOpen = v.status === 'open'
                return (
                  <tr key={v.id} className="opd-tr" onClick={() => navigate(`/visits/${v.id}`)}>
                    <td className="opd-td-num">{idx + 1}</td>
                    <td className="opd-td-name">
                      <div className="opd-avatar" style={{ background: avatarColor(name) }}>{name[0]?.toUpperCase()}</div>
                      <div>
                        <div className="opd-patient-name">{name}</div>
                        {v.patient?.mobile && <div className="opd-patient-mob">{v.patient.mobile}</div>}
                      </div>
                    </td>
                    <td className="opd-td-time">{fmtTime(v.visited_at)}</td>
                    <td className="opd-td-age">
                      {v.patient?.age ? `${v.patient.age}y` : '—'}
                      {v.patient?.gender && <span className="opd-gender"> {v.patient.gender[0].toUpperCase()}</span>}
                    </td>
                    <td className="opd-td-notes">
                      {v.consultation_notes
                        ? <span title={v.consultation_notes.length > 60 ? v.consultation_notes : undefined}>
                            {v.consultation_notes.length > 60 ? v.consultation_notes.slice(0, 58) + '…' : v.consultation_notes}
                          </span>
                        : <span className="opd-muted">—</span>}
                    </td>
                    <td className="opd-td-status">
                      <span className={`opd-status-pill opd-status-pill--${v.status}`}>
                        {isOpen ? 'Open' : 'Done'}
                      </span>
                    </td>
                    <td className="opd-td-fee">
                      {v.consultation_fee > 0 ? `₹${v.consultation_fee.toLocaleString('en-IN')}` : <span className="opd-muted">—</span>}
                    </td>
                    <td className="opd-td-pay">
                      {v.consultation_fee > 0
                        ? <span className="opd-pay-dot" style={{ color: PAY_COLOR[v.payment_status] ?? PAY_COLOR.unpaid }}>
                            ● {v.payment_status}
                          </span>
                        : <span className="opd-muted">—</span>}
                    </td>
                    <td className="opd-td-fu">
                      {v.followup_date
                        ? <span className="opd-fu-badge">{fmtDateShort(v.followup_date)}</span>
                        : <span className="opd-muted">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
