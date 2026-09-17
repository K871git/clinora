import '../../styles/prescriptions-detail.css'
import '../../styles/pharmacy-pages.css'
import '../../styles/pharmacy-stock.css'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'
import {
  getPharmacyPrescription,
  startDispensingPharmacyPrescription,
  completePharmacyPrescription,
  recordPrescriptionPayment,
  savePharmacistNotes,
  getPatientDispenseHistory,
} from '../../services/pharmacyService'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import { fmtDateTime } from '../../lib/dateUtils'

const STATUS_LABEL = {
  sent_to_pharmacy: 'Pending',
  dispensing:       'Dispensing',
  completed:        'Completed',
}

function fmtPrice(amount) {
  return '₹' + parseFloat(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

/* ── Icons ───────────────────────────────────────────────────────────── */

function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function IconPrint() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function PharmacyPrescriptionPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()

  const [prescription,    setPrescription]    = useState(null)
  const [pageStatus,      setPageStatus]      = useState('loading')
  const [dispensing,      setDispensing]      = useState(false)
  const [completing,      setCompleting]      = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [checked,         setChecked]         = useState(new Set())
  const [prices,          setPrices]          = useState({})
  const [extraItems,      setExtraItems]      = useState([])
  const [newItemName,     setNewItemName]     = useState('')
  const [newItemPrice,    setNewItemPrice]    = useState('')

  /* payment state */
  const [paymentStatus,  setPaymentStatus]  = useState('unpaid')
  const [amountPaid,     setAmountPaid]     = useState('')
  const [paymentNotes,   setPaymentNotes]   = useState('')
  const [savingPayment,  setSavingPayment]  = useState(false)

  /* notes state */
  const [pharmNotes,     setPharmNotes]     = useState('')
  const [savingNotes,    setSavingNotes]    = useState(false)
  const [notesTimer,     setNotesTimer]     = useState(null)

  /* medication history */
  const [medHistory,     setMedHistory]     = useState([])
  const [histOpen,       setHistOpen]       = useState(true)

  useEffect(() => {
    let cancelled = false
    getPharmacyPrescription(prescriptionId)
      .then(({ data }) => {
        if (!cancelled) {
          const rx = data
          setPrescription(rx)
          setPaymentStatus(rx.payment_status ?? 'unpaid')
          setAmountPaid(rx.amount_paid > 0 ? String(rx.amount_paid) : '')
          setPaymentNotes(rx.payment_notes ?? '')
          setPharmNotes(rx.pharmacist_notes ?? '')
          setPageStatus('done')
          if (rx.patient?.id) {
            getPatientDispenseHistory(rx.patient.id, prescriptionId)
              .then(({ data: hist }) => { if (!cancelled) setMedHistory(hist) })
              .catch(() => {})
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const s = err.response?.status
          if (s === 404)      setPageStatus('not-found')
          else if (s === 403) setPageStatus('forbidden')
          else                setPageStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [prescriptionId])

  function toggleCheck(idx) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function setItemPrice(itemId, value) {
    setPrices(prev => ({ ...prev, [itemId]: value }))
  }

  function addExtraItem() {
    if (!newItemName.trim()) return
    const price = parseFloat(newItemPrice || '0') || 0
    setExtraItems(prev => [...prev, { uid: Date.now(), name: newItemName.trim(), price }])
    setNewItemName('')
    setNewItemPrice('')
  }

  function removeExtraItem(uid) {
    setExtraItems(prev => prev.filter(i => i.uid !== uid))
  }

  async function handleStartDispensing() {
    setDispensing(true)
    try {
      const { data } = await startDispensingPharmacyPrescription(prescriptionId)
      setPrescription(data)
      toast.success('Started dispensing', {
        description: `Prescription for ${prescription.patient.name}`,
        duration: 4000,
      })
    } catch (err) {
      const s    = err.response?.status
      const body = err.response?.data
      toast.error(
        (s === 409 || s === 422)
          ? (body?.message ?? 'This prescription is no longer pending.')
          : 'Could not start dispensing — please try again.'
      )
    } finally { setDispensing(false) }
  }

  async function handleSavePayment() {
    setSavingPayment(true)
    try {
      const { data } = await recordPrescriptionPayment(prescriptionId, {
        payment_status: paymentStatus,
        amount_paid:    paymentStatus === 'paid'
          ? prescription.total_amount ?? 0
          : paymentStatus === 'partial'
            ? parseFloat(amountPaid || '0') || 0
            : 0,
        payment_notes: paymentNotes.trim() || null,
      })
      setPrescription(data)
      setPaymentStatus(data.payment_status)
      toast.success('Payment recorded')
    } catch {
      toast.error('Could not save payment — try again.')
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleComplete() {
    setCompleting(true); setConfirmComplete(false)
    try {
      const itemPrices = (prescription.items ?? []).map(item => ({
        id:         item.id,
        unit_price: prices[item.id] ? parseFloat(prices[item.id]) : null,
      }))
      const extra = extraItems.map(i => ({ name: i.name, unit_price: i.price }))
      const { data } = await completePharmacyPrescription(prescriptionId, itemPrices, extra)
      setPrescription(data)
      toast.success('Prescription completed', {
        description: `All medicines dispensed for ${prescription.patient.name}`,
        duration: 4000,
      })
    } catch (err) {
      const s    = err.response?.status
      const body = err.response?.data
      toast.error(
        (s === 409 || s === 422)
          ? (body?.message ?? 'This prescription is no longer active.')
          : 'Could not complete — check your connection and try again.'
      )
    } finally { setCompleting(false) }
  }

  function handlePharmNotesChange(val) {
    setPharmNotes(val)
    if (notesTimer) clearTimeout(notesTimer)
    const t = setTimeout(() => {
      setSavingNotes(true)
      savePharmacistNotes(prescriptionId, val)
        .then(() => setSavingNotes(false))
        .catch(() => { setSavingNotes(false); toast.error('Could not save notes') })
    }, 900)
    setNotesTimer(t)
  }

  async function handleExportText() {
    if (!prescription) return
    const p = prescription.patient
    const items = (prescription.items ?? [])
      .map((it, i) => `  ${i + 1}. ${it.medicine_name}${it.dosage ? ' — ' + it.dosage : ''}${it.frequency ? ', ' + it.frequency : ''}${it.duration ? ', ' + it.duration : ''}${it.instructions ? '\n     ' + it.instructions : ''}`)
      .join('\n')

    const lines = [
      `PRESCRIPTION DETAIL`,
      `===================`,
      `Date       : ${fmtDateTime(prescription.prescribed_at)}`,
      `Patient    : ${p.name}${p.age != null ? ', ' + p.age + ' yrs' : ''}${p.gender ? ', ' + p.gender : ''}`,
      p.mobile ? `Mobile     : ${p.mobile}` : '',
      prescription.doctor ? `Doctor     : ${doctorLabel(prescription.doctor.name)}` : '',
      `Status     : ${STATUS_LABEL[prescription.status] ?? prescription.status}`,
      ``,
      `MEDICINES`,
      `---------`,
      items || '  (none)',
      prescription.total_amount > 0 ? `\nTotal      : ₹${parseFloat(prescription.total_amount).toFixed(2)}` : '',
      ``,
    ]

    if (prescription.consultation_notes) {
      lines.push('VISIT / CONSULTATION NOTES', '--------------------------', prescription.consultation_notes, '')
    }
    if (prescription.doctor_notes) {
      lines.push('DOCTOR NOTES', '------------', prescription.doctor_notes, '')
    }
    if (pharmNotes.trim()) {
      lines.push('PHARMACIST NOTES', '----------------', pharmNotes.trim(), '')
    }

    lines.push(`Exported : ${new Date().toLocaleString('en-IN')}`)

    const content = lines.filter(l => l !== null && l !== undefined).join('\n')
    const filename = `Rx_${p.name.replace(/\s+/g, '_')}_${prescriptionId}.txt`
    try {
      await invoke('write_text_to_downloads', { content, filename })
      toast.success(`Saved to Downloads as ${filename}`)
    } catch {
      toast.error('Could not save file')
    }
  }

  /* ── Page states ─────────────────────────────────────────────────────── */

  if (pageStatus === 'loading') return <PageLoader />
  if (pageStatus === 'not-found') return <div className="card state-panel">Prescription not found.</div>
  if (pageStatus === 'forbidden') return <div className="card state-panel">You do not have access to this prescription.</div>
  if (pageStatus === 'error')     return <div className="card state-panel">Could not load prescription — check your connection.</div>

  const isPending    = prescription.status === 'sent_to_pharmacy'
  const isDispensing = prescription.status === 'dispensing'
  const isCompleted  = prescription.status === 'completed'
  const p            = prescription.patient
  const totalMeds    = prescription.items?.length ?? 0
  const checkedCount = checked.size
  const progress     = totalMeds > 0 ? Math.round((checkedCount / totalMeds) * 100) : 0

  /* Live total from price inputs + extra items during dispensing */
  const liveTotal = (prescription.items ?? []).reduce((sum, item) => {
    const v = parseFloat(prices[item.id] || '0')
    return sum + (isNaN(v) ? 0 : v)
  }, 0) + extraItems.reduce((sum, i) => sum + i.price, 0)

  const uncheckedCount = totalMeds - checkedCount

  const hasInvoice = isDispensing || (isCompleted && (prescription.total_amount ?? 0) > 0)

  return (
    <div>
      <button className="btn-link detail-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* ── Header card ──────────────────────────────────────────────── */}
      <div className="card rx-hcard">

        {/* Patient row */}
        <div className="rx-hcard-patient">
          <div className="rx-hcard-avatar">{p.name[0].toUpperCase()}</div>

          <div className="rx-hcard-info">
            <div className="rx-hcard-name">{p.name}</div>
            <div className="rx-hcard-meta">
              {prescription.doctor && <span>{doctorLabel(prescription.doctor.name)}</span>}
              {p.mobile && <span>{p.mobile}</span>}
              {(p.age != null || p.gender) && (
                <span>{[p.age != null && `${p.age} yrs`, p.gender].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </div>

          <div className="rx-hcard-aside">
            <span className={`status-badge ${prescription.status}`}>
              {STATUS_LABEL[prescription.status] ?? prescription.status}
            </span>
            <div className="rx-hcard-date">{fmtDateTime(prescription.prescribed_at)}</div>
          </div>
        </div>

        {/* Timeline strip */}
        {(prescription.sent_to_pharmacy_at || prescription.dispensed_at || prescription.completed_at) && (
          <div className="pharma-tl-strip">
            {prescription.sent_to_pharmacy_at && (
              <div className="pharma-tl-item">
                <span className="pharma-tl-dot pharma-tl-dot--sent" />
                <div className="pharma-tl-content">
                  <span className="pharma-tl-label">Received</span>
                  <span className="pharma-tl-time">{fmtDateTime(prescription.sent_to_pharmacy_at)}</span>
                </div>
              </div>
            )}
            {prescription.dispensed_at && (
              <div className="pharma-tl-item">
                <span className="pharma-tl-dot pharma-tl-dot--dispensing" />
                <div className="pharma-tl-content">
                  <span className="pharma-tl-label">Started</span>
                  <span className="pharma-tl-time">{fmtDateTime(prescription.dispensed_at)}</span>
                </div>
              </div>
            )}
            {prescription.completed_at && (
              <div className="pharma-tl-item">
                <span className="pharma-tl-dot pharma-tl-dot--done" />
                <div className="pharma-tl-content">
                  <span className="pharma-tl-label">Completed</span>
                  <span className="pharma-tl-time">{fmtDateTime(prescription.completed_at)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="rx-hcard-actions">
          <div className="rx-hcard-actions-left">
            {isDispensing && totalMeds > 0 && (
              <div className="pharma-prg-wrap">
                <div className="pharma-prg-track">
                  <div className="pharma-prg-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="pharma-prg-label">{checkedCount}/{totalMeds} checked</span>
              </div>
            )}
          </div>

          <div className="rx-hcard-actions-right">
            {/* Start dispensing */}
            {isPending && (
              <button
                className="rx-action-btn rx-action-btn--primary"
                onClick={handleStartDispensing}
                disabled={dispensing}
              >
                {dispensing ? <Spinner size={12} /> : <IconPlay />}
                {dispensing ? 'Starting…' : 'Start Dispensing'}
              </button>
            )}

            {/* Mark complete (with inline confirm) */}
            {isDispensing && !confirmComplete && (
              <button
                className="rx-action-btn rx-action-btn--primary"
                onClick={() => setConfirmComplete(true)}
                disabled={completing}
              >
                <IconCheck size={13} />
                Complete Dispensing
              </button>
            )}

            {isDispensing && confirmComplete && (
              <div className="rx-send-confirm" style={{ animationDuration: '0.15s', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {uncheckedCount > 0 && (
                  <div className="rx-complete-warn">
                    ⚠ {uncheckedCount} item{uncheckedCount > 1 ? 's' : ''} not checked — are they all dispensed?
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="rx-send-confirm-label">
                    {uncheckedCount > 0 ? 'Complete anyway?' : 'Confirm all dispensed?'}
                  </span>
                  <button
                    className="rx-action-btn rx-action-btn--primary"
                    onClick={handleComplete}
                    disabled={completing}
                  >
                    {completing ? <Spinner size={12} /> : null}
                    {completing ? 'Completing…' : 'Yes, Complete'}
                  </button>
                  <button
                    className="rx-action-btn"
                    onClick={() => setConfirmComplete(false)}
                    disabled={completing}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Print Prescription — always available */}
            <button
              className="rx-action-btn"
              onClick={() => navigate(`/pharmacy/prescriptions/${prescriptionId}/print`)}
            >
              <IconPrint />
              Print Rx
            </button>

            {/* Print dispense labels — available when dispensing or completed */}
            {(isDispensing || isCompleted) && (
              <button
                className="rx-action-btn"
                onClick={() => navigate(`/pharmacy/prescriptions/${prescriptionId}/label`)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
                Print Labels
              </button>
            )}

            {/* Pharmacy Invoice — available from dispensing onwards */}
            {(isDispensing || isCompleted) && (
              <button
                className="rx-action-btn rx-action-btn--invoice"
                onClick={() => navigate(`/pharmacy/prescriptions/${prescriptionId}/invoice`)}
              >
                <IconPrint />
                Pharmacy Invoice
              </button>
            )}

            {/* Completed notice */}
            {isCompleted && (
              <div className="pharma-done-pill">
                <IconCheck size={13} />
                Dispensed {prescription.completed_at ? fmtDateTime(prescription.completed_at) : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Medicines + Invoice card ──────────────────────────────────── */}
      <div className="card rx-content-card" style={{ marginTop: 'var(--space-md)' }}>
        <div className="rx-content-header">
          <span className="rx-content-label">Medicines</span>
          <span className="rx-content-count">{totalMeds}</span>
          {isDispensing && totalMeds > 0 && (
            <span className="pharma-check-hint">{checkedCount} of {totalMeds} checked</span>
          )}
          {hasInvoice && totalMeds > 0 && (
            <span className="pharma-check-hint" style={{ marginLeft: 'auto' }}>Invoice</span>
          )}
        </div>

        {prescription.items?.length > 0 ? (
          <>
            <ul className="rx-medicine-list">
              {prescription.items.map((item, idx) => (
                <li
                  key={item.id ?? idx}
                  className={`rx-medicine-item pharma-med-row${checked.has(idx) ? ' pharma-med-row--checked' : ''}`}
                >
                  {/* Check button or number */}
                  {isDispensing ? (
                    <button
                      className={`pharma-check-btn${checked.has(idx) ? ' pharma-check-btn--checked' : ''}`}
                      onClick={() => toggleCheck(idx)}
                      title={checked.has(idx) ? 'Uncheck' : 'Mark as dispensed'}
                    >
                      {checked.has(idx) && <IconCheck size={10} />}
                    </button>
                  ) : (
                    <div className="rx-medicine-num">{idx + 1}</div>
                  )}

                  {/* Medicine info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rx-medicine-name">{item.medicine_name}</div>
                    {(item.dosage || item.frequency || item.duration) && (
                      <div className="rx-medicine-meta">
                        {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {item.instructions && (
                      <div className="rx-medicine-instructions">{item.instructions}</div>
                    )}
                  </div>

                  {/* Price — dispensing: editable input; completed: read-only */}
                  {isDispensing && (
                    <div className="rx-price-wrap">
                      <span className="rx-price-currency">₹</span>
                      <input
                        className="rx-price-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={prices[item.id] ?? ''}
                        onChange={e => setItemPrice(item.id, e.target.value)}
                      />
                    </div>
                  )}

                  {isCompleted && item.unit_price != null && (
                    <div className="rx-price-wrap">
                      <span className="rx-price-display">{fmtPrice(item.unit_price)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Extra items — pharmacist-added (water bottle, inhaler, gadgets…) */}
            {isDispensing && (
              <div className="rx-extra-section">
                <div className="rx-extra-header">Additional Items</div>

                {extraItems.map(item => (
                  <div key={item.uid} className="rx-extra-row">
                    <span className="rx-extra-name">{item.name}</span>
                    <span className="rx-extra-price">{fmtPrice(item.price)}</span>
                    <button className="rx-extra-remove" onClick={() => removeExtraItem(item.uid)} title="Remove">×</button>
                  </div>
                ))}

                <div className="rx-extra-form">
                  <input
                    className="rx-extra-input"
                    placeholder="Item name…"
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExtraItem()}
                  />
                  <div className="rx-price-wrap" style={{ flex: 'none' }}>
                    <span className="rx-price-currency">₹</span>
                    <input
                      className="rx-price-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={newItemPrice}
                      onChange={e => setNewItemPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addExtraItem()}
                    />
                  </div>
                  <button className="rx-extra-add-btn" onClick={addExtraItem} disabled={!newItemName.trim()}>
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Invoice total footer */}
            {isDispensing && (
              <div className="rx-invoice-footer">
                <span className="rx-invoice-total-label">TOTAL</span>
                <span className="rx-invoice-total-amount">{fmtPrice(liveTotal)}</span>
              </div>
            )}

            {isCompleted && (prescription.total_amount ?? 0) > 0 && (
              <div className="rx-invoice-footer">
                <span className="rx-invoice-total-label">Total</span>
                <span className="rx-invoice-total-amount">{fmtPrice(prescription.total_amount)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="history-empty">No medicines on this prescription.</div>
        )}
      </div>

      {/* ── Payment section — only for completed prescriptions ────────── */}
      {isCompleted && (
        <div className="card rx-content-card" style={{ marginTop: 'var(--space-md)' }}>
          <div className="rx-content-header">
            <span className="rx-content-label">Payment</span>
            <span className={`px-pay-badge px-pay-badge--${paymentStatus}`}>
              {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
            </span>
          </div>

          <div className="px-pay-body">
            <div className="px-pay-pills">
              {['unpaid', 'partial', 'paid'].map(s => (
                <button
                  key={s}
                  className={`px-pay-pill px-pay-pill--${s}${paymentStatus === s ? ' px-pay-pill--on' : ''}`}
                  onClick={() => setPaymentStatus(s)}
                >
                  {s === 'unpaid' ? 'Unpaid' : s === 'partial' ? 'Partial' : 'Paid'}
                </button>
              ))}
            </div>

            {paymentStatus === 'partial' && (
              <div className="px-pay-partial">
                <span className="px-pay-partial-label">Amount Paid ₹</span>
                <input
                  className="field px-pay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                />
              </div>
            )}

            <textarea
              className="field px-pay-notes"
              rows={1}
              placeholder="Payment notes (optional)…"
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
            />

            <button
              className="rx-action-btn rx-action-btn--primary px-pay-save-btn"
              onClick={handleSavePayment}
              disabled={savingPayment}
            >
              {savingPayment ? <Spinner size={12} /> : null}
              {savingPayment ? 'Saving…' : 'Save Payment'}
            </button>
          </div>
        </div>
      )}

      {/* ── Patient Medication History ────────────────────────────────── */}
      {medHistory.length > 0 && (
        <div className="card rx-content-card" style={{ marginTop: 'var(--space-md)' }}>
          <div
            className="rx-content-header"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setHistOpen(o => !o)}
          >
            <span className="rx-content-label">Previous Dispense History</span>
            <span className="rx-content-count">{medHistory.length}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--clr-text-muted)' }}>
              {histOpen ? '▲ hide' : '▼ show'}
            </span>
          </div>

          {histOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {medHistory.map((rx, i) => (
                <div
                  key={rx.id}
                  style={{
                    background: 'var(--clr-surface)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--clr-text)' }}>
                      {fmtDateTime(rx.completed_at || rx.prescribed_at)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginLeft: 'auto' }}>
                      {rx.doctor_name ? `Dr. ${rx.doctor_name}` : ''}
                    </span>
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
                    {(rx.medicines ?? []).map((m, j) => (
                      <li key={j} style={{ fontSize: 12, color: 'var(--clr-text)', lineHeight: 1.6 }}>
                        <span style={{ fontWeight: 500 }}>{m.medicine_name}</span>
                        {(m.dosage || m.frequency || m.duration) && (
                          <span style={{ color: 'var(--clr-text-muted)', marginLeft: 4 }}>
                            — {[m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Notes panel ───────────────────────────────────────────────── */}
      {(prescription.consultation_notes || prescription.doctor_notes || !isCompleted || true) && (
        <div className="card rx-content-card" style={{ marginTop: 'var(--space-md)' }}>
          <div className="rx-content-header" style={{ justifyContent: 'space-between' }}>
            <span className="rx-content-label">Notes</span>
            <button
              className="rx-action-btn"
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={handleExportText}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export as Text
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
            {/* Consultation / Visit notes — read-only */}
            {prescription.consultation_notes && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--clr-text-muted)', marginBottom: 4 }}>
                  Visit / Consultation Notes
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--clr-text)', whiteSpace: 'pre-wrap', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  {prescription.consultation_notes}
                </p>
              </div>
            )}

            {/* Doctor notes — read-only */}
            {prescription.doctor_notes && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--clr-text-muted)', marginBottom: 4 }}>
                  Doctor Notes
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--clr-text)', whiteSpace: 'pre-wrap', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  {prescription.doctor_notes}
                </p>
              </div>
            )}

            {/* Pharmacist notes — editable */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--clr-text-muted)' }}>
                  Pharmacist Notes
                </div>
                {savingNotes && (
                  <span style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>saving…</span>
                )}
              </div>
              <textarea
                className="field"
                rows={3}
                style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
                placeholder="Add pharmacist notes, dispensing remarks, substitutions…"
                value={pharmNotes}
                onChange={e => handlePharmNotesChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
