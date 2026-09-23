import '../../styles/prescriptions-detail.css'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getPrescription,
  updatePrescription,
  sendPrescription,
  deletePrescription,
} from '../../services/prescriptionService'
import { getSettings } from '../../services/settingsService'
import MedicineEditor from './MedicineEditor'
import { newMedicineItem } from './medicineUtils'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import { confirmDelete, confirmDiscard } from '../../lib/swal'

const STATUS_LABEL = {
  draft:            'Draft',
  sent_to_pharmacy: 'Sent to Pharmacy',
  dispensing:       'Dispensing',
  completed:        'Completed',
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
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

function itemsFromApi(apiItems) {
  return (apiItems ?? []).map(src => newMedicineItem({
    medicine_name: src.medicine_name,
    dosage:        src.dosage        ?? '',
    frequency:     src.frequency     ?? '',
    duration:      src.duration      ?? '',
    instructions:  src.instructions  ?? '',
  }))
}

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

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

const IconPdf = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
)
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
)
const IconInvoice = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
    <line x1="8" y1="16" x2="12" y2="16"/>
  </svg>
)

export default function PrescriptionDetailPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()

  const [prescription, setPrescription] = useState(null)
  const [pageStatus, setPageStatus]     = useState('loading')

  const [editing,          setEditing]          = useState(false)
  const [editPrescribedAt, setEditPrescribedAt] = useState('')
  const [editDoctorNotes,  setEditDoctorNotes]  = useState('')
  const [editItems,        setEditItems]        = useState([])
  const [fieldErrors,      setFieldErrors]      = useState({})
  const [apiError,         setApiError]         = useState(null)
  const [saving,           setSaving]           = useState(false)

  const [sending,      setSending]      = useState(false)
  const [confirmSend,  setConfirmSend]  = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [pdfError,     setPdfError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    getPrescription(prescriptionId)
      .then(({ data }) => {
        if (!cancelled) { setPrescription(data); setPageStatus('done') }
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

  function startEdit() {
    setEditPrescribedAt(isoToLocal(prescription.prescribed_at))
    setEditDoctorNotes(prescription.doctor_notes ?? '')
    setEditItems(itemsFromApi(prescription.items ?? []))
    setFieldErrors({}); setApiError(null); setEditing(true)
  }

  async function cancelEdit() {
    const changed =
      editDoctorNotes  !== (prescription.doctor_notes ?? '')      ||
      editPrescribedAt !== isoToLocal(prescription.prescribed_at) ||
      editItems.length !== (prescription.items?.length ?? 0)
    if (changed) {
      const ok = await confirmDiscard()
      if (!ok) return
    }
    setEditing(false); setFieldErrors({}); setApiError(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    const errs = {}
    if (!editPrescribedAt) errs.prescribedAt = 'Prescription date is required.'
    if (editItems.length === 0) {
      errs.items = 'Add at least one medicine.'
    } else {
      const itemErrs = editItems.map(item =>
        !item.medicine_name.trim() ? { medicine_name: 'Medicine name is required.' } : null
      )
      if (itemErrs.some(Boolean)) errs.itemErrors = itemErrs
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    setSaving(true); setApiError(null); setFieldErrors({})
    try {
      const { data } = await updatePrescription(prescriptionId, {
        prescribed_at: editPrescribedAt,
        doctor_notes:  editDoctorNotes.trim() || null,
        items:         itemsForApi(editItems),
      })
      setPrescription(data); setEditing(false)
    } catch (err) {
      const s = err.response?.status; const body = err.response?.data
      if (s === 422 && body?.errors) setFieldErrors(parseServerErrors(body.errors))
      else setApiError(body?.message ?? 'Could not save changes — please try again.')
    } finally { setSaving(false) }
  }

  async function handleSend() {
    setSending(true); setConfirmSend(false)
    try {
      const { data } = await sendPrescription(prescriptionId)
      setPrescription(data)
      toast.success('Prescription sent to pharmacy', {
        description: `Sent for ${prescription.patient.name}`,
        duration: 4000,
      })
    } catch (err) {
      const s = err.response?.status; const body = err.response?.data
      toast.error(
        (s === 409 || s === 422)
          ? (body?.message ?? 'This prescription can no longer be sent.')
          : (body?.message ?? 'Could not send — please try again.')
      )
    } finally { setSending(false) }
  }

  async function handleDelete() {
    const ok = await confirmDelete({ title: 'Delete prescription?', text: 'This cannot be undone.' })
    if (!ok) return
    setDeleting(true)
    try {
      await deletePrescription(prescriptionId)
      toast.success('Prescription deleted')
      navigate(-1)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not delete — please try again.')
      setDeleting(false)
    }
  }

  async function handleViewPdf() {
    try {
      const { data: settings } = await getSettings()
      if (!settings.prescription_template) {
        toast.warning('No prescription template set. Upload one in Prescriptions → Templates to use your clinic pad.')
      }
    } catch { /* ignore — proceed anyway */ }
    navigate(`/prescriptions/${prescriptionId}/print`)
  }

  /* ── States ────────────────────────────────────────────────────────── */

  if (pageStatus === 'loading') return <PageLoader />
  if (pageStatus === 'not-found') return <div className="card state-panel">Prescription not found.</div>
  if (pageStatus === 'forbidden') return <div className="card state-panel">You do not have access to this prescription.</div>
  if (pageStatus === 'error')     return <div className="card state-panel">Could not load prescription — check your connection.</div>

  const isDraft = prescription.status === 'draft'
  const p       = prescription.patient

  return (
    <div className="rx-detail-page">

      <button className="btn-link detail-back" onClick={() => navigate(-1)}>
        ← {p.name}
      </button>

      {/* ── Header card ───────────────────────────────────────────────── */}
      <div className="card rx-hcard">

        {/* Patient identity row */}
        <div className="rx-hcard-patient">
          <div className="rx-hcard-avatar">{(p.name?.[0] ?? '?').toUpperCase()}</div>
          <div className="rx-hcard-info">
            <div className="rx-hcard-name">{p.name}</div>
            <div className="rx-hcard-meta">
              {prescription.doctor && <span>{doctorLabel(prescription.doctor.name)}</span>}
              {p.mobile && <span>{p.mobile}</span>}
              {(p.age != null || p.gender) && (
                <span>
                  {[p.age != null && `${p.age} yrs`, p.gender].filter(Boolean).join(', ')}
                </span>
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

        {/* Action bar — always visible; buttons disabled while editing */}
        <div className={`rx-hcard-actions${editing ? ' rx-hcard-actions--editing' : ''}`}>
          <div className="rx-hcard-actions-left">
            <button className="rx-action-btn" onClick={handleViewPdf} disabled={pdfLoading || editing}>
              {pdfLoading ? <Spinner size={12} /> : <IconPdf />}
              {pdfLoading ? 'Generating…' : 'View PDF'}
            </button>
            {prescription.visit_id && (
              <button
                className="rx-action-btn rx-action-btn--invoice"
                onClick={() => navigate(`/visits/${prescription.visit_id}/invoice`)}
                disabled={editing}
              >
                <IconInvoice />
                Doctor Invoice
              </button>
            )}
            {isDraft && !editing && (
              <button className="rx-action-btn" onClick={startEdit}>
                <IconEdit />
                Edit
              </button>
            )}
          </div>

          {!editing && (
            <div className="rx-hcard-actions-right">
              {isDraft && !confirmSend && (
                <button
                  className="rx-action-btn rx-action-btn--primary"
                  onClick={() => setConfirmSend(true)}
                  disabled={sending}
                >
                  <IconSend />
                  Send to Pharmacy
                </button>
              )}

              {/* Inline confirmation — no browser alert */}
              {isDraft && confirmSend && (
                <div className="rx-send-confirm">
                  <span className="rx-send-confirm-label">Send to pharmacy?</span>
                  <button
                    className="rx-action-btn rx-action-btn--primary"
                    onClick={handleSend}
                    disabled={sending}
                  >
                    {sending ? <Spinner size={12} /> : null}
                    {sending ? 'Sending…' : 'Yes, Send'}
                  </button>
                  <button
                    className="rx-action-btn"
                    onClick={() => setConfirmSend(false)}
                    disabled={sending}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {isDraft && !confirmSend && (
                <button
                  className="rx-action-btn rx-action-btn--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete this prescription"
                >
                  {deleting ? <Spinner size={12} /> : <IconTrash />}
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Inline alerts */}
        {pdfError && (
          <div className="rx-hcard-alert">{pdfError}</div>
        )}
      </div>

      {apiError && (
        <div className="form-alert danger" style={{ marginBottom: 'var(--space-md)' }}>
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      {/* ── Status timeline ───────────────────────────────────────────── */}
      {(prescription.sent_to_pharmacy_at || prescription.dispensed_at || prescription.completed_at) && (
        <div className="card rx-timeline-card">
          {prescription.sent_to_pharmacy_at && (
            <div className="rx-timeline-step">
              <div className="rx-tl-dot-col">
                <div className="rx-timeline-dot rx-timeline-dot--sent" />
              </div>
              <div className="rx-tl-content">
                <div className="rx-timeline-label rx-timeline-label--sent">Sent to Pharmacy</div>
                <div className="rx-timeline-time">{fmtDateTime(prescription.sent_to_pharmacy_at)}</div>
              </div>
            </div>
          )}
          {prescription.dispensed_at && (
            <div className="rx-timeline-step">
              <div className="rx-tl-dot-col">
                <div className="rx-timeline-dot rx-timeline-dot--dispensing" />
              </div>
              <div className="rx-tl-content">
                <div className="rx-timeline-label rx-timeline-label--dispensing">Dispensing Started</div>
                <div className="rx-timeline-time">{fmtDateTime(prescription.dispensed_at)}</div>
              </div>
            </div>
          )}
          {prescription.completed_at && (
            <div className="rx-timeline-step">
              <div className="rx-tl-dot-col">
                <div className="rx-timeline-dot rx-timeline-dot--done" />
              </div>
              <div className="rx-tl-content">
                <div className="rx-timeline-label rx-timeline-label--done">Completed</div>
                <div className="rx-timeline-time">{fmtDateTime(prescription.completed_at)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Read view / Edit form ──────────────────────────────────────── */}
      {editing ? (
        <form onSubmit={handleSave}>
          <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
            <div className="field-group" style={{ maxWidth: '280px' }}>
              <label className="field-label">Prescription Date &amp; Time</label>
              <input
                type="datetime-local"
                className={`field${fieldErrors.prescribedAt || fieldErrors.prescribed_at ? ' has-error' : ''}`}
                value={editPrescribedAt}
                onChange={e => setEditPrescribedAt(e.target.value)}
              />
              {(fieldErrors.prescribedAt || fieldErrors.prescribed_at) && (
                <span className="field-error-msg">
                  {fieldErrors.prescribedAt ?? fieldErrors.prescribed_at}
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
            <h2 className="rx-section-title">Medicines</h2>
            {fieldErrors.items && (
              <span className="field-error-msg" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                {fieldErrors.items}
              </span>
            )}
            <MedicineEditor items={editItems} onChange={setEditItems} itemErrors={fieldErrors.itemErrors} />
          </div>

          <div className="card" style={{ padding: 'var(--space-lg)', marginTop: 'var(--space-md)' }}>
            <div className="field-group">
              <label className="field-label">
                Doctor Notes <span style={{ fontWeight: 400, color: 'var(--clr-text-muted)' }}>(optional)</span>
              </label>
              <textarea
                className="field"
                style={{ minHeight: '100px', resize: 'vertical' }}
                value={editDoctorNotes}
                onChange={e => setEditDoctorNotes(e.target.value)}
              />
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
          {/* Medicines card */}
          <div className="card rx-content-card">
            <div className="rx-content-header">
              <span className="rx-content-label">Medicines</span>
              {prescription.items?.length > 0 && (
                <span className="rx-content-count">{prescription.items.length}</span>
              )}
            </div>
            {prescription.items?.length > 0 ? (
              <ul className="rx-medicine-list">
                {prescription.items.map((item, idx) => (
                  <li key={item.id ?? idx} className="rx-medicine-item">
                    <div className="rx-medicine-num">{idx + 1}</div>
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
                  </li>
                ))}
              </ul>
            ) : (
              <div className="history-empty">No medicines on this prescription.</div>
            )}
          </div>

          {/* Doctor notes card */}
          {prescription.doctor_notes && (
            <div className="card rx-content-card">
              <div className="rx-content-header">
                <span className="rx-content-label">Doctor Notes</span>
              </div>
              <p className="visit-notes-display" style={{ marginTop: 'var(--space-sm)' }}>
                {prescription.doctor_notes}
              </p>
            </div>
          )}

          {prescription.visit && (
            <div style={{ marginTop: 'var(--space-sm)', textAlign: 'right' }}>
              <button
                className="btn-link"
                style={{ fontSize: '13px', color: 'var(--clr-text-muted)' }}
                onClick={() => navigate(`/visits/${prescription.visit.id}`)}
              >
                View related visit →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
