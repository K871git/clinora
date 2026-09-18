import '../../styles/prescriptions-detail.css'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { getVisit } from '../../services/visitService'
import { createPrescription } from '../../services/prescriptionService'
import { getPatientAllergies } from '../../services/medicalHistoryService'
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
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
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
  const [allergies, setAllergies] = useState([])

  const [prescribedAt, setPrescribedAt] = useState(() => nowLocal())
  const [doctorNotes, setDoctorNotes] = useState('')
  const [items, setItems] = useState(() => [newMedicineItem()])
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Templates
  const [templates,      setTemplates]      = useState([])
  const [tmplOpen,       setTmplOpen]       = useState(false)
  const [saveTmplOpen,   setSaveTmplOpen]   = useState(false)
  const [tmplName,       setTmplName]       = useState('')
  const [tmplSaving,     setTmplSaving]     = useState(false)
  const saveTmplRef = useRef(null)

  // Load visit for patient context — setState only in async callbacks
  useEffect(() => {
    let cancelled = false
    getVisit(visitId)
      .then(({ data }) => {
        if (!cancelled) {
          setVisit(data)
          setVisitStatus('done')
          // Fetch allergies silently after visit loads
          getPatientAllergies(data.patient_id)
            .then(a => { if (!cancelled) setAllergies(a ?? []) })
            .catch(() => {})
        }
      })
      .catch((err) => {
        if (!cancelled) setVisitStatus(err.response?.status === 404 ? 'not-found' : 'error')
      })
    return () => { cancelled = true }
  }, [visitId])

  function loadTemplates() {
    invoke('get_rx_templates').then(res => setTemplates(res.data ?? [])).catch(() => {})
  }

  function applyTemplate(tmpl) {
    const meds = (tmpl.medicines ?? []).map(m => ({
      ...newMedicineItem(),
      medicine_name: m.medicine_name ?? '',
      dosage:        m.dosage        ?? '',
      frequency:     m.frequency     ?? '',
      duration:      m.duration      ?? '',
      instructions:  m.instructions  ?? '',
    }))
    if (meds.length > 0) setItems(meds)
    if (tmpl.notes) setDoctorNotes(tmpl.notes)
    setTmplOpen(false)
  }

  async function handleSaveTemplate() {
    const name = tmplName.trim()
    if (!name) return
    const meds = items
      .filter(i => i.medicine_name.trim())
      .map(i => ({
        medicine_name: i.medicine_name.trim(),
        dosage:        i.dosage.trim()       || null,
        frequency:     i.frequency.trim()    || null,
        duration:      i.duration.trim()     || null,
        instructions:  i.instructions.trim() || null,
      }))
    if (meds.length === 0) return
    setTmplSaving(true)
    try {
      await invoke('save_rx_template', {
        data: { name, medicines: meds, notes: doctorNotes.trim() || null },
      })
      setTmplName('')
      setSaveTmplOpen(false)
    } catch (err) {
      alert(typeof err === 'string' ? err : 'Could not save template.')
    } finally { setTmplSaving(false) }
  }

  async function handleCancel() {
    if (items.length > 0) {
      const ok = await confirmDiscard({ title: 'Discard this prescription?', text: 'All added medicines will be lost.' })
      if (!ok) return
    }
    navigate(-1)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errs = {}
    if (!prescribedAt) errs.prescribedAt = 'Prescription date is required.'

    if (items.length === 0) {
      errs.items = 'Add at least one medicine before saving.'
    } else {
      const itemErrs = items.map(item =>
        !item.medicine_name.trim() ? { medicine_name: 'Medicine name is required.' } : null
      )
      if (itemErrs.some(Boolean)) errs.itemErrors = itemErrs

      // Duplicate medicine check
      const names = items.map(i => i.medicine_name.trim().toLowerCase()).filter(Boolean)
      const dupes = names.filter((n, i) => names.indexOf(n) !== i)
      if (dupes.length > 0) {
        errs.items = `Duplicate medicine: "${items.find(i => dupes.includes(i.medicine_name.trim().toLowerCase()))?.medicine_name}" is added more than once.`
      }

      // Missing dosage warning (non-blocking — stored as warning, not error)
      const missingDosage = items.filter(i => i.medicine_name.trim() && !i.dosage.trim())
      if (missingDosage.length > 0) {
        errs._dosageWarn = missingDosage.map(i => i.medicine_name.trim()).join(', ')
      }
    }

    // Block on hard errors only (not dosageWarn)
    const hardErrors = Object.fromEntries(Object.entries(errs).filter(([k]) => k !== '_dosageWarn'))
    if (Object.keys(hardErrors).length) { setFieldErrors(errs); return }

    // Dosage warning: show and require a second submit to confirm
    if (errs._dosageWarn && !fieldErrors._dosageWarnConfirmed) {
      setFieldErrors({ _dosageWarn: errs._dosageWarn, _dosageWarnConfirmed: false })
      return
    }

    setSubmitting(true)
    setApiError(null)
    setFieldErrors({})

    try {
      const { data } = await createPrescription(visitId, {
        prescribed_at: prescribedAt,
        doctor_notes:  doctorNotes.trim() || null,
        items:         itemsForApi(items),
      })
      navigate(`/prescriptions/${data.id}`, { replace: true })
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

      {/* ── Allergy alert ─────────────────────────────────────────────── */}
      {allergies.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.4)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          marginBottom: 'var(--space-md)', display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, marginBottom: 3 }}>
              Allergy Alert — {visit.patient.name}
            </div>
            <div style={{ fontSize: 12, color: '#dc2626' }}>
              {allergies.map((a, i) => (
                <span key={a.id}>
                  <strong>{a.title}</strong>
                  {a.severity && ` (${a.severity})`}
                  {i < allergies.length - 1 && ' · '}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <h1 className="visit-page-title">New Prescription</h1>

      {apiError && (
        <div className="form-alert danger nrx-api-err">
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      {fieldErrors._dosageWarn && (
        <div className="form-alert warning nrx-api-err">
          <strong className="form-alert-title">Missing dosage</strong>
          <p className="form-alert-body">
            No dosage set for: <strong>{fieldErrors._dosageWarn}</strong>.
            Click Save again to proceed without dosage, or go back and add it.
          </p>
          <button
            type="button"
            className="btn-link"
            style={{ fontSize: 12, marginTop: 4 }}
            onClick={() => setFieldErrors(f => ({ ...f, _dosageWarnConfirmed: true }))}
          >
            Save anyway →
          </button>
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
          <div className="nrx-medicines-head">
            <h2 className="rx-section-title" style={{ margin: 0 }}>Medicines</h2>
            <button
              type="button"
              className="nrx-tmpl-load-btn"
              onClick={() => { loadTemplates(); setTmplOpen(true) }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Load Template
            </button>
          </div>

          {/* Template picker */}
          {tmplOpen && (
            <div className="nrx-tmpl-picker">
              {templates.length === 0 ? (
                <p className="nrx-tmpl-empty">No templates saved yet. Save one from the bottom of this page.</p>
              ) : (
                <div className="nrx-tmpl-chips">
                  {templates.map(t => (
                    <button key={t.id} type="button" className="nrx-tmpl-chip" onClick={() => applyTemplate(t)}>
                      {t.name}
                      <span className="nrx-tmpl-chip-count">({t.medicines?.length ?? 0})</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="nrx-tmpl-dismiss" onClick={() => setTmplOpen(false)}>
                Dismiss
              </button>
            </div>
          )}

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

        <div className="visit-form-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </button>

          {/* Save as template */}
          <div className="nrx-tmpl-save-wrap" ref={saveTmplRef}>
            <button
              type="button"
              className="nrx-tmpl-save-btn"
              onClick={() => setSaveTmplOpen(o => !o)}
              disabled={submitting}
            >
              Save as Template
            </button>
            {saveTmplOpen && (
              <div className="nrx-tmpl-popover">
                <div className="nrx-tmpl-popover-title">Template Name</div>
                <input
                  className="field nrx-tmpl-popover-input"
                  placeholder="e.g. Upper Respiratory Infection"
                  value={tmplName}
                  onChange={e => setTmplName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                  autoFocus
                />
                <div className="nrx-tmpl-popover-actions">
                  <button
                    type="button"
                    className="nrx-tmpl-popover-save"
                    disabled={tmplSaving || !tmplName.trim()}
                    onClick={handleSaveTemplate}
                  >
                    {tmplSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="nrx-tmpl-popover-cancel"
                    onClick={() => { setSaveTmplOpen(false); setTmplName('') }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Prescription'}
          </button>
        </div>

      </form>
    </div>
  )
}
