import '../../styles/rx-preview.css'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const isPdf = url => url?.toLowerCase().includes('.pdf')

export default function RxPreview({
  onClose, patient, medicines, doctorNotes, fee,
  lang, langLabels: L, doctorName, clinicName,
  templateUrl,
}) {
  const navigate = useNavigate()
  const d = new Date()
  const today = `${String(d.getDate()).padStart(2,'0')}  ${String(d.getMonth()+1).padStart(2,'0')}  ${d.getFullYear()}`
  const filled = medicines.filter(m => m.name.trim())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function medLine(m) {
    const t = [m.morning && 'Morning', m.afternoon && 'Afternoon', m.evening && 'Evening'].filter(Boolean).join(' - ')
    const meal = m.beforeMeal ? 'Before Meal' : m.afterMeal ? 'After Meal' : ''
    const days = m.days ? `${m.days} Days` : ''
    const qty  = m.quantity ? `Qty: ${m.quantity}` : ''
    return [t, meal, days, qty].filter(Boolean).join('  |  ')
  }

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
          /* ── Prescription paper ── */
          <div className="rxp-paper" id="rx-print-area">

            {/* Template (PDF or image) — full page background */}
            {isPdf(templateUrl)
              ? <iframe src={templateUrl} title="Prescription" className="rxp-tpl-bg rxp-tpl-bg--pdf" />
              : <img    src={templateUrl} alt="Prescription"   className="rxp-tpl-bg rxp-tpl-bg--img" />
            }

            {/* Data written onto the template */}
            <div className="rxp-on-tpl">

              {/* Patient name on the Name line */}
              <div className="rxp-field-name">
                {patient?.name || '—'}
              </div>

              {/* Date on the Date field */}
              <div className="rxp-field-date">{today}</div>

              {/* Medicines in the Rx area */}
              <div className="rxp-field-meds">
                {filled.length === 0
                  ? <span className="rxp-meds-empty">—</span>
                  : filled.map((m, i) => (
                    <div key={m.id} className="rxp-med-item">
                      <span className="rxp-med-num">{i + 1}.</span>
                      <div className="rxp-med-detail">
                        <span className="rxp-med-line">
                          <strong className="rxp-med-name">{m.name}</strong>
                          {medLine(m) && <span className="rxp-med-meta">  —  {medLine(m)}</span>}
                        </span>
                        {m.notes?.trim() && <span className="rxp-med-note">↳ {m.notes}</span>}
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Doctor notes */}
              {doctorNotes?.trim() && (
                <div className="rxp-field-notes">{doctorNotes}</div>
              )}

              {/* Signature */}
              <div className="rxp-field-sig">
                <div className="rxp-sig-line" />
                <div className="rxp-sig-name">{L.doctor} {doctorName}</div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
