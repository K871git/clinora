import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPrescription } from '../../services/prescriptionService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/print-prescription.css'

/* ── Helpers ─────────────────────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── Medicine list ───────────────────────────────────────────────────── */

function MedicineList({ items }) {
  if (!items?.length) {
    return <p className="print-no-medicines">No medicines on this prescription.</p>
  }
  return (
    <ol className="print-med-list">
      {items.map((item, idx) => (
        <li key={item.id ?? idx} className="print-med-item">
          <div className="print-med-body">
            <div className="print-med-name">{item.medicine_name}</div>
            {(item.dosage || item.frequency || item.duration) && (
              <div className="print-med-meta">
                {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
              </div>
            )}
            {item.instructions && (
              <div className="print-med-instructions">{item.instructions}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ── Signature block ─────────────────────────────────────────────────── */

function Signature({ name, qualification }) {
  return (
    <div className="print-signature-section">
      <div className="print-signature-block">
        <div className="print-signature-line" />
        <div className="print-signature-name">{name}</div>
        {qualification && (
          <div className="print-signature-qual">{qualification}</div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════ */

export default function PrintPrescriptionPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()

  const [prescription, setPrescription] = useState(null)
  const [settings,     setSettings]     = useState(null)
  const [pageStatus,   setPageStatus]   = useState('loading')

  useEffect(() => {
    let cancelled = false
    Promise.all([getPrescription(prescriptionId), getSettings()])
      .then(([rxRes, settingsRes]) => {
        if (!cancelled) {
          setPrescription(rxRes.data.data)
          setSettings(settingsRes.data.data)
          setPageStatus('done')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const status = err.response?.status
          if (status === 404)      setPageStatus('not-found')
          else if (status === 403) setPageStatus('forbidden')
          else                     setPageStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [prescriptionId])

  /* ── Loading / error ── */
  if (pageStatus === 'loading') {
    return (
      <div className="print-page" style={{ justifyContent: 'center' }}>
        <Spinner size={28} />
      </div>
    )
  }

  if (pageStatus !== 'done') {
    const msg = {
      'not-found': 'Prescription not found.',
      'forbidden': 'You do not have access to this prescription.',
      'error':     'Could not load prescription — check your connection.',
    }[pageStatus] ?? 'Something went wrong.'
    return (
      <div className="print-page" style={{ justifyContent: 'center', padding: 60, color: 'var(--clr-text-muted)', textAlign: 'center' }}>
        {msg}
      </div>
    )
  }

  /* ── Data ── */
  const clinic = settings.clinic
  const ps     = settings.prescription_settings

  const sigName = clinic.doctor_name
    ? `Dr. ${clinic.doctor_name}`
    : prescription.doctor?.name
      ? `Dr. ${prescription.doctor.name}`
      : 'Doctor'

  const templateUrl = ps.prescription_template_url ?? null
  const templateExt = ps.prescription_template?.split('.').pop()?.toLowerCase() ?? ''
  const isPdf   = !!templateUrl && templateExt === 'pdf'
  const isImage = !!templateUrl && !isPdf
  const hasTemplate = isPdf || isImage

  /* ── No-template warning ── */
  const noTemplateWarn = !hasTemplate && (
    <div className="print-no-template-warn print-hide">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      No prescription template set — go to <strong style={{ margin: '0 3px' }}>Prescriptions → Templates</strong> to upload your clinic's pad. Printing without a template will show the basic layout below.
    </div>
  )

  /* ── Toolbar ── */
  const toolbar = (
    <div className="print-toolbar print-hide">
      <button
        className="print-toolbar-back"
        onClick={() => navigate(`/prescriptions/${prescriptionId}`)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to Prescription
      </button>
      <span className="print-toolbar-title">
        {prescription.patient.name} — {fmtDate(prescription.prescribed_at)}
      </span>
      <button className="print-toolbar-btn" onClick={() => window.print()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print
      </button>
    </div>
  )

  /* ══════════════════════════════════════════════════════════════════
     MODE A — No template: full standalone prescription layout
     ══════════════════════════════════════════════════════════════════ */
  if (!hasTemplate) {
    return (
      <div className="print-page">
        {toolbar}
        {noTemplateWarn}

        <div className="print-paper print-paper--standalone">

          {/* Custom header banner */}
          {ps.prescription_header && (
            <div className="print-banner" style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
              {ps.prescription_header}
            </div>
          )}

          {/* Clinic + Patient row */}
          <div className="print-standalone-header">
            <div className="print-clinic-col">
              <div className="print-clinic-name">{clinic.name}</div>
              {clinic.doctor_name && (
                <div className="print-doctor-name">Dr. {clinic.doctor_name}</div>
              )}
              {ps.show_doctor_contact && clinic.qualification && (
                <div className="print-qualification">{clinic.qualification}</div>
              )}
              {ps.show_clinic_contact && clinic.address && (
                <div className="print-address">{clinic.address}</div>
              )}
              {ps.show_clinic_contact && clinic.contact && (
                <div className="print-clinic-contact">{clinic.contact}</div>
              )}
            </div>

            <div className="print-patient-col">
              <div className="print-patient-row">
                <span className="print-patient-label">Date</span>
                <span className="print-patient-value">{fmtDateTime(prescription.prescribed_at)}</span>
              </div>
              <div className="print-patient-row">
                <span className="print-patient-label">Patient</span>
                <span className="print-patient-value">{prescription.patient.name}</span>
              </div>
              {prescription.patient.mobile && (
                <div className="print-patient-row">
                  <span className="print-patient-label">Contact</span>
                  <span className="print-patient-value">{prescription.patient.mobile}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rx + Medicines */}
          <div className="print-rx-symbol">&#8478;</div>
          <MedicineList items={prescription.items} />

          {/* Notes */}
          {prescription.doctor_notes && (
            <div className="print-notes-section" style={{ marginTop: 14 }}>
              <hr className="print-rule" />
              <div className="print-notes-label">Notes</div>
              <div className="print-notes-text">{prescription.doctor_notes}</div>
            </div>
          )}

          {/* Signature */}
          <Signature name={sigName} qualification={clinic.qualification} />

          {/* Custom footer banner */}
          {ps.prescription_footer && (
            <>
              <hr className="print-rule" />
              <div className="print-banner">{ps.prescription_footer}</div>
            </>
          )}

        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════
     MODE B — With template: overlay content on background
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="print-page">
      {toolbar}

      <div className="print-paper print-paper--template">

        {/* Background — image template */}
        {isImage && (
          <img
            src={templateUrl}
            alt=""
            className="print-template-bg-img"
            aria-hidden="true"
          />
        )}

        {/* Background — PDF template (embedded) */}
        {isPdf && (
          <iframe
            src={templateUrl}
            title="prescription-template"
            className="print-template-bg-pdf"
            aria-hidden="true"
          />
        )}

        {/* Overlay — values only, no labels (template has those pre-printed) */}
        <div className="print-template-overlay">

          {/* Patient name left, date right — values only, no labels */}
          <div className="print-tpl-patient-row">
            <span className="print-tpl-val">{prescription.patient.name}</span>
            <span className="print-tpl-val">{fmtDate(prescription.prescribed_at)}</span>
          </div>

          {/* Medicines — no Rx symbol here; template has one pre-printed */}
          <MedicineList items={prescription.items} />

          {/* Notes — pushed to bottom of the overlay area */}
          {prescription.doctor_notes && (
            <div className="print-tpl-notes">
              <div className="print-notes-label">Notes</div>
              <div className="print-notes-text">{prescription.doctor_notes}</div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
