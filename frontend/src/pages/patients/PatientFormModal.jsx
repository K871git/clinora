import '../../styles/patient-form.css'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPatient, updatePatient } from '../../services/patientService'
import Modal from '../../components/ui/Modal'

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6']
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length] }

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other' },
]

function initialForm(patient) {
  return {
    name:          patient?.name          ?? '',
    mobile:        patient?.mobile        ?? '',
    date_of_birth: patient?.date_of_birth ?? '',
    age:           patient?.age != null ? String(patient.age) : '',
    gender:        patient?.gender        ?? '',
    address:       patient?.address       ?? '',
  }
}

/* ── Icons ────────────────────────────────────────────────────────── */

function IconPerson() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="5.5" r="3" />
      <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 12.5l-2 2a13 13 0 01-9-9l2-2L7 6.5 5.5 9A11.5 11.5 0 0013 16.5l2.5-1.5L14.5 12.5z" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="13" rx="2" />
      <path d="M6 1v4M12 1v4M2 8h14" />
    </svg>
  )
}

function IconAge() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7.5" />
      <path d="M9 5v4l2.5 2.5" />
    </svg>
  )
}

function IconLocation() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1a6 6 0 016 6c0 4-6 10-6 10S3 11 3 7a6 6 0 016-6z" />
      <circle cx="9" cy="7" r="1.75" />
    </svg>
  )
}

function IconGender() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="10" r="4" />
      <path d="M11 6l4-4M15 2h-4M15 2v4" />
    </svg>
  )
}

/* ── Component ────────────────────────────────────────────────────── */

export default function PatientFormModal({ patient = null, onClose, onSaved }) {
  const navigate = useNavigate()
  const isEdit   = patient !== null

  const [form,       setFormState] = useState(() => initialForm(patient))
  const [errors,     setErrors]    = useState({})
  const [apiError,   setApiError]  = useState(null)
  const [duplicate,  setDuplicate] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function setField(field, value) {
    setFormState((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }))
    setApiError(null)
    setDuplicate(null)
  }

  function validate() {
    const errs = {}
    if (!form.name.trim())   errs.name   = 'Name is required.'
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
      name:   form.name.trim(),
      mobile: form.mobile.trim(),
    }
    if (form.date_of_birth)  payload.date_of_birth = form.date_of_birth
    if (form.age !== '')     payload.age            = Number(form.age)
    if (form.gender)         payload.gender         = form.gender
    if (form.address.trim()) payload.address        = form.address.trim()

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

  const previewName  = form.name.trim()
  const previewColor = previewName ? avatarColor(previewName) : '#94a3b8'

  const footer = (
    <>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
        Cancel
      </button>
      <button
        type="submit"
        form="patient-form"
        className="btn-primary"
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
      {/* Live patient preview banner */}
      <div className="pfm-preview" style={{ '--pfm-color': previewColor }}>
        <div className="pfm-preview-avatar">
          {previewName ? previewName[0].toUpperCase() : '?'}
        </div>
        <div>
          <div className="pfm-preview-name">{previewName || 'New Patient'}</div>
          <div className="pfm-preview-sub">
            {isEdit ? 'Updating patient record' : 'New patient registration'}
          </div>
        </div>
      </div>

      {/* Duplicate alert */}
      {duplicate && (
        <div className="form-alert warning" style={{ marginBottom: 16 }}>
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

      {apiError && (
        <div className="form-alert danger" style={{ marginBottom: 16 }}>
          <p className="form-alert-body">{apiError}</p>
        </div>
      )}

      <form id="patient-form" onSubmit={handleSubmit} noValidate>
        <div className="pfm-form">

          {/* Full Name */}
          <Field label="Full Name" icon={<IconPerson />} required error={errors.name}>
            <input
              className={`field${errors.name ? ' has-error' : ''}`}
              placeholder="e.g. Kishor Gangarde"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              autoFocus
            />
          </Field>

          {/* Contact */}
          <Field label="Contact Number" icon={<IconPhone />} required error={errors.mobile}>
            <input
              className={`field${errors.mobile ? ' has-error' : ''}`}
              placeholder="e.g. 9876543210"
              value={form.mobile}
              onChange={(e) => setField('mobile', e.target.value)}
            />
          </Field>

          {/* DOB + Age */}
          <div className="pfm-row">
            <Field label="Date of Birth" icon={<IconCalendar />} error={errors.date_of_birth}>
              <input
                type="date"
                className={`field${errors.date_of_birth ? ' has-error' : ''}`}
                value={form.date_of_birth}
                onChange={(e) => setField('date_of_birth', e.target.value)}
              />
            </Field>
            <Field label="Age (years)" icon={<IconAge />} error={errors.age}>
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

          {/* Gender pills */}
          <div className="field-group">
            <label className="field-label pfm-field-label">
              <span className="pfm-label-icon"><IconGender /></span>
              Gender
            </label>
            <div className="pfm-gender-pills">
              {GENDER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`pfm-gender-pill${form.gender === value ? ' pfm-gender-pill--on' : ''}`}
                  onClick={() => setField('gender', form.gender === value ? '' : value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <Field label="Address" icon={<IconLocation />} error={errors.address}>
            <textarea
              className={`field${errors.address ? ' has-error' : ''}`}
              placeholder="Street, City…"
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

/* ── Field wrapper ─────────────────────────────────────────────────── */

function Field({ label, icon, required, error, children }) {
  return (
    <div className="field-group">
      <label className="field-label pfm-field-label">
        {icon && <span className="pfm-label-icon">{icon}</span>}
        {label}
        {required && <span className="pfm-required">*</span>}
      </label>
      {children}
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  )
}
