import '../../styles/new-visit.css'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPatient } from '../../services/patientService'
import { createVisit, saveFee, completeVisit } from '../../services/visitService'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import { confirmDiscard } from '../../lib/swal'

function nowLocal() {
  const d = new Date()
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  const h  = String(d.getHours()).padStart(2, '0')
  const m  = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${dy}T${h}:${m}`
}

function IconCalendar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconNotes() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconFee() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}

export default function NewVisitPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient,       setPatient]       = useState(null)
  const [patientStatus, setPatientStatus] = useState('loading')
  const [visitedAt,     setVisitedAt]     = useState(() => nowLocal())
  const [notes,         setNotes]         = useState('')
  const [fee,           setFee]           = useState('')
  const [fieldErrors,   setFieldErrors]   = useState({})
  const [apiError,      setApiError]      = useState(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [activeAction,  setActiveAction]  = useState(null)

  useEffect(() => {
    let cancelled = false
    getPatient(id)
      .then(({ data }) => {
        if (!cancelled) { setPatient(data); setPatientStatus('done') }
      })
      .catch((err) => {
        if (!cancelled) setPatientStatus(err.response?.status === 404 ? 'not-found' : 'error')
      })
    return () => { cancelled = true }
  }, [id])

  async function handleCancel() {
    if (notes.trim()) {
      const ok = await confirmDiscard({ title: 'Discard consultation notes?', text: 'The notes you typed will be lost.' })
      if (!ok) return
    }
    navigate(-1)
  }

  async function submit(action) {
    if (!visitedAt) {
      setFieldErrors({ visitedAt: 'Visit date and time is required.' })
      return
    }
    setSubmitting(true)
    setActiveAction(action)
    setApiError(null)
    setFieldErrors({})
    try {
      const { data } = await createVisit(id, {
        visited_at:         new Date(visitedAt).toISOString(),
        consultation_notes: notes.trim() || null,
      })
      const visitId = data.id
      const feeVal  = fee ? parseFloat(fee) : null

      if (action === 'complete') {
        await completeVisit(visitId, feeVal)
        navigate(`/visits/${visitId}`, { replace: true })
      } else if (action === 'prescription') {
        if (feeVal) await saveFee(visitId, feeVal)
        navigate(`/visits/${visitId}/prescriptions/new`, { replace: true })
      } else {
        if (feeVal) await saveFee(visitId, feeVal)
        navigate(`/visits/${visitId}`, { replace: true })
      }
    } catch (err) {
      const body = err.response?.data
      if (err.response?.status === 422 && body?.errors) {
        const errs = {}
        Object.entries(body.errors).forEach(([k, msgs]) => { errs[k] = Array.isArray(msgs) ? msgs[0] : msgs })
        setFieldErrors(errs)
      } else {
        setApiError(body?.message ?? 'Could not save visit — please try again.')
      }
    } finally {
      setSubmitting(false)
      setActiveAction(null)
    }
  }

  if (patientStatus === 'loading') {
    return <PageLoader />
  }
  if (patientStatus === 'not-found') return <div className="card state-panel">Patient not found.</div>
  if (patientStatus === 'error')     return <div className="card state-panel">Could not load patient.</div>

  const patientMeta = [
    patient.age != null && `${patient.age} yrs`,
    patient.gender,
  ].filter(Boolean).join(' · ')

  return (
    <div className="nvp-page">

      <button className="btn-link detail-back" onClick={handleCancel}>
        ← {patient.name}
      </button>

      {apiError && (
        <div className="form-alert danger nvp-api-err">
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      <div className="card nvp-card">

        {/* Patient context strip */}
        <div className="nvp-patient-strip">
          <div className="nvp-patient-avatar">{patient.name[0].toUpperCase()}</div>
          <div className="nvp-patient-info">
            <div className="nvp-patient-name">{patient.name}</div>
            {patientMeta && <div className="nvp-patient-meta">{patientMeta}</div>}
          </div>
          <div className="nvp-badge">New Visit</div>
        </div>

        <div className="nvp-divider" />

        <div className="nvp-form">

          {/* Date & Time */}
          <div className="nvp-field-group">
            <label className="nvp-label">
              <span className="nvp-label-icon"><IconCalendar /></span>
              Visit Date &amp; Time
            </label>
            <input
              type="datetime-local"
              className={`field nvp-field${fieldErrors.visitedAt || fieldErrors.visited_at ? ' has-error' : ''}`}
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
            />
            {(fieldErrors.visitedAt || fieldErrors.visited_at) && (
              <span className="field-error-msg">
                {fieldErrors.visitedAt ?? fieldErrors.visited_at}
              </span>
            )}
          </div>

          {/* Notes */}
          <div className="nvp-field-group">
            <label className="nvp-label">
              <span className="nvp-label-icon"><IconNotes /></span>
              Consultation Notes
              <span className="nvp-label-opt">optional</span>
            </label>
            <textarea
              className={`field nvp-notes${fieldErrors.consultation_notes ? ' has-error' : ''}`}
              placeholder="Symptoms, diagnosis, examination findings, treatment plan…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
            {fieldErrors.consultation_notes && (
              <span className="field-error-msg">{fieldErrors.consultation_notes}</span>
            )}
          </div>

          {/* Consultation Fee */}
          <div className="nvp-field-group">
            <label className="nvp-label">
              <span className="nvp-label-icon"><IconFee /></span>
              Consultation Fee
              <span className="nvp-label-opt">optional</span>
            </label>
            <div className="nvp-fee-wrap">
              <span className="nvp-fee-currency">₹</span>
              <input
                type="number"
                className="field nvp-fee-input"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={fee}
                onChange={e => setFee(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="nvp-actions nvp-actions--multi">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancel
            </button>

            <div className="nvp-primary-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => submit('complete')}
                disabled={submitting}
              >
                {submitting && activeAction === 'complete' ? <><Spinner size={12} /> Completing…</> : 'Complete Visit'}
              </button>
              <button
                type="button"
                className="btn-secondary nvp-btn-rx"
                onClick={() => submit('prescription')}
                disabled={submitting}
              >
                {submitting && activeAction === 'prescription' ? <><Spinner size={12} /> Saving…</> : '+ Prescription'}
              </button>
              <button
                type="button"
                className="btn-primary nvp-submit"
                onClick={() => submit('save')}
                disabled={submitting}
              >
                {submitting && activeAction === 'save' ? <><Spinner size={12} /> Saving…</> : 'Save Visit'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
