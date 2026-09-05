import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPatient } from '../../services/patientService'
import { createVisit } from '../../services/visitService'
import Spinner from '../../components/ui/Spinner'

/** Returns current date-time as a datetime-local input value (local timezone) */
function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function NewVisitPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [patientStatus, setPatientStatus] = useState('loading')

  const [visitedAt, setVisitedAt] = useState(() => nowLocal())
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Load patient name for context — setState only in async callbacks
  useEffect(() => {
    let cancelled = false
    getPatient(id)
      .then(({ data }) => {
        if (!cancelled) {
          setPatient(data.data)
          setPatientStatus('done')
        }
      })
      .catch((err) => {
        if (!cancelled) setPatientStatus(err.response?.status === 404 ? 'not-found' : 'error')
      })
    return () => { cancelled = true }
  }, [id])

  function handleCancel() {
    if (notes.trim() && !window.confirm('Discard consultation notes?')) return
    navigate(`/patients/${id}`)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!visitedAt) {
      setFieldErrors({ visitedAt: 'Visit date and time is required.' })
      return
    }

    setSubmitting(true)
    setApiError(null)
    setFieldErrors({})

    try {
      const { data } = await createVisit(id, {
        visited_at: visitedAt,
        consultation_notes: notes.trim() || null,
      })
      navigate(`/visits/${data.data.id}`, { replace: true })
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
        setApiError(body?.message ?? 'Could not save visit — please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (patientStatus === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: 'var(--clr-text-muted)' }}>
        <Spinner size={28} />
      </div>
    )
  }

  if (patientStatus === 'not-found') {
    return <div className="card state-panel">Patient not found.</div>
  }

  if (patientStatus === 'error') {
    return <div className="card state-panel">Could not load patient — check your connection.</div>
  }

  return (
    <div>
      <button className="btn-link detail-back" onClick={handleCancel}>
        ← {patient.name}
      </button>

      <h1 className="visit-page-title">New Visit</h1>

      {apiError && (
        <div className="form-alert danger" style={{ marginBottom: 'var(--space-md)' }}>
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      <div className="card" style={{ padding: 'var(--space-lg)' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-stack">

            <div className="field-group">
              <label className="field-label">Visit Date &amp; Time</label>
              <input
                type="datetime-local"
                className={`field${fieldErrors.visitedAt || fieldErrors.visited_at ? ' has-error' : ''}`}
                value={visitedAt}
                onChange={(e) => setVisitedAt(e.target.value)}
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
                className="field visit-notes-textarea"
                placeholder="Enter consultation notes, diagnosis, and treatment plan…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                // autoFocus: textarea only mounts after patient loads, so this triggers at the right time
                autoFocus
              />
              {fieldErrors.consultation_notes && (
                <span className="field-error-msg">{fieldErrors.consultation_notes}</span>
              )}
            </div>

          </div>

          <div className="visit-form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto' }}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
