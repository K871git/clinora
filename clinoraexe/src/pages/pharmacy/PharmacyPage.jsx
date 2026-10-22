import '../../styles/pharmacy-pages.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSessionState } from '../../hooks/useSessionState'
import {
  getPharmacyPrescriptions, getPharmacyStats,
  getPharmacyPrescription,
  startDispensingPharmacyPrescription,
  completePharmacyPrescription,
  recordPrescriptionPayment,
  savePharmacistNotes,
} from '../../services/pharmacyService'
import { getStockAlerts, getMedicines } from '../../services/medicineService'
import { getStockItems } from '../../services/stockItemService'
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
      {/* Col 1: avatar */}
      <div className="pharma-qcard-avatar">{(rx.patient?.name?.[0] ?? '?').toUpperCase()}</div>

      {/* Col 2: patient name */}
      <div className="pharma-qcard-patient">
        <div className="pharma-qcard-name">{rx.patient?.name}</div>
      </div>

      {/* Col 3: doctor · medicines (fills center) */}
      <div className="pharma-qcard-meta">
        {rx.doctor && <span className="pharma-qcard-doc">{doctorLabel(rx.doctor.name)}</span>}
        {rx.doctor && rx.items?.length > 0 && <span className="pharma-qcard-sep"> · </span>}
        {rx.items?.length > 0 && (
          <span className="pharma-qcard-meds">
            {rx.items.slice(0, 3).map(i => i.medicine_name).join(', ')}
            {rx.items.length > 3 && <span className="pharma-qcard-meds-more"> +{rx.items.length - 3}</span>}
          </span>
        )}
      </div>

      {/* Col 4: time + badges */}
      <div className="pharma-qcard-right">
        <span className={`pharma-qcard-time${urgent ? ' pharma-qcard-time--urgent' : ''}`}>
          {timeAgo(timeRef)}
        </span>
        {isOverdue(rx) && <span className="pharma-qcard-overdue">Overdue</span>}
        {rx.items?.length > 0 && (
          <span className="pharma-med-pill">{rx.items.length} med{rx.items.length !== 1 ? 's' : ''}</span>
        )}
        <span className={`pharma-status-pill${ongoing ? ' pharma-status-pill--ongoing' : ' pharma-status-pill--pending'}`}>
          {ongoing && <span className="pharma-pulse" />}
          {ongoing ? 'Dispensing' : 'Pending'}
        </span>
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
  const [rx,              setRx]           = useState(null)
  const [loading,         setLoading]      = useState(true)
  const [checked,         setChecked]      = useState(new Set())
  const [prices,          setPrices]       = useState({})
  const [extraItems,      setExtraItems]   = useState([])
  const [newItemName,     setNewItemName]  = useState('')
  const [newItemPrice,    setNewItemPrice] = useState('')
  const [pharmNotes,      setPharmNotes]   = useState('')
  const [savingNotes,     setSavingNotes]  = useState(false)
  const [starting,        setStarting]     = useState(false)
  const [completing,      setCompleting]   = useState(false)
  const [confirming,      setConfirming]   = useState(false)
  const [stockSuggestions, setStockSuggestions] = useState([])
  /* payment (shown after completion) */
  const [payStatus,    setPayStatus]   = useState('unpaid')
  const [amountPaid,   setAmountPaid]  = useState('')
  const [savingPay,    setSavingPay]   = useState(false)
  const notesTimerRef = useRef(null)
  const extraNameRef  = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setChecked(new Set())
    setPrices({})
    setExtraItems([])
    setNewItemName('')
    setNewItemPrice('')
    setConfirming(false)
    setRx(null)

    /* ── Primary load: prescription (must succeed) ── */
    getPharmacyPrescription(rxId)
      .then(({ data }) => {
        if (cancelled) return
        setRx(data)
        setPharmNotes(data.pharmacist_notes ?? '')
        setPayStatus(data.payment_status ?? 'unpaid')
        setAmountPaid(data.amount_paid > 0 ? String(data.amount_paid) : '')

        /* Pre-fill from saved unit_price */
        const savedPrices = {}
        for (const item of (data.items ?? [])) {
          if (item.unit_price != null) savedPrices[item.id] = String(item.unit_price)
        }
        if (Object.keys(savedPrices).length > 0) setPrices(savedPrices)

        setLoading(false)

        /* ── Secondary load: stock catalog (nice-to-have, never blocks) ── */
        Promise.all([getMedicines('', 500), getStockItems('')])
          .then(([{ data: meds }, { data: items }]) => {
            if (cancelled) return
            const map = {}
            for (const m of (meds ?? [])) {
              if (m.name && m.unit_price != null) map[m.name.toLowerCase().trim()] = m.unit_price
            }
            setStockSuggestions([
              ...(meds ?? []).map(m => ({ name: m.name, price: m.unit_price ?? 0 })),
              ...(items ?? []).map(i => ({ name: i.name, price: i.unit_price ?? i.price ?? 0 })),
            ])
            if (data.status !== 'completed') {
              setPrices(prev => {
                const next = { ...prev }
                for (const item of (data.items ?? [])) {
                  if (next[item.id] == null) {
                    const sp = map[item.medicine_name?.toLowerCase().trim()]
                    if (sp != null) next[item.id] = String(sp)
                  }
                }
                return next
              })
            }
          })
          .catch(() => { /* stock catalog failure is silent */ })
      })
      .catch(() => {
        if (!cancelled) { toast.error('Could not load prescription'); setLoading(false) }
      })
    return () => {
      cancelled = true
      clearTimeout(notesTimerRef.current)
    }
  }, [rxId])

  function toggleCheck(idx) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function handleExtraNameChange(val) {
    setNewItemName(val)
    const match = stockSuggestions.find(s => s.name.toLowerCase() === val.toLowerCase())
    if (match && match.price > 0) setNewItemPrice(String(match.price))
  }

  function addExtraItem() {
    if (!newItemName.trim()) return
    const price = parseFloat(newItemPrice || '0') || 0
    if (price < 0) { toast.error('Price cannot be negative.'); return }
    setExtraItems(prev => [...prev, { uid: Date.now(), name: newItemName.trim(), price }])
    setNewItemName('')
    setNewItemPrice('')
    setTimeout(() => extraNameRef.current?.focus(), 0)
  }

  function removeExtraItem(uid) {
    setExtraItems(prev => prev.filter(i => i.uid !== uid))
  }

  function handlePharmNotesChange(val) {
    setPharmNotes(val)
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      setSavingNotes(true)
      savePharmacistNotes(rxId, val)
        .then(() => setSavingNotes(false))
        .catch(() => { setSavingNotes(false); toast.error('Could not save notes') })
    }, 900)
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
    const hasNeg = Object.values(prices).some(v => v !== '' && parseFloat(v) < 0)
    if (hasNeg) { toast.error('Medicine prices cannot be negative.'); return }
    setCompleting(true)
    setConfirming(false)
    try {
      const itemPrices = (rx.items ?? []).map(item => ({
        id: item.id,
        unit_price: prices[item.id] ? parseFloat(prices[item.id]) : null,
      }))
      const extra = extraItems.map(i => ({ name: i.name, unit_price: i.price }))
      const { data } = await completePharmacyPrescription(rxId, itemPrices, extra)
      setRx(data)
      setPayStatus(data.payment_status ?? 'unpaid')
      toast.success(`Dispensed for ${rx.patient?.name ?? 'patient'}`)
      onCompleted()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not complete — try again.')
    } finally { setCompleting(false) }
  }

  async function handleMarkPaid() {
    if (savingPay) return
    if (payStatus === 'partial') {
      const amt = parseFloat(amountPaid || '0')
      if (amt <= 0) { toast.error('Enter the partial amount paid.'); return }
    }
    setSavingPay(true)
    try {
      const { data } = await recordPrescriptionPayment(rxId, {
        payment_status: payStatus,
        amount_paid: payStatus === 'paid'
          ? (rx.total_amount ?? 0)
          : payStatus === 'partial'
            ? parseFloat(amountPaid || '0') || 0
            : 0,
        payment_notes: null,
      })
      setRx(data)
      setPayStatus(data.payment_status)
      toast.success('Payment recorded')
    } catch {
      toast.error('Could not save payment — try again.')
    } finally { setSavingPay(false) }
  }

  const isPending    = rx?.status === 'sent_to_pharmacy'
  const isDispensing = rx?.status === 'dispensing'
  const isCompleted  = rx?.status === 'completed'
  const items        = rx?.items ?? []
  const totalMeds    = items.length
  const checkedCount = checked.size
  const unchecked    = totalMeds - checkedCount
  const liveTotal    = Object.values(prices).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                     + extraItems.reduce((s, i) => s + i.price, 0)

  return (
    <div className="pharma-dpanel">

      {/* Panel header */}
      <div className="pharma-dpanel-hdr">
        {loading ? (
          <>
            <div className="pharma-dpanel-hdr-left">
              <div className="pharma-dpanel-hdr-avatar pharma-dpanel-hdr-avatar--loading">…</div>
              <div className="pharma-dpanel-hdr-info">
                <div className="pharma-dpanel-hdr-name pharma-dpanel-hdr-name--loading" />
                <div className="pharma-dpanel-hdr-sub pharma-dpanel-hdr-sub--loading" />
              </div>
            </div>
            <button className="pharma-dpanel-close" onClick={onClose} title="Close">✕</button>
          </>
        ) : rx ? (
          <>
            <div className="pharma-dpanel-hdr-left">
              <div className="pharma-dpanel-hdr-avatar">
                {(rx.patient?.name?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="pharma-dpanel-hdr-info">
                <div className="pharma-dpanel-hdr-name">{rx.patient?.name}</div>
                <div className="pharma-dpanel-hdr-sub">
                  {rx.doctor && <span>{doctorLabel(rx.doctor.name)}</span>}
                  {rx.doctor && (rx.patient?.age != null || rx.patient?.gender) && (
                    <span className="pharma-dpanel-hdr-dot">·</span>
                  )}
                  {(rx.patient?.age != null || rx.patient?.gender) && (
                    <span>{[rx.patient?.age != null && `${rx.patient?.age} yrs`, rx.patient?.gender].filter(Boolean).join(', ')}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="pharma-dpanel-hdr-right">
              <span className={`status-badge ${rx.status}`}>
                {isPending ? 'Pending' : isDispensing ? 'Dispensing' : 'Completed'}
              </span>
              <button
                className="pharma-dpanel-full-btn"
                onClick={() => navigate(`/pharmacy/prescriptions/${rxId}`)}
                title="Open full page"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Full page
              </button>
              <button className="pharma-dpanel-close" onClick={onClose} title="Close">✕</button>
            </div>
          </>
        ) : null}
      </div>

      {/* Body */}
      {loading && (
        <div className="pharma-dpanel-loading-body">
          <Spinner size={22} />
        </div>
      )}

      {rx && (
        <div className="pharma-dpanel-body">

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
                          data-dp-price-idx={idx}
                          value={prices[item.id] ?? ''}
                          onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            const next = document.querySelector(`[data-dp-price-idx="${idx + 1}"]`)
                            if (next) next.focus()
                            else extraNameRef.current?.focus()
                          }}
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

              {/* Extra items — only when dispensing */}
              {isDispensing && (
                <div className="rx-extra-section">
                  <div className="rx-extra-header">Additional Items</div>
                  {extraItems.length > 0 && (
                    <div className="rx-extra-grid">
                      {extraItems.map(item => (
                        <div key={item.uid} className="rx-extra-cell">
                          <span className="rx-extra-cell-name">{item.name}</span>
                          <span className="rx-extra-cell-price">{fmtPrice(item.price)}</span>
                          <button className="rx-extra-remove" onClick={() => removeExtraItem(item.uid)} title="Remove">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <datalist id="dp-extra-suggestions">
                    {stockSuggestions.map((s, i) => <option key={i} value={s.name} />)}
                  </datalist>

                  <div className="rx-extra-form">
                    <input
                      ref={extraNameRef}
                      className="rx-extra-input"
                      list="dp-extra-suggestions"
                      placeholder="Item name… (or pick from stock)"
                      value={newItemName}
                      onChange={e => handleExtraNameChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addExtraItem()}
                    />
                    <div className="rx-price-wrap" style={{ flex: 'none' }}>
                      <span className="rx-price-currency">₹</span>
                      <input
                        className="rx-price-input"
                        type="number" min="0" step="0.01" placeholder="0.00"
                        value={newItemPrice}
                        onChange={e => setNewItemPrice(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addExtraItem()}
                        style={{ width: 64 }}
                      />
                    </div>
                    <button className="rx-extra-add-btn" onClick={addExtraItem} disabled={!newItemName.trim()}>+ Add</button>
                  </div>
                </div>
              )}

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

          {/* Pharmacist notes — always visible, auto-saved */}
          {!isCompleted && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pharmacist Notes
                </span>
                {savingNotes && (
                  <span style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginLeft: 'auto' }}>saving…</span>
                )}
              </div>
              <textarea
                className="rx-pharma-notes"
                rows={2}
                placeholder="Substitutions, remarks, notes…"
                value={pharmNotes}
                onChange={e => handlePharmNotesChange(e.target.value)}
              />
            </div>
          )}
          {isCompleted && pharmNotes && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Pharmacist Notes
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--clr-text)', whiteSpace: 'pre-wrap', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 6, padding: '8px 10px' }}>
                {pharmNotes}
              </p>
            </div>
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

                {/* ── Inline payment ── */}
                <div className="pharma-dpanel-pay">
                  <div className="pharma-dpanel-pay-label">Payment</div>
                  <div className="pharma-dpanel-pay-pills">
                    {['unpaid', 'partial', 'paid'].map(s => (
                      <button
                        key={s}
                        className={`pharma-dpanel-pay-pill pharma-dpanel-pay-pill--${s}${payStatus === s ? ' pharma-dpanel-pay-pill--on' : ''}`}
                        onClick={() => setPayStatus(s)}
                      >
                        {s === 'unpaid' ? 'Unpaid' : s === 'partial' ? 'Partial' : 'Paid ✓'}
                      </button>
                    ))}
                  </div>
                  {payStatus === 'partial' && (
                    <div className="pharma-dpanel-pay-partial">
                      <span>₹</span>
                      <input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        className="pharma-dpanel-pay-amount"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    className="pharma-dpanel-pay-save"
                    onClick={handleMarkPaid}
                    disabled={savingPay}
                  >
                    {savingPay ? 'Saving…' : 'Save Payment'}
                  </button>
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
  const [search,       setSearch]       = useSessionState('pharmacy:search', '')
  const [alerts,       setAlerts]       = useState(null)
  const [selectedRxId, setSelectedRxId] = useState(null)

  const qtRef = useRef(null)
  const stRef = useRef(null)

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

  function startPolling() {
    clearInterval(qtRef.current)
    clearInterval(stRef.current)
    qtRef.current = setInterval(() => loadQueue(true), POLL_MS)
    stRef.current = setInterval(() => loadStats(true), POLL_MS)
  }

  useEffect(() => {
    loadQueue(); loadStats()
    getStockAlerts().then(({ data }) => setAlerts(data)).catch(() => {})
    startPolling()
    return () => { clearInterval(qtRef.current); clearInterval(stRef.current) }
  }, [loadQueue, loadStats]) // startPolling reads stable loadQueue/loadStats refs

  useEffect(() => {
    function handleKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'P') navigate('/pharmacy/history')
      if (e.key === 'R') navigate('/pharmacy/revenue')
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [navigate])

  const q        = search.trim().toLowerCase()
  const filtered = q
    ? allRx.filter(rx =>
        rx.patient?.name?.toLowerCase().includes(q) ||
        rx.doctor?.name?.toLowerCase().includes(q) ||
        rx.items?.some(i => i.medicine_name?.toLowerCase().includes(q))
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

  function handleRefresh() { loadQueue(); loadStats(); startPolling() }

  function openPanel(rxId) {
    setSelectedRxId(prev => prev === rxId ? null : rxId)
  }

  return (
    <div className="phq-page">

      {/* ── Page header ── */}
      <div className="phq-page-hdr">
        <div className="phq-page-hdr-left">
          <h1 className="phq-page-title">Pharmacy Queue</h1>
          <p className="phq-page-sub">
            {queueStatus === 'done' && allRx.length > 0
              ? <><strong>{allRx.length}</strong> active prescription{allRx.length !== 1 ? 's' : ''}</>
              : 'Live prescription queue'
            }
            {lastSync && <> · Synced {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>}
            <span className="phq-page-sub-keys">
              <kbd>N</kbd> Queue &nbsp;
              <kbd>P</kbd> History &nbsp;
              <kbd>R</kbd> Revenue
            </span>
          </p>
        </div>
        <div className="phq-page-hdr-right">
          {hasAlerts && (
            <button className="phq-alert-chip" onClick={() => navigate('/pharmacy/stock')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {alertParts.join(' · ')} — View Stock
            </button>
          )}
          <button className="phq-refresh-btn" onClick={handleRefresh} disabled={queueStatus === 'loading'}>
            {queueStatus === 'loading' ? <Spinner size={12} /> : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="phq-body">

        {/* ── KPI stat cards ── */}
        <div className="phq-kpi-row">
          <div className="phq-kpi">
            <div className="phq-kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="phq-kpi-content">
              <span className="phq-kpi-num">{statsLoading ? '—' : stats.pending + stats.dispensing}</span>
              <span className="phq-kpi-label">Active</span>
              <span className="phq-kpi-sub">in queue now</span>
            </div>
          </div>

          <div className="phq-kpi phq-kpi--amber">
            <div className="phq-kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="phq-kpi-content">
              <span className="phq-kpi-num">{statsLoading ? '—' : stats.pending}</span>
              <span className="phq-kpi-label">Pending</span>
              <span className="phq-kpi-sub">awaiting dispense</span>
            </div>
          </div>

          <div className="phq-kpi phq-kpi--green">
            <div className="phq-kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <div className="phq-kpi-content">
              <span className="phq-kpi-num">{statsLoading ? '—' : stats.dispensing}</span>
              <span className="phq-kpi-label">Dispensing</span>
              <span className="phq-kpi-sub">in progress</span>
            </div>
          </div>

          <div className="phq-kpi phq-kpi--indigo">
            <div className="phq-kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="phq-kpi-content">
              <span className="phq-kpi-num">{statsLoading ? '—' : stats.today_done}</span>
              <span className="phq-kpi-label">Done Today</span>
              <span className="phq-kpi-sub">dispensed</span>
            </div>
          </div>
        </div>

        {/* ── Queue card ── */}
        <div className="phq-queue-card">

          {/* Toolbar */}
          <div className="phq-card-toolbar">
            <span className="phq-queue-label">Queue</span>
            {queueStatus === 'done' && allRx.length > 0 && (
              <span className="phq-queue-count">{allRx.length} active</span>
            )}
            <div className="phq-search-box">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="phq-search-input"
                type="text"
                placeholder="Search patient, doctor or medicine…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {q && <span className="phq-search-count">{filtered.length} of {allRx.length}</span>}
            </div>
          </div>

          {/* Column headers — shown when there are items */}
          {queueStatus === 'done' && filtered.length > 0 && (
            <div className="phq-col-hdr">
              <span />
              <span>Patient</span>
              <span>Prescribed by · Medicines</span>
              <span>Status</span>
            </div>
          )}

          {/* Loading */}
          {queueStatus === 'loading' && (
            <div className="phq-state-center">
              <Spinner size={24} />
            </div>
          )}

          {/* Error */}
          {queueStatus === 'error' && (
            <div className="phq-state-center">
              <p>Could not load prescriptions — check your connection.</p>
              <button className="btn-link" style={{ marginTop: 8 }} onClick={handleRefresh}>Try again</button>
            </div>
          )}

          {/* Empty */}
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

          {/* Active queue — split when panel open */}
          {queueStatus === 'done' && filtered.length > 0 && (
            <div className={`pharma-queue-wrap${selectedRxId ? ' pharma-queue-wrap--split' : ''}`}>

              <div className="pharma-queue-main">
                {ongoing.length > 0 && (
                  <section>
                    <div className="phq-section-hdr">
                      <span className="phq-section-title">Dispensing</span>
                      <span className="phq-section-count">{ongoing.length}</span>
                    </div>
                    <ul className="phq-qlist">
                      {ongoing.map(rx => (
                        <li key={rx.id}>
                          <RxCard rx={rx} selected={selectedRxId === rx.id} onClick={() => openPanel(rx.id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {pending.length > 0 && (
                  <section>
                    <div className="phq-section-hdr phq-section-hdr--pending">
                      <span className="phq-section-title">Pending</span>
                      <span className="phq-section-count phq-section-count--amber">{pending.length}</span>
                    </div>
                    <ul className="phq-qlist">
                      {pending.map(rx => (
                        <li key={rx.id}>
                          <RxCard rx={rx} selected={selectedRxId === rx.id} onClick={() => openPanel(rx.id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

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
      </div>
    </div>
  )
}
