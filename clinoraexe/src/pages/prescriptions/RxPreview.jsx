import '../../styles/rx-preview.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'

const isPdf = name => (name ?? '').toLowerCase().endsWith('.pdf')

// Horizontal: % of A4 width — corrects for iframe PDF display scaling (720px not 794px)
// Vertical: direct mm — CSS mm at 96dpi matches PDF rendering scale (same as PrintPrescriptionPage)
const px = mm => `${(mm / 210) * 100}%`
const py = mm => `${mm - 5}mm`   // -5mm corrects CSS 96dpi vs PDF iframe display scale gap
const pw = mm => `${(mm / 210) * 100}%`

export default function RxPreview({
  onClose, patient, medicines, doctorNotes, fee,
  lang, langLabels: L, doctorName,
  templateUrl,   // asset:// URL for display
  templatePath,  // absolute file path for scan_template_layout
}) {
  const navigate = useNavigate()
  const [layout, setLayout] = useState(null)

  const d = new Date()
  const dd   = String(d.getDate()).padStart(2,'0')
  const mm   = String(d.getMonth()+1).padStart(2,'0')
  const yyyy = d.getFullYear()

  const filled = medicines.filter(m => m.name.trim())

  // Scan PDF layout to get field positions in mm
  useEffect(() => {
    if (!templatePath || !isPdf(templatePath)) { setLayout(null); return }
    invoke('scan_template_layout', { path: templatePath })
      .then(l => setLayout(l))
      .catch(() => setLayout(null))
  }, [templatePath])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="rxp-overlay" onClick={onClose}>
      <div className="rxp-sheet" onClick={e => e.stopPropagation()}>

        {/* Controls */}
        <div className="rxp-controls no-print">
          <button className="rxp-close-btn" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Close
          </button>
          {templateUrl && (
            <button className="rxp-print-btn" onClick={() => window.print()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print
            </button>
          )}
        </div>

        {/* No template */}
        {!templateUrl ? (
          <div className="rxp-no-tpl">
            <div className="rxp-no-tpl-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h3 className="rxp-no-tpl-title">No Template Uploaded</h3>
            <p className="rxp-no-tpl-desc">Upload your clinic letterhead in Prescription Settings.</p>
            <button className="rxp-go-settings-btn" onClick={() => { onClose(); navigate('/prescription-settings') }}>
              Go to Prescription Settings →
            </button>
          </div>

        ) : (
          <div className="rxp-paper" id="rx-print-area">

            {/* Template — full page background */}
            {isPdf(templatePath)
              ? <iframe src={templateUrl} title="Prescription" className="rxp-tpl-bg rxp-tpl-bg--pdf" />
              : <img    src={templateUrl} alt="Prescription"   className="rxp-tpl-bg rxp-tpl-bg--img" />
            }

            {/* Data overlaid at scanned mm positions (PDF) or padded fallback (image) */}
            {layout ? (
              /* ── Absolute mm overlay — from scan_template_layout ── */
              <div className="rxp-on-tpl rxp-on-tpl--abs">

                {/* Patient name at Name field */}
                <span className="rxp-tpl-val" style={{ top: py(layout.name_y), left: px(layout.name_x) }}>
                  {patient?.name || '—'}
                </span>

                {/* Date at Date field — three parts separated by template's "/" chars */}
                {(() => {
                  const dy = layout.date_y
                  const dx = layout.date_x
                  const SLOT = layout.date_slot_w ?? 10.5
                  return (
                    <>
                      <span className="rxp-tpl-val" style={{ top: py(dy), left: px(dx) }}>{dd}</span>
                      <span className="rxp-tpl-val" style={{ top: py(dy), left: px(dx + SLOT) }}>{mm}</span>
                      <span className="rxp-tpl-val" style={{ top: py(dy), left: px(dx + SLOT * 2) }}>{yyyy}</span>
                    </>
                  )
                })()}

                {/* Medicines in the Rx area */}
                <div style={{ position: 'absolute', top: py(layout.meds_start_y), left: px(layout.meds_x), width: pw(layout.meds_w ?? 130) }}>
                  <RxMedList filled={filled} L={L} />
                  {doctorNotes?.trim() && (
                    <div className="rxp-tpl-notes">{doctorNotes}</div>
                  )}
                </div>

              </div>

            ) : (
              /* ── Fallback: CSS padding for image templates ── */
              <div className="rxp-on-tpl rxp-on-tpl--pad">

                <div className="rxp-pt-row">
                  <span className="rxp-tpl-val">{patient?.name || '—'}</span>
                  <span className="rxp-tpl-val">{dd}  {mm}  {yyyy}</span>
                </div>

                <RxMedList filled={filled} L={L} />

                {doctorNotes?.trim() && (
                  <div className="rxp-tpl-notes">{doctorNotes}</div>
                )}

              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

function RxMedList({ filled, L }) {
  if (!filled.length) return <p className="rxp-empty-meds">No medicines added.</p>
  return (
    <table className="rxp-med-table">
      <tbody>
        {filled.map((m) => {
          const timingParts = [
            m.morning   && L.morning,
            m.afternoon && L.afternoon,
            m.evening   && L.evening,
          ].filter(Boolean)
          const meal = m.beforeMeal ? L.beforeMeal : m.afterMeal ? L.afterMeal : '—'
          const dose = Number(m.dosePerIntake) || 1
          const qty  = m.quantity || (timingParts.length > 0 && m.days
            ? String(timingParts.length * dose * Number(m.days)) : '')
          const calcNote = timingParts.length > 0 && m.days && qty
            ? `${timingParts.join(' + ')} × ${m.days} ${L.days} = ${qty} tab`
            : ''
          return (
            <tr key={m.id} className="rxp-med-tr">
              <td className="rxp-td rxp-td--name">
                <span className="rxp-med-name">{m.name}</span>
                {calcNote && <div className="rxp-med-calc">{calcNote}</div>}
                {m.notes?.trim() && <div className="rxp-med-note">↳ {m.notes}</div>}
              </td>
              <td className="rxp-td rxp-td--timing">
                {timingParts.length > 0 ? timingParts.join(' + ') : '—'}
              </td>
              <td className="rxp-td rxp-td--meal">{meal}</td>
              <td className="rxp-td rxp-td--days">{m.days || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
