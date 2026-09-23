import '../../styles/pharmacy-pages.css'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getPharmacyHistory, getPharmacyLiveCounts, getPharmacyPrescription } from '../../services/pharmacyService'
import { createPharmacyReturn } from '../../services/pharmacyReturnService'
import Spinner from '../../components/ui/Spinner'
import { fmtTime, fmtDateShort as fmtDate } from '../../lib/dateUtils'

const POLL_MS = 120_000

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

function isToday(iso) {
  if (!iso) return false
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  const d = new Date(utc), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function isYesterday(iso) {
  if (!iso) return false
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  const d = new Date(utc)
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

/* ── Icons ──────────────────────────────────────────────────────────────── */

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

function IconReturn() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.7" />
    </svg>
  )
}

const PAY_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

function PayBadge({ status }) {
  return (
    <span className={`pharma-pay-badge pharma-pay-badge--${status ?? 'unpaid'}`}>
      {PAY_LABEL[status] ?? 'Unpaid'}
    </span>
  )
}

/* ── Return Modal ─────────────────────────────────────────────────────────── */

function ReturnModal({ rx, detail, loadingDetail, items, setItems, reason, setReason, saving, error, onClose, onConfirm }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const selectedItems = items.filter(i => i.selected && i.qty > 0)
  const total = selectedItems.reduce((s, i) => s + i.unit_price * i.qty, 0)

  function toggleItem(idx) {
    setItems(prev => prev.map((item, j) => j === idx ? { ...item, selected: !item.selected } : item))
  }

  function changeQty(idx, delta) {
    setItems(prev => prev.map((item, j) => {
      if (j !== idx) return item
      return { ...item, qty: Math.max(1, item.qty + delta) }
    }))
  }

  return (
    <div className="phret-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="phret-modal">
        <div className="phret-modal-hdr">
          <div className="phret-modal-hdr-text">
            <div className="phret-modal-title">Process Return</div>
            {rx && <div className="phret-modal-sub">{rx.patient?.name}</div>}
          </div>
          <button className="phret-close" onClick={onClose} title="Close">✕</button>
        </div>

        {loadingDetail && (
          <div className="phret-loading">
            <Spinner size={20} />
            <span>Loading prescription details…</span>
          </div>
        )}

        {!loadingDetail && error && !detail && (
          <div className="phret-error-block">{error}</div>
        )}

        {!loadingDetail && detail && (
          <div className="phret-body">
            {items.length === 0 ? (
              <div className="phret-empty">No medicine items found on this prescription.</div>
            ) : (
              <>
                <div className="phret-section-label">Select items to return</div>
                <div className="phret-items">
                  {items.map((item, idx) => (
                    <div key={idx} className={`phret-item${item.selected ? '' : ' phret-item--off'}`}>
                      <input
                        type="checkbox"
                        className="phret-chk"
                        checked={item.selected}
                        onChange={() => toggleItem(idx)}
                      />
                      <span className="phret-item-name">{item.medicine_name}</span>
                      <span className="phret-item-price">
                        {item.unit_price > 0
                          ? '₹' + item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'}
                      </span>
                      <div className={`phret-qty-ctrl${!item.selected ? ' phret-qty-ctrl--off' : ''}`}>
                        <button type="button" className="phret-qty-btn"
                          onClick={() => changeQty(idx, -1)} disabled={!item.selected}>−</button>
                        <span className="phret-qty-val">{item.qty}</span>
                        <button type="button" className="phret-qty-btn"
                          onClick={() => changeQty(idx, 1)} disabled={!item.selected}>+</button>
                      </div>
                      <span className="phret-item-line-total">
                        {item.selected && item.unit_price > 0
                          ? '₹' + (item.unit_price * item.qty).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="phret-reason-wrap">
                  <label className="phret-section-label">
                    Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    className="phret-reason"
                    placeholder="e.g. Patient allergic reaction, wrong medicine dispensed, excess stock…"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                  />
                </div>

                {error && <div className="phret-error-block">{error}</div>}

                {total > 0 && (
                  <div className="phret-total-row">
                    <span className="phret-total-label">Credit amount</span>
                    <span className="phret-total-val">
                      ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="phret-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="phret-confirm-btn"
            onClick={onConfirm}
            disabled={saving || loadingDetail || !detail || selectedItems.length === 0}
          >
            {saving ? 'Processing…' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── History card ────────────────────────────────────────────────────────── */

function HistoryCard({ rx, onInvoice, onDetails, onReturn, hasReturn }) {
  const total = rx.total_amount ?? 0
  return (
    <div className="pharma-hcard">
      <div className="pharma-hcard-avatar">{(rx.patient.name?.[0] ?? '?').toUpperCase()}</div>

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
        <div className="pharma-hcard-meta">
          <PayBadge status={rx.payment_status} />
          {hasReturn && <span className="phret-history-badge">Returned</span>}
          {total > 0 && (
            <span className="pharma-hcard-amount">
              {'₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {rx.items?.length > 0 && (
            <span className="pharma-med-pill">{rx.items.length} med{rx.items.length !== 1 ? 's' : ''}</span>
          )}
          <div className="pharma-hcard-time">{fmtTime(rx.completed_at)}</div>
          <span className="pharma-done-tick"><IconCheck /></span>
        </div>

        <div className="pharma-hcard-actions">
          <button className="pharma-hcard-btn pharma-hcard-btn--invoice" onClick={onInvoice}>
            <IconReceipt />
            View Invoice
          </button>
          <button className="pharma-hcard-btn pharma-hcard-btn--return" onClick={onReturn} title="Process a return / credit note">
            <IconReturn />
            Return
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

function HistoryGroup({ label, items, navigate, showDate, onReturn, returnedIds }) {
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
              hasReturn={returnedIds.has(rx.id)}
              onInvoice={() => navigate(`/pharmacy/prescriptions/${rx.id}/invoice`)}
              onDetails={() => navigate(`/pharmacy/prescriptions/${rx.id}`)}
              onReturn={() => onReturn(rx)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function PharmacyHistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [status, setStatus]   = useState('loading')
  const [counts,  setCounts]  = useState({ dispensing: 0, pending: 0, today_done: 0 })

  const [inputVal, setInputVal] = useState('')
  const [q, setQ]               = useState('')

  useEffect(() => {
    const t = setTimeout(() => setQ(inputVal.trim()), 400)
    return () => clearTimeout(t)
  }, [inputVal])

  const load = useCallback((silent = false) => {
    if (!silent) setStatus('loading')
    getPharmacyHistory(q)
      .then(({ data }) => {
        setHistory(data.data ?? [])
        setStatus('done')
      })
      .catch(() => setStatus(prev => prev === 'loading' ? 'error' : prev))
    getPharmacyLiveCounts()
      .then(({ data }) => setCounts(data))
      .catch(() => {})
  }, [q])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  /* ── Return modal state ──────────────────────────────────────────────── */
  const [returnRx,       setReturnRx]       = useState(null)
  const [returnDetail,   setReturnDetail]   = useState(null)
  const [loadingDetail,  setLoadingDetail]  = useState(false)
  const [returnItems,    setReturnItems]    = useState([])
  const [returnReason,   setReturnReason]   = useState('')
  const [returning,      setReturning]      = useState(false)
  const [returnError,    setReturnError]    = useState(null)
  const [returnedIds,    setReturnedIds]    = useState(new Set())

  async function openReturn(rx) {
    setReturnRx(rx)
    setReturnDetail(null)
    setReturnError(null)
    setReturnReason('')
    setReturnItems([])
    setLoadingDetail(true)
    try {
      const { data } = await getPharmacyPrescription(rx.id)
      setReturnDetail(data)
      setReturnItems(
        (data.items ?? []).map(item => ({
          medicine_name: item.medicine_name,
          unit_price: parseFloat(item.unit_price) || 0,
          qty: 1,
          selected: true,
        }))
      )
    } catch {
      setReturnError('Could not load prescription details — please try again.')
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeReturn() {
    setReturnRx(null)
    setReturnDetail(null)
    setReturnItems([])
    setReturnReason('')
    setReturnError(null)
    setReturning(false)
  }

  async function handleConfirmReturn() {
    const selected = returnItems.filter(i => i.selected && i.qty > 0)
    if (!selected.length) {
      setReturnError('Select at least one item to return.')
      return
    }
    if (!returnReason.trim()) {
      setReturnError('Please enter a reason for the return.')
      return
    }
    setReturning(true)
    setReturnError(null)
    try {
      await createPharmacyReturn(
        returnRx.id,
        selected.map(i => ({ medicine_name: i.medicine_name, quantity: i.qty, unit_price: i.unit_price })),
        returnReason.trim(),
        null,
      )
      const credit = selected.reduce((s, i) => s + i.unit_price * i.qty, 0)
      toast.success(
        credit > 0
          ? `Return processed — ₹${credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} credit note`
          : 'Return processed successfully'
      )
      setReturnedIds(prev => new Set([...prev, returnRx.id]))
      closeReturn()
    } catch (err) {
      setReturnError(typeof err === 'string' ? err : 'Return failed — please try again.')
    } finally {
      setReturning(false)
    }
  }

  const { today, yesterday, older } = groupHistory(history)
  const isSearching = inputVal !== q

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

      {/* ── Live counters ───────────────────────────────────────────────── */}
      <div className="phist-counters">
        <div className="phist-counter phist-counter--done">
          <span className="phist-counter-val">{counts.today_done}</span>
          <span className="phist-counter-lbl">Done Today</span>
        </div>
        <div className="phist-counter phist-counter--dispensing">
          <span className="phist-counter-val">{counts.dispensing}</span>
          <span className="phist-counter-lbl">Dispensing</span>
        </div>
        <div className="phist-counter phist-counter--pending">
          <span className="phist-counter-val">{counts.pending}</span>
          <span className="phist-counter-lbl">Pending</span>
        </div>
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

      {status === 'loading' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size={26} />
        </div>
      )}

      {status === 'error' && (
        <div className="card state-panel">
          <p>Could not load history — check your connection.</p>
          <button className="btn-link" style={{ marginTop: 'var(--space-sm)' }} onClick={() => load()}>
            Try again
          </button>
        </div>
      )}

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

      {status === 'done' && history.length > 0 && (
        <div className="pharma-history-body">
          {q ? (
            <HistoryGroup
              label={`${history.length} result${history.length !== 1 ? 's' : ''}`}
              items={history}
              navigate={navigate}
              showDate
              onReturn={openReturn}
              returnedIds={returnedIds}
            />
          ) : (
            <>
              {today.length > 0 && (
                <HistoryGroup
                  label={`Today — ${today.length} dispensed`}
                  items={today}
                  navigate={navigate}
                  onReturn={openReturn}
                  returnedIds={returnedIds}
                />
              )}
              {yesterday.length > 0 && (
                <HistoryGroup
                  label={`Yesterday — ${yesterday.length}`}
                  items={yesterday}
                  navigate={navigate}
                  onReturn={openReturn}
                  returnedIds={returnedIds}
                />
              )}
              {older.length > 0 && (
                <HistoryGroup
                  label="Older"
                  items={older}
                  navigate={navigate}
                  showDate
                  onReturn={openReturn}
                  returnedIds={returnedIds}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Return modal ────────────────────────────────────────────────── */}
      {returnRx && (
        <ReturnModal
          rx={returnRx}
          detail={returnDetail}
          loadingDetail={loadingDetail}
          items={returnItems}
          setItems={setReturnItems}
          reason={returnReason}
          setReason={setReturnReason}
          saving={returning}
          error={returnError}
          onClose={closeReturn}
          onConfirm={handleConfirmReturn}
        />
      )}
    </div>
  )
}
