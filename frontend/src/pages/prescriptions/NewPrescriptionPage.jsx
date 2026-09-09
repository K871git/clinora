import '../../styles/prescriptions-detail.css'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVisit } from '../../services/visitService'
import { createPrescription } from '../../services/prescriptionService'
import MedicineEditor from './MedicineEditor'
import { newMedicineItem } from './medicineUtils'
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

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Convert editor items to the API payload shape */
function itemsForApi(items) {
  return items.map((item, idx) => ({
    medicine_name: item.medicine_name.trim(),
    dosage:        item.dosage.trim()        || null,
    frequency:     item.frequency.trim()     || null,
    duration:      item.duration.trim()      || null,
    instructions:  item.instructions.trim()  || null,
    sort_order:    idx,
  }))
}

/** Parse server 422 errors into { fieldErrors, itemErrors } shape */
function parseServerErrors(serverErrors) {
  const errs = {}
  const itemErrs = []
  Object.entries(serverErrors).forEach(([k, msgs]) => {
    const msg = Array.isArray(msgs) ? msgs[0] : msgs
    const m = k.match(/^items\.(\d+)\.(.+)$/)
    if (m) {
      const idx = parseInt(m[1])
      if (!itemErrs[idx]) itemErrs[idx] = {}
      itemErrs[idx][m[2]] = msg
    } else {
      errs[k === 'prescribed_at' ? 'prescribedAt' : k] = msg
    }
  })
  if (itemErrs.length) errs.itemErrors = itemErrs
  return errs
}

export default function NewPrescriptionPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()

  const [visit, setVisit] = useState(null)
  const [visitStatus, setVisitStatus] = useState('loading')

  const [prescribedAt, setPrescribedAt] = useState(() => nowLocal())
  const [doctorNotes, setDoctorNotes] = useState('')
  const [items, setItems] = useState(() => [newMedicineItem()])
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Load visit for patient context — setState only in async callbacks
  useEffect(() => {
    let cancelled = false
    getVisit(visitId)
      .then(({ data }) => {
        if (!cancelled) {
          setVisit(data.data)
          setVisitStatus('done')
        }
      })
      .catch((err) => {
        if (!cancelled) setVisitStatus(err.response?.status === 404 ? 'not-found' : 'error')
      })
    return () => { cancelled = true }
  }, [visitId])

  async function handleCancel() {
    if (items.length > 0) {
      const ok = await confirmDiscard({ title: 'Discard this prescription?', text: 'All added medicines will be lost.' })
      if (!ok) return
    }
    navigate(-1)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Client-side validation
    const errs = {}
    if (!prescribedAt) errs.prescribedAt = 'Prescription date is required.'
    if (items.length === 0) {
      errs.items = 'Add at least one medicine before saving.'
    } else {
      const itemErrs = items.map(item =>
        !item.medicine_name.trim() ? { medicine_name: 'Medicine name is required.' } : null
      )
      if (itemErrs.some(Boolean)) errs.itemErrors = itemErrs
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setSubmitting(true)
    setApiError(null)
    setFieldErrors({})

    try {
      const { data } = await createPrescription(visitId, {
        prescribed_at: prescribedAt,
        doctor_notes:  doctorNotes.trim() || null,
        items:         itemsForApi(items),
      })
      navigate(`/prescriptions/${data.data.id}`, { replace: true })
    } catch (err) {
      const httpStatus = err.response?.status
      const body = err.response?.data
      if (httpStatus === 422 && body?.errors) {
        setFieldErrors(parseServerErrors(body.errors))
      } else {
        setApiError(body?.message ?? 'Could not save prescription — please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Loading / error screens ─────────────────────────────────────── */

  if (visitStatus === 'loading') return <PageLoader />
  if (visitStatus === 'not-found') return <div className="card state-panel">Visit not found.</div>
  if (visitStatus === 'error')     return <div className="card state-panel">Could not load visit — check your connection.</div>

  /* ── Form ─────────────────────────────────────────────────────────── */

  return (
    <div>
      <button className="btn-link detail-back" onClick={handleCancel}>
        ← {visit.patient.name}
        {visit.visited_at && (
          <span className="nrx-sub">/ {fmtDate(visit.visited_at)}</span>
        )}
      </button>

      <h1 className="visit-page-title">New Prescription</h1>

      {apiError && (
        <div className="form-alert danger nrx-api-err">
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Prescription date */}
        <div className="card nrx-section">
          <div className="field-group nrx-date-wrap">
            <label className="field-label">Prescription Date &amp; Time</label>
            <input
              type="datetime-local"
              className={`field${fieldErrors.prescribedAt || fieldErrors.prescribed_at ? ' has-error' : ''}`}
              value={prescribedAt}
              onChange={e => setPrescribedAt(e.target.value)}
            />
            {(fieldErrors.prescribedAt || fieldErrors.prescribed_at) && (
              <span className="field-error-msg">
                {fieldErrors.prescribedAt ?? fieldErrors.prescribed_at}
              </span>
            )}
          </div>
        </div>

        {/* Medicine list */}
        <div className="card nrx-section">
          <h2 className="rx-section-title">Medicines</h2>
          {fieldErrors.items && (
            <span className="field-error-msg nrx-items-err">{fieldErrors.items}</span>
          )}
          <MedicineEditor
            items={items}
            onChange={setItems}
            itemErrors={fieldErrors.itemErrors}
          />
        </div>

        {/* Doctor notes */}
        <div className="card nrx-section">
          <div className="field-group">
            <label className="field-label">
              Doctor Notes <span className="nrx-opt">(optional)</span>
            </label>
            <textarea
              className="field nrx-notes"
              placeholder="Additional notes for the pharmacist or patient record…"
              value={doctorNotes}
              onChange={e => setDoctorNotes(e.target.value)}
            />
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
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Prescription'}
          </button>
        </div>

      </form>
    </div>
  )
}
