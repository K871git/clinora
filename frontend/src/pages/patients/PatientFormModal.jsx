import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPatient, updatePatient } from '../../services/patientService'
import Modal from '../../components/ui/Modal'

const GENDER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

function initialForm(patient) {
  return {
    name: patient?.name ?? '',
    mobile: patient?.mobile ?? '',
    date_of_birth: patient?.date_of_birth ?? '',
    age: patient?.age != null ? String(patient.age) : '',
    gender: patient?.gender ?? '',
    address: patient?.address ?? '',
  }
}

/**
 * PatientFormModal — handles both Register (patient=null) and Edit (patient={...}).
 * Props:
 *   patient   — existing patient object for edit mode, null for add mode
 *   onClose   — called when modal should close
 *   onSaved   — called with the saved patient object
 */
export default function PatientFormModal({ patient = null, onClose, onSaved }) {
  const navigate = useNavigate()
  const isEdit = patient !== null

  const [form, setForm] = useState(() => initialForm(patient))
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [duplicate, setDuplicate] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    // Clear field-level error on change
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }))
    setApiError(null)
    setDuplicate(null)
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.mobile.trim()) errs.mobile = 'Contact number is required.'
    if (form.age !== '' && (isNaN(Number(form.age)) || Number(form.age) < 0 || Number(form.age) > 150)) {
      errs.age = 'Enter a valid age (0–150).'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
    }
    if (form.date_of_birth) payload.date_of_birth = form.date_of_birth
    if (form.age !== '')    payload.age = Number(form.age)
    if (form.gender)        payload.gender = form.gender
    if (form.address.trim()) payload.address = form.address.trim()

    setSubmitting(true)
    setApiError(null)
    setDuplicate(null)

    try {
      const { data } = isEdit
        ? await updatePatient(patient.id, payload)
        : await createPatient(payload)
      onSaved(data.data)
    } catch (err) {
      const status = err.response?.status
      const body   = err.response?.data

      if (status === 409 && body?.duplicate) {
        // Backend found an existing patient with the same mobile
        setDuplicate(body.duplicate)
        return
      }
      if (status === 422 && body?.errors) {
        const serverErrs = {}
        Object.entries(body.errors).forEach(([k, msgs]) => {
          serverErrs[k] = Array.isArray(msgs) ? msgs[0] : msgs
        })
        setErrors(serverErrs)
        return
      }
      setApiError(body?.message ?? 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const footer = (
    <>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
        Cancel
      </button>
      <button
        type="submit"
        form="patient-form"
        className="btn-primary"
        style={{ width: 'auto' }}
        disabled={submitting}
      >
        {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Patient'}
      </button>
    </>
  )

  return (
    <Modal
      title={isEdit ? 'Edit Patient' : 'Register New Patient'}
      onClose={onClose}
      footer={footer}
    >
      {/* Duplicate alert — shown when backend detects an existing patient with same mobile */}
      {duplicate && (
        <div className="form-alert warning">
          <strong className="form-alert-title">Patient already registered</strong>
          <p className="form-alert-body">
            <strong>{duplicate.name}</strong> is already on file with this contact number.
          </p>
          <button
            className="btn-link"
            onClick={() => { onClose(); navigate(`/patients/${duplicate.id}`) }}
          >
            Open existing patient →
          </button>
        </div>
      )}

      {/* Generic API error */}
      {apiError && (
        <div className="form-alert danger">
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      <form id="patient-form" onSubmit={handleSubmit} noValidate>
        <div className="form-stack">
          <Field label="Full Name" required error={errors.name}>
            <input
              className={`field${errors.name ? ' has-error' : ''}`}
              placeholder="e.g. Ahmed Khan"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </Field>

          <Field label="Contact Number" required error={errors.mobile}>
            <input
              className={`field${errors.mobile ? ' has-error' : ''}`}
              placeholder="e.g. 03001234567"
              value={form.mobile}
              onChange={(e) => setField('mobile', e.target.value)}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Date of Birth" error={errors.date_of_birth}>
              <input
                type="date"
                className={`field${errors.date_of_birth ? ' has-error' : ''}`}
                value={form.date_of_birth}
                onChange={(e) => setField('date_of_birth', e.target.value)}
              />
            </Field>
            <Field label="Age" error={errors.age}>
              <input
                type="number"
                className={`field${errors.age ? ' has-error' : ''}`}
                placeholder="e.g. 35"
                min="0"
                max="150"
                value={form.age}
                onChange={(e) => setField('age', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Gender" error={errors.gender}>
            <select
              className={`field${errors.gender ? ' has-error' : ''}`}
              value={form.gender}
              onChange={(e) => setField('gender', e.target.value)}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Address" error={errors.address}>
            <textarea
              className={`field${errors.address ? ' has-error' : ''}`}
              placeholder="e.g. House 5, Street 3, Lahore"
              rows={2}
              style={{ resize: 'vertical', minHeight: '60px' }}
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
            />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

/* Labelled field wrapper with optional error message */
function Field({ label, required, error, children }) {
  return (
    <div className="field-group">
      <label className="field-label">
        {label}
        {required && <span style={{ color: 'var(--clr-danger)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  )
}
