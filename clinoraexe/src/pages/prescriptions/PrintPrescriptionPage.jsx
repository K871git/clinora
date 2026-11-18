import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { getPrescription } from '../../services/prescriptionService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import DefaultPrescriptionTemplate from './DefaultPrescriptionTemplate'
import '../../styles/print-prescription.css'
import '../../styles/rx-preview.css'
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

/* ── Language labels (same as QuickRxPage) ──────────────────────────── */
const LANG = {
  en: { medicine: 'Medicine', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
        beforeMeal: 'Before Meal', afterMeal: 'After Meal', days: 'Days' },
  hi: { medicine: 'दवा', morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम',
        beforeMeal: 'खाने से पहले', afterMeal: 'खाने के बाद', days: 'दिन' },
  mr: { medicine: 'औषध', morning: 'सकाळी', afternoon: 'दुपारी', evening: 'संध्याकाळी',
        beforeMeal: 'जेवणापूर्वी', afterMeal: 'जेवणानंतर', days: 'दिवस' },
}

/* Parse DB item (dosage string "1-0-1 After meal 40", duration "20 days")
   back into structured timing/meal/days for the table display. */
function parseMed(item) {
  const d = item.dosage ?? ''
  const dur = item.duration ?? ''
  const tim = d.match(/^(\d+)-(\d+)-(\d+)/)
  const days = (dur.match(/^(\d+)/) || [])[1] ?? ''
  const timingCount = tim ? [tim[1],tim[2],tim[3]].filter(n => Number(n) > 0).length : 0
  const dose = tim ? (Number(tim[1]) || Number(tim[2]) || Number(tim[3]) || 1) : 1
  const qty = timingCount > 0 && days ? String(timingCount * dose * Number(days)) : ''
  return {
    id:          item.id,
    name:        item.medicine_name,
    morning:     tim ? Number(tim[1]) > 0 : false,
    afternoon:   tim ? Number(tim[2]) > 0 : false,
    evening:     tim ? Number(tim[3]) > 0 : false,
    beforeMeal:  /before meal/i.test(d),
    afterMeal:   /after meal/i.test(d),
    days,
    qty,
    notes:       item.instructions ?? '',
  }
}

/* ── Shared medicine table (same format as RxPreview) ───────────────── */
function MedicineList({ items, L }) {
  if (!items?.length) return <p className="print-no-medicines">No medicines on this prescription.</p>
  const meds = items.map(parseMed)
  return (
    <table className="rxp-med-table">
      <tbody>
        {meds.map(m => {
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

/* ── Signature block ─────────────────────────────────────────────────── */

function Signature({ name, qualification, registrationNumber }) {
  return (
    <div className="print-signature-section">
      <div className="print-signature-block">
        <div className="print-signature-line" />
        <div className="print-signature-name">{name}</div>
        {qualification && (
          <div className="print-signature-qual">{qualification}</div>
        )}
        {registrationNumber && (
          <div className="print-signature-qual">Reg. No: {registrationNumber}</div>
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

  const [prescription,       setPrescription]       = useState(null)
  const [settings,           setSettings]           = useState(null)
  const [pageStatus,         setPageStatus]         = useState('loading')
  const [pdfBlobUrl,         setPdfBlobUrl]         = useState(null)
  const [pdfLayout,          setPdfLayout]          = useState(null)
  const [templateLoadFailed, setTemplateLoadFailed] = useState(false)

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
          const s = String(err).toLowerCase()
          if (s.includes('not found'))    setPageStatus('not-found')
          else if (s.includes('access'))  setPageStatus('forbidden')
          else                            setPageStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [prescriptionId])

  // Load template file. Images use data URLs (universal WebView2 support, works with
  // tauri:// production scheme). PDFs use blob URLs — required by frame-src CSP.
  useEffect(() => {
    if (pageStatus !== 'done' || !settings) return
    const templatePath = settings.prescription_template_path
    const ext = (settings.prescription_template ?? '').split('.').pop()?.toLowerCase() ?? ''
    if (!templatePath || !ext) return

    const isPdfExt   = ext === 'pdf'
    const isImageExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
    if (!isPdfExt && !isImageExt) return

    setTemplateLoadFailed(false)
    let createdUrl = null
    let cancelled  = false

    invoke('read_template_file', { path: templatePath })
      .then(b64 => {
        if (cancelled) return
        if (isPdfExt) {
          // PDF: must use blob URL for iframe (frame-src CSP allows blob:, not data:)
          const binary = atob(b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          createdUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        } else {
          // Image: data URL works in all WebView2 contexts — blob: URLs can break
          // when the page origin is tauri:// (production build) on some WebView2 versions
          createdUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${b64}`
        }
        setPdfBlobUrl(createdUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setPdfBlobUrl(null)
          setTemplateLoadFailed(true)
        }
      })

    if (isPdfExt) {
      invoke('scan_template_layout', { path: templatePath })
        .then(layout => { if (!cancelled) setPdfLayout(layout) })
        .catch(() => { if (!cancelled) setPdfLayout(null) })
    }

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
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

  /* Read language stored at save time — fall back to last used lang, then en */
  const lang = (
    localStorage.getItem('clinora:rx-lang-' + prescriptionId) ||
    localStorage.getItem('clinora:rx-lang') ||
    'en'
  )
  const L = LANG[lang] || LANG.en

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
     MODE A — No custom template, OR template file failed to load:
              use the default HTML/CSS template
     ══════════════════════════════════════════════════════════════════ */
  if (!hasTemplate || templateLoadFailed) {
    return (
      <div className="print-page">
        {toolbar}
        {/* Warn on screen (hidden at print) when the active template couldn't be read */}
        {templateLoadFailed && (
          <div className="print-no-template-warn print-hide">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Template file could not be loaded — printing with the default layout. Re-upload your template if the issue persists.
          </div>
        )}
        {noTemplateWarn}
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

  /* ── PDF template: show spinner while blob URL is loading ── */
  if (isPdf && !pdfBlobUrl) {
    return (
      <div className="print-page" style={{ justifyContent: 'center' }}>
        {toolbar}
        <Spinner size={28} />
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
                <MedicineList items={prescription.items} L={L} />
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
              {prescription.visit?.diagnosis && (
                <div className="print-tpl-diagnosis">
                  <span className="print-notes-label">Diagnosis: </span>
                  <span className="print-tpl-val">{prescription.visit.diagnosis}</span>
                </div>
              )}
              <MedicineList items={prescription.items} L={L} />
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
