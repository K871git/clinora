import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { getPrescription } from '../../services/prescriptionService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/print-prescription.css'
import { fmtDateTime, fmtDateParts } from '../../lib/dateUtils'

/* ── Helpers ─────────────────────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '—'
  const { dd, mm, yyyy } = fmtDateParts(iso)
  return `${dd}/${mm}/${yyyy}`
}

function dateParts(iso) {
  return fmtDateParts(iso)
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
  const [pdfBlobUrl,   setPdfBlobUrl]   = useState(null)
  const [pdfLayout,    setPdfLayout]    = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getPrescription(prescriptionId), getSettings()])
      .then(([rxRes, settingsRes]) => {
        if (!cancelled) {
          setPrescription(rxRes.data)
          setSettings(settingsRes.data)
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

  // Read template file as blob URL (works for both PDF and image templates).
  // Using blob URLs avoids asset:// path encoding issues on Windows.
  useEffect(() => {
    if (pageStatus !== 'done' || !settings) return
    const templatePath = settings.prescription_template_path
    const ext = (settings.prescription_template ?? '').split('.').pop()?.toLowerCase() ?? ''
    if (!templatePath || !ext) return

    const isPdfExt   = ext === 'pdf'
    const isImageExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
    if (!isPdfExt && !isImageExt) return

    let createdUrl = null

    invoke('read_template_file', { path: templatePath })
      .then(b64 => {
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const mime = isPdfExt ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
        createdUrl = URL.createObjectURL(new Blob([bytes], { type: mime }))
        setPdfBlobUrl(createdUrl)
      })
      .catch(() => setPdfBlobUrl(null))

    if (isPdfExt) {
      invoke('scan_template_layout', { path: templatePath })
        .then(layout => setPdfLayout(layout))
        .catch(() => setPdfLayout(null))
    }

    return () => { if (createdUrl) URL.revokeObjectURL(createdUrl) }
  }, [pageStatus, settings])

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
  const ps     = settings

  const sigName = clinic.doctor_name
    ? `Dr. ${clinic.doctor_name}`
    : prescription.doctor?.name
      ? `Dr. ${prescription.doctor.name}`
      : 'Doctor'

  const templatePath = ps.prescription_template_path ?? null
  const templateExt  = (ps.prescription_template ?? '').split('.').pop()?.toLowerCase() ?? ''
  const isPdf        = !!templatePath && templateExt === 'pdf'
  const isImage      = !!templatePath && !isPdf && ['jpg', 'jpeg', 'png', 'webp'].includes(templateExt)
  const hasTemplate  = isPdf || isImage

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
        onClick={() => navigate(-1)}
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

        {/* Background — image template (blob URL) */}
        {isImage && pdfBlobUrl && (
          <img
            src={pdfBlobUrl}
            alt=""
            className="print-template-bg-img"
            aria-hidden="true"
          />
        )}

        {/* Background — PDF template (blob URL avoids asset:// D%3A encoding on Windows) */}
        {isPdf && pdfBlobUrl && (
          <iframe
            src={pdfBlobUrl}
            title="prescription-template"
            className="print-template-bg-pdf"
            aria-hidden="true"
          />
        )}

        {/*
          Overlay:
          - PDF template with scanned coords  → position: absolute using mm from pdf scan
          - Image template / scan fallback    → CSS padding-based flex column
          - PDF loading (no blob yet)         → hidden to avoid flash
        */}
        {(!isPdf || pdfBlobUrl) && (
          pdfLayout ? (
            /* ── Absolute overlay — coordinates from scan_template_layout ── */
            <div className="print-template-overlay print-template-overlay--absolute">
              <span className="print-tpl-val" style={{
                position: 'absolute',
                top:  `${pdfLayout.name_y}mm`,
                left: `${pdfLayout.name_x}mm`,
              }}>
                {prescription.patient.name}
              </span>

              {/* Date: three spans for DD, MM, YYYY — template already has "/" separators printed */}
              {(() => {
                const { dd, mm, yyyy } = dateParts(prescription.prescribed_at)
                const dy = pdfLayout.date_y
                const dx = pdfLayout.date_x
                const SLOT = pdfLayout.date_slot_w ?? 9
                return (
                  <>
                    <span className="print-tpl-val" style={{ position: 'absolute', top: `${dy}mm`, left: `${dx}mm` }}>{dd}</span>
                    <span className="print-tpl-val" style={{ position: 'absolute', top: `${dy}mm`, left: `${dx + SLOT}mm` }}>{mm}</span>
                    <span className="print-tpl-val" style={{ position: 'absolute', top: `${dy}mm`, left: `${dx + SLOT * 2}mm` }}>{yyyy}</span>
                  </>
                )
              })()}

              <div style={{
                position: 'absolute',
                top:   `${pdfLayout.meds_start_y}mm`,
                left:  `${pdfLayout.meds_x}mm`,
                width: `${pdfLayout.meds_w}mm`,
              }}>
                <MedicineList items={prescription.items} />
                {prescription.doctor_notes && (
                  <div className="print-tpl-notes" style={{ marginTop: '12pt' }}>
                    <div className="print-notes-label">Notes</div>
                    <div className="print-notes-text">{prescription.doctor_notes}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── CSS-padded fallback (image template or scan failed) ── */
            <div className="print-template-overlay">
              <div className="print-tpl-patient-row">
                <span className="print-tpl-val">{prescription.patient.name}</span>
                <span className="print-tpl-val">{fmtDate(prescription.prescribed_at)}</span>
              </div>
              <MedicineList items={prescription.items} />
              {prescription.doctor_notes && (
                <div className="print-tpl-notes">
                  <div className="print-notes-label">Notes</div>
                  <div className="print-notes-text">{prescription.doctor_notes}</div>
                </div>
              )}
            </div>
          )
        )}

      </div>
    </div>
  )
}
