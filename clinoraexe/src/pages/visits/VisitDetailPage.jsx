import '../../styles/visit-detail.css'
import '../../styles/emr.css'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getVisit, updateVisit, saveFee, completeVisit, recordVisitPayment } from '../../services/visitService'
import { validateFee } from '../../lib/inputValidators'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import { confirmDiscard } from '../../lib/swal'
import SoapNotesSection from '../../components/emr/SoapNotesSection'
import VitalSignsTab from '../../components/emr/VitalSignsTab'
import { updateFollowup } from '../../services/visitService'

/* ── Avatar ──────────────────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6']
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length] }

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtDateTime(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(amount) {
  return parseFloat(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function isoToLocal(iso) {
  if (!iso) return ''
  const d  = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  const h  = String(d.getHours()).padStart(2, '0')
  const m  = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${dy}T${h}:${m}`
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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

function IconSave() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function VisitDetailPage() {
  const { visitId } = useParams()
  const navigate    = useNavigate()

  const [visit,      setVisit]      = useState(null)
  const [pageStatus, setPageStatus] = useState('loading')

  /* edit form */
  const [editing,       setEditing]       = useState(false)
  const [editVisitedAt, setEditVisitedAt] = useState('')
  const [editNotes,     setEditNotes]     = useState('')
  const [fieldErrors,   setFieldErrors]   = useState({})
  const [apiError,      setApiError]      = useState(null)
  const [saving,        setSaving]        = useState(false)

  /* billing */
  const [feeInput,        setFeeInput]        = useState('')
  const [savingFee,       setSavingFee]       = useState(false)
  const [feeSaved,        setFeeSaved]        = useState(false)
  const [completing,      setCompleting]      = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)

  /* payment status */
  const [paymentStatus,  setPaymentStatus]  = useState('unpaid')
  const [amountPaid,     setAmountPaid]     = useState('')
  const [paymentNotes,   setPaymentNotes]   = useState('')
  const [savingPayment,  setSavingPayment]  = useState(false)

  /* follow-up */
  const [followupDate,   setFollowupDate]   = useState('')
  const [followupNotes,  setFollowupNotes]  = useState('')
  const [savingFollowup, setSavingFollowup] = useState(false)
  const [followupSaved,  setFollowupSaved]  = useState(false)

  useEffect(() => {
    let cancelled = false
    getVisit(visitId)
      .then(({ data }) => {
        if (!cancelled) {
          const v = data
          setVisit(v)
          const fee = v.consultation_fee
          setFeeInput(fee > 0 ? String(fee) : '')
          setPaymentStatus(v.payment_status ?? 'unpaid')
          setAmountPaid(v.amount_paid > 0 ? String(v.amount_paid) : '')
          setPaymentNotes(v.payment_notes ?? '')
          setFollowupDate(v.followup_date ?? '')
          setFollowupNotes(v.followup_notes ?? '')
          setPageStatus('done')
        }
      })
      .catch((err) => {
        if (!cancelled) setPageStatus(err.response?.status === 404 ? 'not-found' : 'error')
      })
    return () => { cancelled = true }
  }, [visitId])

  function startEdit() {
    setEditVisitedAt(isoToLocal(visit.visited_at))
    setEditNotes(visit.consultation_notes ?? '')
    setFieldErrors({})
    setApiError(null)
    setEditing(true)
  }

  async function cancelEdit() {
    const changed = editNotes !== (visit.consultation_notes ?? '') ||
      editVisitedAt !== isoToLocal(visit.visited_at)
    if (changed) {
      const ok = await confirmDiscard()
      if (!ok) return
    }
    setEditing(false)
    setFieldErrors({})
    setApiError(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!editVisitedAt) {
      setFieldErrors({ visitedAt: 'Visit date and time is required.' })
      return
    }
    setSaving(true)
    setApiError(null)
    setFieldErrors({})
    try {
      const { data } = await updateVisit(visitId, {
        visited_at:         new Date(editVisitedAt).toISOString(),
        consultation_notes: editNotes.trim() || null,
      })
      setVisit(data)
      setEditing(false)
      toast.success('Visit updated')
    } catch (err) {
      const body = err.response?.data
      if (err.response?.status === 422 && body?.errors) {
        const errs = {}
        Object.entries(body.errors).forEach(([k, msgs]) => { errs[k] = Array.isArray(msgs) ? msgs[0] : msgs })
        setFieldErrors(errs)
      } else {
        setApiError(body?.message ?? 'Could not save changes — please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFee() {
    const feeErr = validateFee(feeInput)
    if (feeErr) { toast.error(feeErr); return }
    setSavingFee(true)
    setFeeSaved(false)
    try {
      const fee = feeInput ? parseFloat(feeInput) : 0
      const { data } = await saveFee(visitId, fee)
      setVisit(data)
      setFeeSaved(true)
      setTimeout(() => setFeeSaved(false), 2000)
    } catch {
      toast.error('Could not save fee — try again.')
    } finally {
      setSavingFee(false)
    }
  }

  async function handleSavePayment() {
    if (paymentStatus === 'partial') {
      const amt = parseFloat(amountPaid || '0')
      if (isNaN(amt) || amt < 0) { toast.error('Amount paid cannot be negative.'); return }
      const fee = parseFloat(feeInput || '0') || 0
      if (fee > 0 && amt > fee) { toast.error('Amount paid cannot exceed the consultation fee.'); return }
    }
    setSavingPayment(true)
    try {
      const { data } = await recordVisitPayment(visitId, {
        payment_status: paymentStatus,
        amount_paid:    paymentStatus === 'paid'
          ? parseFloat(feeInput || '0') || 0
          : paymentStatus === 'partial'
            ? parseFloat(amountPaid || '0') || 0
            : 0,
        payment_notes: paymentNotes.trim() || null,
      })
      setVisit(data)
      setPaymentStatus(data.payment_status)
      toast.success('Payment status saved')
    } catch {
      toast.error('Could not save payment — try again.')
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleSaveFollowup() {
    if (followupDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (new Date(followupDate) < today) {
        toast.error('Follow-up date must be today or in the future.')
        return
      }
    }
    setSavingFollowup(true)
    try {
      const updated = await updateFollowup(visitId, followupDate || null, followupNotes.trim() || null)
      setVisit(updated)
      setFollowupSaved(true)
      setTimeout(() => setFollowupSaved(false), 2000)
      toast.success(followupDate ? 'Follow-up scheduled' : 'Follow-up cleared')
    } catch {
      toast.error('Could not save follow-up')
    } finally {
      setSavingFollowup(false)
    }
  }

  async function handleComplete() {
    setCompleting(true)
    setConfirmComplete(false)
    try {
      const fee = feeInput ? parseFloat(feeInput) : null
      const { data } = await completeVisit(visitId, fee)
      setVisit(data)
      toast.success('Visit completed', { description: 'Invoice recorded.', duration: 4000 })
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not complete visit — try again.')
    } finally {
      setCompleting(false)
    }
  }

  /* ── Loading / error screens ─────────────────────────────────────────── */

  if (pageStatus === 'loading') {
    return <PageLoader />
  }
  if (pageStatus === 'not-found') return <div className="card state-panel">Visit not found.</div>
  if (pageStatus === 'error')     return <div className="card state-panel">Could not load visit.</div>

  const isOpen      = (visit.status ?? 'open') === 'open'
  const isCompleted = visit.status === 'completed'

  const consultFee  = parseFloat(feeInput || '0') || 0
  const medTotal    = visit.medicine_total ?? 0
  const grandTotal  = consultFee + medTotal
  const hasPharmacy = medTotal > 0

  return (
    <div>
      <button className="btn-link detail-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* Header card */}
      <div className="card detail-header-card">
        <div
          className="detail-avatar"
          style={{ background: avatarColor(visit.patient.name), color: '#fff' }}
        >
          {visit.patient.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="detail-name">{visit.patient.name}</h2>
          <div className="detail-sub">{fmtDateTime(visit.visited_at)}</div>
          {visit.doctor && (
            <div className="visit-attending">{doctorLabel(visit.doctor.name)}</div>
          )}
        </div>
        <div className="detail-actions" style={{ alignItems: 'center', gap: '8px' }}>
          <span className={`vst-status-badge vst-status-badge--${visit.status ?? 'open'}`}>
            {isCompleted ? 'Completed' : 'Open'}
          </span>
          {!editing && isOpen && (
            <>
              <button className="btn-secondary" onClick={startEdit}>Edit</button>
              <button
                className="btn-primary"
                onClick={() => navigate(`/visits/${visitId}/prescriptions/new`)}
              >
                + Prescription
              </button>
            </>
          )}
        </div>
      </div>

      {/* API error */}
      {apiError && (
        <div className="form-alert danger" style={{ marginTop: 'var(--space-md)' }}>
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      {/* Consultation notes card */}
      <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
        {editing ? (
          <form onSubmit={handleSave} className="form-enter">
            <div className="form-stack">
              <div className="field-group">
                <label className="field-label">Visit Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className={`field${fieldErrors.visitedAt || fieldErrors.visited_at ? ' has-error' : ''}`}
                  value={editVisitedAt}
                  onChange={(e) => setEditVisitedAt(e.target.value)}
                />
                {(fieldErrors.visitedAt || fieldErrors.visited_at) && (
                  <span className="field-error-msg">{fieldErrors.visitedAt ?? fieldErrors.visited_at}</span>
                )}
              </div>
              <div className="field-group">
                <label className="field-label">Consultation Notes</label>
                <textarea
                  className={`field visit-notes-textarea${fieldErrors.consultation_notes ? ' has-error' : ''}`}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  autoFocus
                />
                {fieldErrors.consultation_notes && (
                  <span className="field-error-msg">{fieldErrors.consultation_notes}</span>
                )}
              </div>
            </div>
            <div className="visit-form-actions">
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <span className="visit-notes-section-label">Consultation Notes</span>
            {visit.consultation_notes ? (
              <p className="visit-notes-display">{visit.consultation_notes}</p>
            ) : (
              <p className="visit-notes-empty">No consultation notes recorded.</p>
            )}
          </>
        )}
      </div>

      {/* ── SOAP Notes ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
        <span className="visit-notes-section-label" style={{ display: 'block', marginBottom: 'var(--space-md)' }}>
          SOAP Notes
        </span>
        <SoapNotesSection visitId={visitId} />
      </div>

      {/* ── Follow-up ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
        <span className="visit-notes-section-label" style={{ display: 'block', marginBottom: 'var(--space-md)' }}>
          Follow-up
        </span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--clr-text-muted)', fontWeight: 600 }}>Follow-up Date</label>
            <input
              type="date"
              className="field"
              style={{ width: 180 }}
              value={followupDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setFollowupDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: 'var(--clr-text-muted)', fontWeight: 600 }}>Instructions / Reason</label>
            <input
              className="field"
              placeholder="e.g. Check BP, Review reports…"
              value={followupNotes}
              onChange={e => setFollowupNotes(e.target.value)}
            />
          </div>
          <button
            className={`rx-action-btn${followupSaved ? ' vst-save-fee-btn--saved' : ''}`}
            onClick={handleSaveFollowup}
            disabled={savingFollowup}
            style={{ marginBottom: 1 }}
          >
            {savingFollowup ? <Spinner size={12} /> : null}
            {savingFollowup ? 'Saving…' : followupSaved ? '✓ Saved' : 'Save Follow-up'}
          </button>
          {followupDate && (
            <button className="rx-action-btn" onClick={() => { setFollowupDate(''); setFollowupNotes('') }} style={{ marginBottom: 1, fontSize: 12 }}>
              Clear
            </button>
          )}
        </div>
        {visit.followup_date && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--clr-primary)', fontWeight: 600 }}>
            ✓ Follow-up on {new Date(visit.followup_date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {visit.followup_notes && ` — ${visit.followup_notes}`}
          </div>
        )}
      </div>

      {/* ── Visit Vitals ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
        <VitalSignsTab patientId={String(visit.patient.id)} visitId={visitId} />
      </div>

      {/* ── Billing / Invoice card ─────────────────────────────────────── */}
      <div className="card vst-billing-card" style={{ marginTop: 'var(--space-md)' }}>

        <div className="vst-billing-head">
          <span className="vst-billing-head-label">Billing &amp; Invoice</span>
          {isCompleted && visit.invoiced_at && (
            <span className="vst-billing-head-date">Completed {fmtDateTime(visit.invoiced_at)}</span>
          )}
        </div>

        <div className="vst-billing-body">

          {/* Consultation fee */}
          <div className="vst-billing-row">
            <span className="vst-billing-row-label">Consultation Fee</span>
            {isOpen ? (
              <div className="vst-fee-row">
                <div className="vst-billing-fee-wrap">
                  <span className="vst-billing-currency">₹</span>
                  <input
                    className="vst-billing-fee-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={feeInput}
                    onChange={e => { setFeeInput(e.target.value); setFeeSaved(false) }}
                  />
                </div>
                <button
                  className={`vst-save-fee-btn${feeSaved ? ' vst-save-fee-btn--saved' : ''}`}
                  onClick={handleSaveFee}
                  disabled={savingFee}
                  title="Save consultation fee"
                >
                  {savingFee ? <Spinner size={12} /> : feeSaved ? <IconCheck size={12} /> : <IconSave />}
                  {savingFee ? 'Saving…' : feeSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            ) : (
              <span className="vst-billing-row-value">₹{fmtPrice(visit.consultation_fee)}</span>
            )}
          </div>

          {/* Medicine total */}
          <div className="vst-billing-row">
            <span className="vst-billing-row-label">
              Medicine Total
              {hasPharmacy && <span className="vst-billing-source"> (from pharmacy)</span>}
            </span>
            <span className={`vst-billing-row-value${!hasPharmacy ? ' vst-billing-row-value--muted' : ''}`}>
              {hasPharmacy ? `₹${fmtPrice(medTotal)}` : '—'}
            </span>
          </div>

          <div className="vst-billing-total-row">
            <span className="vst-billing-total-label">Grand Total</span>
            <span className="vst-billing-total-amount">
              ₹{fmtPrice(isCompleted ? (parseFloat(visit.consultation_fee ?? 0) + medTotal) : grandTotal)}
            </span>
          </div>
        </div>

        {/* ── Payment Status ──────────────────────────────────────── */}
        <div className="vst-payment-section">
          <div className="vst-payment-head">
            <span className="vst-payment-label">Payment Status</span>
            <div className="vst-payment-pills">
              {['unpaid', 'partial', 'paid'].map(s => (
                <button
                  key={s}
                  className={`vst-payment-pill vst-payment-pill--${s}${paymentStatus === s ? ' vst-payment-pill--on' : ''}`}
                  onClick={() => setPaymentStatus(s)}
                >
                  {s === 'unpaid' ? 'Unpaid' : s === 'partial' ? 'Partial' : 'Paid'}
                </button>
              ))}
            </div>
          </div>

          {paymentStatus === 'partial' && (
            <div className="vst-payment-partial-row">
              <span className="vst-payment-partial-label">Amount Paid</span>
              <div className="vst-billing-fee-wrap" style={{ width: '140px' }}>
                <span className="vst-billing-currency">₹</span>
                <input
                  className="vst-billing-fee-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                />
              </div>
            </div>
          )}

          <textarea
            className="field vst-payment-notes-input"
            rows={1}
            placeholder="Payment notes (optional)…"
            value={paymentNotes}
            onChange={e => setPaymentNotes(e.target.value)}
          />

          <button
            className="rx-action-btn vst-save-payment-btn"
            onClick={handleSavePayment}
            disabled={savingPayment}
          >
            {savingPayment ? <Spinner size={12} /> : null}
            {savingPayment ? 'Saving…' : 'Save Payment'}
          </button>
        </div>

        {/* Actions */}
        <div className="vst-billing-actions">

          {/* Doctor invoice — always available */}
          <button
            className="rx-action-btn vst-invoice-btn"
            onClick={() => navigate(`/visits/${visitId}/invoice`)}
          >
            <IconPrint />
            Doctor Invoice
          </button>

          {/* Complete visit */}
          {isOpen && !confirmComplete && (
            <button
              className="rx-action-btn"
              onClick={() => setConfirmComplete(true)}
              disabled={completing}
            >
              <IconCheck size={12} />
              Complete Visit
            </button>
          )}

          {isOpen && confirmComplete && (
            <div className="rx-send-confirm">
              <span className="rx-send-confirm-label">Mark visit as complete?</span>
              <button className="rx-action-btn rx-action-btn--primary" onClick={handleComplete} disabled={completing}>
                {completing ? <Spinner size={12} /> : null}
                {completing ? 'Completing…' : 'Yes, Complete'}
              </button>
              <button className="rx-action-btn" onClick={() => setConfirmComplete(false)} disabled={completing}>
                Cancel
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="pharma-done-pill">
              <IconCheck size={13} />
              Visit Complete
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
