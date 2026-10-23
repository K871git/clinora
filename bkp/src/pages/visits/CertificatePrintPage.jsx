import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCertificate } from '../../services/certificateService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/certificate-print.css'

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtLong(str) {
  if (!str) return '—'
  const d = str.includes('T')
    ? new Date(str.endsWith('Z') ? str : str + 'Z')
    : new Date(str + 'T00:00')
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtShort(str) {
  if (!str) return '—'
  const d = str.includes('T')
    ? new Date(str.endsWith('Z') ? str : str + 'Z')
    : new Date(str + 'T00:00')
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

function certNum(id) {
  return `CERT-${String(id).padStart(5, '0')}`
}

/* ── Per-type config ─────────────────────────────────────────── */

const TYPE_CONFIG = {
  fitness: {
    label:     'Fitness Certificate',
    title:     'FITNESS CERTIFICATE',
    watermark: 'FITNESS',
    icon:      '✅',
  },
  sick_leave: {
    label:     'Sick Leave Certificate',
    title:     'SICK LEAVE CERTIFICATE',
    watermark: 'SICK LEAVE',
    icon:      '🏥',
  },
  medico_legal: {
    label:     'Medico-Legal Certificate',
    title:     'MEDICO-LEGAL CERTIFICATE',
    watermark: 'MEDICO-LEGAL',
    icon:      '⚖️',
  },
  custom: {
    label:     'Medical Certificate',
    title:     'MEDICAL CERTIFICATE',
    watermark: 'MEDICAL',
    icon:      '📄',
  },
}

/* ── Body text per type ──────────────────────────────────────── */

function CertBody({ cert }) {
  const name   = cert.patient_name || 'Patient'
  const age    = cert.patient_age  != null ? `${cert.patient_age} years` : null
  const gender = cert.patient_gender
  const desc   = [name, age && `aged ${age}`, gender].filter(Boolean).join(', ')
  const exam   = fmtShort(cert.created_at)
  const purpose = (cert.purpose || '').trim()

  if (cert.cert_type === 'fitness') {
    return (
      <p className="cert-body-text">
        This is to certify that <strong>{desc}</strong>, was examined at this
        clinic on <strong>{exam}</strong> and is found to be{' '}
        <strong>medically fit</strong> for{' '}
        {purpose ? <strong>{purpose}</strong> : 'the purpose stated'}.
        <br /><br />
        No medical contraindication has been found at the time of examination.
        This certificate is issued at the patient&apos;s request and is valid
        subject to the patient remaining in the same state of health.
      </p>
    )
  }

  if (cert.cert_type === 'sick_leave') {
    const from  = cert.valid_from  ? fmtShort(cert.valid_from)  : exam
    const until = cert.valid_until ? fmtShort(cert.valid_until) : null
    return (
      <p className="cert-body-text">
        This is to certify that <strong>{desc}</strong>, was under medical
        care and supervision{' '}
        {until
          ? <>from <strong>{from}</strong> to <strong>{until}</strong></>
          : <>from <strong>{from}</strong></>
        }.
        <br /><br />
        The patient is{' '}
        {purpose ? <><strong>{purpose}</strong> and</> : null}{' '}
        hereby advised <strong>complete rest and sick leave</strong> during
        the above period. The patient should not be considered fit for duties
        until re-examined and cleared by a physician.
      </p>
    )
  }

  if (cert.cert_type === 'medico_legal') {
    return (
      <p className="cert-body-text">
        This is to certify that <strong>{desc}</strong>, attended this clinic
        on <strong>{exam}</strong> for medical examination.
        <br /><br />
        {purpose && (
          <><strong>Findings&nbsp;/&nbsp;Reason:</strong> {purpose}.<br /><br /></>
        )}
        This certificate is issued <strong>for medico-legal purposes</strong>{' '}
        at the patient&apos;s request. The information contained herein is
        based on clinical examination and history as provided by the patient.
        This certificate is not to be used for any purpose other than that
        stated above.
      </p>
    )
  }

  /* custom */
  return (
    <div className="cert-custom-notes">
      {(cert.notes || '').trim() || 'No content provided.'}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════ */

export default function CertificatePrintPage() {
  const { certId } = useParams()
  const navigate   = useNavigate()

  const [cert,     setCert]     = useState(null)
  const [settings, setSettings] = useState(null)
  const [status,   setStatus]   = useState('loading')

  useEffect(() => {
    let cancelled = false
    Promise.all([getCertificate(certId), getSettings()])
      .then(([cRes, sRes]) => {
        if (!cancelled) {
          setCert(cRes.data)
          setSettings(sRes.data)
          setStatus('done')
        }
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [certId])

  if (status === 'loading') {
    return <div className="cert-loading"><Spinner size={28} /></div>
  }
  if (status === 'error') {
    return <div className="cert-loading">Could not load certificate.</div>
  }

  /* ── Data ── */
  const clinic  = settings?.clinic ?? {}
  const cfg     = TYPE_CONFIG[cert.cert_type] ?? TYPE_CONFIG.custom
  const typeKey = cert.cert_type ?? 'custom'

  const clinicName    = clinic.name || 'Clinic'
  const doctorName    = clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : doctorLabel(cert.doctor_name)
  const qualification = clinic.qualification || ''
  const regNumber     = clinic.registration_number || ''
  const address       = clinic.address || ''
  const contact       = clinic.contact || ''

  const patientName   = cert.patient_name || '—'
  const patientAge    = cert.patient_age  != null ? `${cert.patient_age} yrs` : null
  const patientGender = cert.patient_gender
  const patientMobile = cert.patient_mobile
  const notes         = (cert.notes || '').trim()
  const issueDate     = fmtLong(cert.created_at)

  return (
    <div className="cert-page">

      {/* Toolbar */}
      <div className="cert-toolbar cert-print-hide">
        <button className="cert-toolbar-back" onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="cert-toolbar-title">{cfg.label} — {patientName}</span>
        <button className="cert-toolbar-print" onClick={() => window.print()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Certificate
        </button>
      </div>

      {/* Document */}
      <div className={`cert-doc cert-doc--${typeKey}`}>

        {/* Coloured top stripe */}
        <div className="cert-top-stripe">
          <span className="cert-top-stripe-icon">{cfg.icon}</span>
          <span className="cert-top-stripe-label">{cfg.title}</span>
        </div>

        <div className="cert-doc-inner">

          {/* Watermark */}
          <div className="cert-watermark">{cfg.watermark}</div>

          {/* Letterhead */}
          <div className="cert-letterhead">
            <div className="cert-clinic-name">{clinicName}</div>
            {doctorName    && <div className="cert-doctor-name">{doctorName}</div>}
            {qualification && <div className="cert-doctor-qual">{qualification}</div>}
            {regNumber     && <div className="cert-doctor-qual" style={{ fontSize: 11 }}>Reg. No: {regNumber}</div>}
            {(address || contact) && (
              <div className="cert-clinic-contact">
                {address && <span>{address}</span>}
                {contact && <span>{contact}</span>}
              </div>
            )}
          </div>

          {/* Type title band */}
          <div className="cert-title-band">
            <span className="cert-type-label">{cfg.title}</span>
          </div>

          {/* Meta row */}
          <div className="cert-meta-row">
            <div className="cert-meta-item">
              <span className="cert-meta-label">Certificate No.</span>
              <span className="cert-meta-value">{certNum(cert.id)}</span>
            </div>
            <div className="cert-meta-item" style={{ textAlign: 'right' }}>
              <span className="cert-meta-label">Date of Issue</span>
              <span className="cert-meta-value">{issueDate}</span>
            </div>
          </div>

          {/* Patient box */}
          <div className="cert-patient-box">
            <div className="cert-patient-field">
              <span className="cert-patient-field-label">Patient Name</span>
              <span className="cert-patient-field-value">{patientName}</span>
            </div>
            {(patientAge || patientGender) && (
              <div className="cert-patient-field">
                <span className="cert-patient-field-label">Age / Sex</span>
                <span className="cert-patient-field-value">
                  {[patientAge, patientGender].filter(Boolean).join(' / ')}
                </span>
              </div>
            )}
            {patientMobile && (
              <div className="cert-patient-field">
                <span className="cert-patient-field-label">Contact</span>
                <span className="cert-patient-field-value">{patientMobile}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="cert-body">
            <CertBody cert={cert} />

            {/* Validity dates (fitness / non-sick_leave) */}
            {(cert.valid_from || cert.valid_until) && cert.cert_type !== 'sick_leave' && (
              <div className="cert-validity-row">
                {cert.valid_from && (
                  <div className="cert-validity-item">
                    <span className="cert-validity-label">Valid From</span>
                    <span className="cert-validity-value">{fmtShort(cert.valid_from)}</span>
                  </div>
                )}
                {cert.valid_until && (
                  <div className="cert-validity-item">
                    <span className="cert-validity-label">Valid Until</span>
                    <span className="cert-validity-value">{fmtShort(cert.valid_until)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Additional notes (not for custom, which uses notes as main content) */}
            {notes && cert.cert_type !== 'custom' && (
              <div className="cert-additional-notes">
                <strong>Additional Notes:</strong> {notes}
              </div>
            )}
          </div>

          {/* Signature */}
          <div className="cert-sig-section">
            <div className="cert-sig-left">
              <div className="cert-sig-left-label">Issued at</div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{clinicName}</div>
              <div style={{ marginTop: 3, fontSize: 11, color: '#64748b' }}>Date: {issueDate}</div>
            </div>
            <div className="cert-sig-block">
              <div className="cert-sig-space" />
              <div className="cert-sig-name">{doctorName}</div>
              {qualification && <div className="cert-sig-qual">{qualification}</div>}
              {regNumber     && <div className="cert-sig-reg">Reg. No: {regNumber}</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
