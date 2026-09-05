import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getPharmacyPrescription,
  startDispensingPharmacyPrescription,
  completePharmacyPrescription,
} from '../../services/pharmacyService'
import Spinner from '../../components/ui/Spinner'

const STATUS_LABEL = {
  sent_to_pharmacy: 'Pending',
  dispensing:       'Dispensing',
  completed:        'Completed',
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(amount) {
  return parseFloat(amount).toLocaleString('en-PK', {
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

  useEffect(() => {
    let cancelled = false
    getPharmacyPrescription(prescriptionId)
      .then(({ data }) => {
        if (!cancelled) { setPrescription(data.data); setPageStatus('done') }
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

  async function handleStartDispensing() {
    setDispensing(true)
    try {
      const { data } = await startDispensingPharmacyPrescription(prescriptionId)
      setPrescription(data.data)
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

  async function handleComplete() {
    setCompleting(true); setConfirmComplete(false)
    try {
      const itemPrices = (prescription.items ?? []).map(item => ({
        id:         item.id,
        unit_price: prices[item.id] ? parseFloat(prices[item.id]) : null,
      }))
      const { data } = await completePharmacyPrescription(prescriptionId, itemPrices)
      setPrescription(data.data)
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

  /* ── Page states ─────────────────────────────────────────────────────── */

  if (pageStatus === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spinner size={28} />
      </div>
    )
  }
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

  /* Live total from price inputs during dispensing */
  const liveTotal = (prescription.items ?? []).reduce((sum, item) => {
    const v = parseFloat(prices[item.id] || '0')
    return sum + (isNaN(v) ? 0 : v)
  }, 0)

  const hasInvoice = isDispensing || (isCompleted && (prescription.total_amount ?? 0) > 0)

  return (
    <div>
      <button className="btn-link detail-back" onClick={() => navigate('/pharmacy')}>
        ← Queue
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
              <div className="rx-send-confirm" style={{ animationDuration: '0.15s' }}>
                <span className="rx-send-confirm-label">Confirm all dispensed?</span>
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
            )}

            {/* Completed notice + View Invoice */}
            {isCompleted && (
              <>
                <div className="pharma-done-pill">
                  <IconCheck size={13} />
                  Dispensed {prescription.completed_at ? fmtDateTime(prescription.completed_at) : ''}
                </div>
                <button
                  className="rx-action-btn rx-action-btn--invoice"
                  onClick={() => window.open(`/pharmacy/prescriptions/${prescriptionId}/invoice`, '_blank')}
                >
                  <IconPrint />
                  View Invoice
                </button>
              </>
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
                      <span className="rx-price-currency">₹</span>
                      <span className="rx-price-display">{fmtPrice(item.unit_price)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Invoice total footer */}
            {isDispensing && (
              <div className="rx-invoice-footer">
                <span className="rx-invoice-total-label">Total</span>
                <span className="rx-invoice-total-amount">₹{fmtPrice(liveTotal)}</span>
              </div>
            )}

            {isCompleted && (prescription.total_amount ?? 0) > 0 && (
              <div className="rx-invoice-footer">
                <span className="rx-invoice-total-label">Total</span>
                <span className="rx-invoice-total-amount">₹{fmtPrice(prescription.total_amount)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="history-empty">No medicines on this prescription.</div>
        )}
      </div>

      {/* ── Doctor notes ──────────────────────────────────────────────── */}
      {prescription.doctor_notes && (
        <div className="card rx-content-card" style={{ marginTop: 'var(--space-md)' }}>
          <div className="rx-content-header">
            <span className="rx-content-label">Doctor Notes</span>
          </div>
          <p className="visit-notes-display" style={{ marginTop: 'var(--space-sm)' }}>
            {prescription.doctor_notes}
          </p>
        </div>
      )}
    </div>
  )
}
