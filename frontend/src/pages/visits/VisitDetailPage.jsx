import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getVisit, updateVisit, completeVisit } from '../../services/visitService'
import Spinner from '../../components/ui/Spinner'

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
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
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

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

export default function VisitDetailPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()

  const [visit,      setVisit]      = useState(null)
  const [pageStatus, setPageStatus] = useState('loading')

  /* edit form state */
  const [editing,       setEditing]       = useState(false)
  const [editVisitedAt, setEditVisitedAt] = useState('')
  const [editNotes,     setEditNotes]     = useState('')
  const [fieldErrors,   setFieldErrors]   = useState({})
  const [apiError,      setApiError]      = useState(null)
  const [saving,        setSaving]        = useState(false)

  /* billing state */
  const [feeInput,         setFeeInput]         = useState('')
  const [completing,       setCompleting]       = useState(false)
  const [confirmComplete,  setConfirmComplete]  = useState(false)

  useEffect(() => {
    let cancelled = false
    getVisit(visitId)
      .then(({ data }) => {
        if (!cancelled) {
          setVisit(data.data)
          const fee = data.data.consultation_fee
          setFeeInput(fee > 0 ? String(fee) : '')
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

  function cancelEdit() {
    const changed = editNotes !== (visit.consultation_notes ?? '') ||
      editVisitedAt !== isoToLocal(visit.visited_at)
    if (changed && !window.confirm('Discard changes?')) return
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
        visited_at:         editVisitedAt,
        consultation_notes: editNotes.trim() || null,
      })
      setVisit(data.data)
      setEditing(false)
    } catch (err) {
      const httpStatus = err.response?.status
      const body = err.response?.data
      if (httpStatus === 422 && body?.errors) {
        const sErrs = {}
        Object.entries(body.errors).forEach(([k, msgs]) => {
          sErrs[k] = Array.isArray(msgs) ? msgs[0] : msgs
        })
        setFieldErrors(sErrs)
      } else {
        setApiError(body?.message ?? 'Could not save changes — please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete() {
    setCompleting(true)
    setConfirmComplete(false)
    try {
      const fee = feeInput ? parseFloat(feeInput) : null
      const { data } = await completeVisit(visitId, fee)
      setVisit(data.data)
      toast.success('Visit completed', {
        description: 'Invoice has been recorded.',
        duration: 4000,
      })
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Could not complete visit — try again.'
      toast.error(msg)
    } finally {
      setCompleting(false)
    }
  }

  /* ── Loading / error screens ────────────────────────────────────────── */

  if (pageStatus === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: 'var(--clr-text-muted)' }}>
        <Spinner size={28} />
      </div>
    )
  }
  if (pageStatus === 'not-found') return <div className="card state-panel">Visit not found.</div>
  if (pageStatus === 'error')     return <div className="card state-panel">Could not load visit — check your connection.</div>

  /* ── Derived values ─────────────────────────────────────────────────── */

  const isOpen      = (visit.status ?? 'open') === 'open'
  const isCompleted = visit.status === 'completed'

  const consultFee  = parseFloat(feeInput || '0') || 0
  const medTotal    = visit.medicine_total ?? 0
  const grandTotal  = consultFee + medTotal

  const hasPharmacyTotal = medTotal > 0

  return (
    <div>
      <button
        className="btn-link detail-back"
        onClick={() => navigate(`/patients/${visit.patient.id}`)}
      >
        ← {visit.patient.name}
      </button>

      {/* Header card */}
      <div className="card detail-header-card">
        <div className="detail-avatar">{visit.patient.name[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="detail-name">{visit.patient.name}</h2>
          <div className="detail-sub">{fmtDateTime(visit.visited_at)}</div>
          {visit.doctor && (
            <div className="visit-attending">Dr. {visit.doctor.name}</div>
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
                style={{ width: 'auto' }}
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

      {/* Consultation notes */}
      <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
        {editing ? (
          <form onSubmit={handleSave}>
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
                  <span className="field-error-msg">
                    {fieldErrors.visitedAt ?? fieldErrors.visited_at}
                  </span>
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
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
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

      {/* ── Billing / Invoice card ──────────────────────────────────────── */}
      <div className="card vst-billing-card" style={{ marginTop: 'var(--space-md)' }}>

        {/* Card header */}
        <div className="vst-billing-head">
          <span className="vst-billing-head-label">Billing &amp; Invoice</span>
          {isCompleted && visit.invoiced_at && (
            <span className="vst-billing-head-date">
              Invoiced {fmtDateTime(visit.invoiced_at)}
            </span>
          )}
        </div>

        {/* Rows */}
        <div className="vst-billing-body">

          {/* Consultation fee */}
          <div className="vst-billing-row">
            <span className="vst-billing-row-label">Consultation Fee</span>
            {isOpen ? (
              <div className="vst-billing-fee-wrap">
                <span className="vst-billing-currency">₹</span>
                <input
                  className="vst-billing-fee-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={feeInput}
                  onChange={e => setFeeInput(e.target.value)}
                />
              </div>
            ) : (
              <span className="vst-billing-row-value">₹{fmtPrice(visit.consultation_fee)}</span>
            )}
          </div>

          {/* Medicine total from pharmacy */}
          <div className="vst-billing-row">
            <span className="vst-billing-row-label">
              Medicine Total
              {hasPharmacyTotal && (
                <span className="vst-billing-source"> (from pharmacy)</span>
              )}
            </span>
            <span className={`vst-billing-row-value${!hasPharmacyTotal ? ' vst-billing-row-value--muted' : ''}`}>
              {hasPharmacyTotal ? `₹${fmtPrice(medTotal)}` : '—'}
            </span>
          </div>

          {/* Divider + Grand total */}
          <div className="vst-billing-total-row">
            <span className="vst-billing-total-label">Grand Total</span>
            <span className="vst-billing-total-amount">₹{fmtPrice(isCompleted ? (visit.consultation_fee + medTotal) : grandTotal)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="vst-billing-actions">
          {isOpen && !confirmComplete && (
            <button
              className="rx-action-btn rx-action-btn--primary"
              onClick={() => setConfirmComplete(true)}
              disabled={completing}
            >
              <IconCheck size={13} />
              Complete Visit
            </button>
          )}

          {isOpen && confirmComplete && (
            <div className="rx-send-confirm">
              <span className="rx-send-confirm-label">Mark visit as complete &amp; save invoice?</span>
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

          {isCompleted && (
            <div className="pharma-done-pill">
              <IconCheck size={13} />
              Visit Complete
            </div>
          )}

          <button
            className="rx-action-btn"
            onClick={() => window.open(`/visits/${visitId}/invoice`, '_blank')}
          >
            <IconPrint />
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  )
}
