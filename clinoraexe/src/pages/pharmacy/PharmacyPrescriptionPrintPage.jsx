import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { getPharmacyPrescription } from '../../services/pharmacyService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import DefaultPrescriptionTemplate from '../prescriptions/DefaultPrescriptionTemplate'
import '../../styles/print-prescription.css'
import '../../styles/rx-preview.css'
import { fmtDateParts } from '../../lib/dateUtils'

function fmtDate(iso) {
  if (!iso) return '—'
  const { dd, mm, yyyy } = fmtDateParts(iso)
  return `${dd}/${mm}/${yyyy}`
}

function dateParts(iso) {
  return fmtDateParts(iso)
}

const LANG = {
  en: { medicine: 'Medicine', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
        beforeMeal: 'Before Meal', afterMeal: 'After Meal', days: 'Days' },
  hi: { medicine: 'दवा', morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम',
        beforeMeal: 'खाने से पहले', afterMeal: 'खाने के बाद', days: 'दिन' },
  mr: { medicine: 'औषध', morning: 'सकाळी', afternoon: 'दुपारी', evening: 'संध्याकाळी',
        beforeMeal: 'जेवणापूर्वी', afterMeal: 'जेवणानंतर', days: 'दिवस' },
}

function parseMed(item) {
  const d = item.dosage ?? ''
  const dur = item.duration ?? ''
  const tim = d.match(/^(\d+)-(\d+)-(\d+)/)
  const days = (dur.match(/^(\d+)/) || [])[1] ?? ''
  const timingCount = tim ? [tim[1],tim[2],tim[3]].filter(n => Number(n) > 0).length : 0
  const dose = tim ? (Number(tim[1]) || Number(tim[2]) || Number(tim[3]) || 1) : 1
  const qty = timingCount > 0 && days ? String(timingCount * dose * Number(days)) : ''
  return {
    id:         item.id,
    name:       item.medicine_name,
    morning:    tim ? Number(tim[1]) > 0 : false,
    afternoon:  tim ? Number(tim[2]) > 0 : false,
    evening:    tim ? Number(tim[3]) > 0 : false,
    beforeMeal: /before meal/i.test(d),
    afterMeal:  /after meal/i.test(d),
    days,
    qty,
    notes:      item.instructions ?? '',
  }
}

function MedicineList({ items, L }) {
  if (!items?.length) return <p className="print-no-medicines">No medicines on this prescription.</p>
  return (
    <table className="rxp-med-table">
      <tbody>
        {items.map(parseMed).map(m => {
          const timingParts = [
            m.morning   && L.morning,
            m.afternoon && L.afternoon,
            m.evening   && L.evening,
          ].filter(Boolean)
          const meal = m.beforeMeal ? L.beforeMeal : m.afterMeal ? L.afterMeal : '—'
          return (
            <tr key={m.id} className="rxp-med-tr">
              <td className="rxp-td rxp-td--name">
                <span className="rxp-med-name">{m.name}</span>
                {m.qty && <div className="rxp-med-qty">Qty: {m.qty} tab</div>}
                {m.notes?.trim() && <div className="rxp-med-note">↳ {m.notes}</div>}
              </td>
              <td className="rxp-td rxp-td--timing">
                {timingParts.length > 0 ? timingParts.join(' + ') : '—'}
              </td>
              <td className="rxp-td rxp-td--meal">{meal}</td>
              <td className="rxp-td rxp-td--days">
                {m.days ? <>{m.days}<div className="rxp-days-label">{L.days}</div></> : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
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

  const lang = (
    localStorage.getItem('clinora:rx-lang-' + prescriptionId) ||
    localStorage.getItem('clinora:rx-lang') ||
    'en'
  )
  const L = LANG[lang] || LANG.en

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

  /* ── No template: same DefaultPrescriptionTemplate as doctor side ── */
  if (!hasTemplate) {
    return (
      <div className="print-page">
        {toolbar}
        <DefaultPrescriptionTemplate
          clinic={{
            name:          clinic.name,
            doctorName:    clinic.doctor_name,
            qualification: clinic.qualification,
            regNo:         clinic.registration_number,
            address:       clinic.address,
            contact:       clinic.contact,
            timing:        clinic.clinic_timing,
            days:          clinic.clinic_days,
            logoUrl:       clinic.logo_url,
          }}
          watermark={{
            text:    ps.watermark_text    ?? 'Clinora',
            color:   ps.watermark_color   ?? '#0d9488',
            enabled: ps.watermark_enabled !== false,
          }}
          prescription={prescription}
          lang={lang}
        />
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
                <MedicineList items={prescription.items} L={L} />
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
              <MedicineList items={prescription.items} L={L} />
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
