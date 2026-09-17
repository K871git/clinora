import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { getPharmacyPrescription } from '../../services/pharmacyService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/print-prescription.css'
import { fmtDateTime, fmtDateParts } from '../../lib/dateUtils'

function fmtDate(iso) {
  if (!iso) return '—'
  const { dd, mm, yyyy } = fmtDateParts(iso)
  return `${dd}/${mm}/${yyyy}`
}

function dateParts(iso) {
  return fmtDateParts(iso)
}

function MedicineList({ items }) {
  if (!items?.length) return <p className="print-no-medicines">No medicines on this prescription.</p>
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

function Signature({ name, qualification }) {
  return (
    <div className="print-signature-section">
      <div className="print-signature-block">
        <div className="print-signature-line" />
        <div className="print-signature-name">{name}</div>
        {qualification && <div className="print-signature-qual">{qualification}</div>}
      </div>
    </div>
  )
}

export default function PharmacyPrescriptionPrintPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()

  const [prescription, setPrescription] = useState(null)
  const [settings,     setSettings]     = useState(null)
  const [status,       setStatus]       = useState('loading')
  const [pdfBlobUrl,   setPdfBlobUrl]   = useState(null)
  const [pdfLayout,    setPdfLayout]    = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getPharmacyPrescription(prescriptionId), getSettings()])
      .then(([rxRes, stgRes]) => {
        if (!cancelled) {
          setPrescription(rxRes.data)
          setSettings(stgRes.data)
          setStatus('done')
        }
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [prescriptionId])

  /* Load template file as blob URL (PDF or image) */
  useEffect(() => {
    if (status !== 'done' || !settings) return
    const templatePath = settings.prescription_template_path
    const ext = (settings.prescription_template ?? '').split('.').pop()?.toLowerCase() ?? ''
    if (!templatePath || !ext) return

    const isPdfExt   = ext === 'pdf'
    const isImageExt = ['jpg','jpeg','png','webp'].includes(ext)
    if (!isPdfExt && !isImageExt) return

    let createdUrl = null
    invoke('read_template_file', { path: templatePath })
      .then(b64 => {
        const binary = atob(b64)
        const bytes  = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const mime   = isPdfExt ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
        createdUrl   = URL.createObjectURL(new Blob([bytes], { type: mime }))
        setPdfBlobUrl(createdUrl)
      })
      .catch(() => setPdfBlobUrl(null))

    if (isPdfExt) {
      invoke('scan_template_layout', { path: templatePath })
        .then(layout => setPdfLayout(layout))
        .catch(() => setPdfLayout(null))
    }

    return () => { if (createdUrl) URL.revokeObjectURL(createdUrl) }
  }, [status, settings])

  if (status === 'loading') {
    return <div className="print-page" style={{ justifyContent: 'center' }}><Spinner size={28} /></div>
  }
  if (status === 'error') {
    return (
      <div className="print-page" style={{ justifyContent: 'center', padding: 60, color: '#64748b', textAlign: 'center' }}>
        Could not load prescription.
      </div>
    )
  }

  const clinic  = settings.clinic
  const ps      = settings
  const p       = prescription.patient

  const drName = prescription.doctor?.name
    ? (/^dr\.?\s/i.test(prescription.doctor.name) ? prescription.doctor.name : `Dr. ${prescription.doctor.name}`)
    : (clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : 'Doctor')

  const patientMeta = [p.age != null && `${p.age} yrs`, p.gender].filter(Boolean).join(', ')

  const templateExt = (ps.prescription_template ?? '').split('.').pop()?.toLowerCase() ?? ''
  const isPdf       = !!ps.prescription_template_path && templateExt === 'pdf'
  const isImage     = !!ps.prescription_template_path && !isPdf && ['jpg','jpeg','png','webp'].includes(templateExt)
  const hasTemplate = isPdf || isImage

  const toolbar = (
    <div className="print-toolbar print-hide">
      <button className="print-toolbar-back" onClick={() => navigate(-1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>
      <span className="print-toolbar-title">
        Prescription — {p.name} · {fmtDate(prescription.prescribed_at)}
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

  /* ── No template: full standalone layout ── */
  if (!hasTemplate) {
    return (
      <div className="print-page">
        {toolbar}
        <div className="print-paper print-paper--standalone">

          {ps.prescription_header && (
            <div className="print-banner" style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
              {ps.prescription_header}
            </div>
          )}

          <div className="print-standalone-header">
            <div className="print-clinic-col">
              <div className="print-clinic-name">{clinic.name || 'Clinic'}</div>
              {drName && <div className="print-doctor-name">{drName}</div>}
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
                <span className="print-patient-value">{p.name}</span>
              </div>
              {patientMeta && (
                <div className="print-patient-row">
                  <span className="print-patient-label">Age / Sex</span>
                  <span className="print-patient-value">{patientMeta}</span>
                </div>
              )}
              {p.mobile && (
                <div className="print-patient-row">
                  <span className="print-patient-label">Contact</span>
                  <span className="print-patient-value">{p.mobile}</span>
                </div>
              )}
            </div>
          </div>

          <div className="print-rx-symbol">&#8478;</div>
          <MedicineList items={prescription.items} />

          {prescription.doctor_notes && (
            <div className="print-notes-section" style={{ marginTop: 14 }}>
              <hr className="print-rule" />
              <div className="print-notes-label">Doctor Notes</div>
              <div className="print-notes-text">{prescription.doctor_notes}</div>
            </div>
          )}

          {prescription.pharmacist_notes && (
            <div className="print-notes-section" style={{ marginTop: 10 }}>
              <div className="print-notes-label">Pharmacist Notes</div>
              <div className="print-notes-text">{prescription.pharmacist_notes}</div>
            </div>
          )}

          <Signature name={drName} qualification={clinic.qualification} />

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

  /* ── With template: overlay on background ── */
  return (
    <div className="print-page">
      {toolbar}
      <div className="print-paper print-paper--template">

        {isImage && pdfBlobUrl && (
          <img src={pdfBlobUrl} alt="" className="print-template-bg-img" aria-hidden="true" />
        )}
        {isPdf && pdfBlobUrl && (
          <iframe src={pdfBlobUrl} title="prescription-template" className="print-template-bg-pdf" aria-hidden="true" />
        )}

        {(!isPdf || pdfBlobUrl) && (
          pdfLayout ? (
            <div className="print-template-overlay print-template-overlay--absolute">
              <span className="print-tpl-val" style={{ position: 'absolute', top: `${pdfLayout.name_y}mm`, left: `${pdfLayout.name_x}mm` }}>
                {p.name}
              </span>
              {(() => {
                const { dd, mm, yyyy } = dateParts(prescription.prescribed_at)
                const dy = pdfLayout.date_y, dx = pdfLayout.date_x, SLOT = pdfLayout.date_slot_w ?? 9
                return (
                  <>
                    <span className="print-tpl-val" style={{ position: 'absolute', top: `${dy}mm`, left: `${dx}mm` }}>{dd}</span>
                    <span className="print-tpl-val" style={{ position: 'absolute', top: `${dy}mm`, left: `${dx + SLOT}mm` }}>{mm}</span>
                    <span className="print-tpl-val" style={{ position: 'absolute', top: `${dy}mm`, left: `${dx + SLOT * 2}mm` }}>{yyyy}</span>
                  </>
                )
              })()}
              <div style={{ position: 'absolute', top: `${pdfLayout.meds_start_y}mm`, left: `${pdfLayout.meds_x}mm`, width: `${pdfLayout.meds_w}mm` }}>
                <MedicineList items={prescription.items} />
                {prescription.doctor_notes && (
                  <div className="print-tpl-notes" style={{ marginTop: '12pt' }}>
                    <div className="print-notes-label">Doctor Notes</div>
                    <div className="print-notes-text">{prescription.doctor_notes}</div>
                  </div>
                )}
                {prescription.pharmacist_notes && (
                  <div className="print-tpl-notes" style={{ marginTop: '8pt' }}>
                    <div className="print-notes-label">Pharmacist Notes</div>
                    <div className="print-notes-text">{prescription.pharmacist_notes}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="print-template-overlay">
              <div className="print-tpl-patient-row">
                <span className="print-tpl-val">{p.name}</span>
                <span className="print-tpl-val">{fmtDate(prescription.prescribed_at)}</span>
              </div>
              <MedicineList items={prescription.items} />
              {prescription.doctor_notes && (
                <div className="print-tpl-notes">
                  <div className="print-notes-label">Doctor Notes</div>
                  <div className="print-notes-text">{prescription.doctor_notes}</div>
                </div>
              )}
              {prescription.pharmacist_notes && (
                <div className="print-tpl-notes" style={{ marginTop: 8 }}>
                  <div className="print-notes-label">Pharmacist Notes</div>
                  <div className="print-notes-text">{prescription.pharmacist_notes}</div>
                </div>
              )}
            </div>
          )
        )}

      </div>
    </div>
  )
}
