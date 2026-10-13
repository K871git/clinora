import '../../styles/default-prescription.css'

/* ── Helpers ──────────────────────────────────────────────────── */
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
    days, qty,
    notes:      item.instructions ?? '',
  }
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function genderLabel(g) {
  if (!g) return ''
  return g === 'male' ? 'M' : g === 'female' ? 'F' : 'O'
}

/* ── Dummy preview data ───────────────────────────────────────── */
const DUMMY = {
  patient: { name: 'Sample Patient', age: 35, gender: 'male', mobile: '9876543210',
             address: '123 Sample Street, City' },
  prescribed_at: '2024-08-30T10:00:00',
  visit: { diagnosis: 'Viral Fever with Chills' },
  items: [
    { id: 1, medicine_name: 'TAB. PARACETAMOL 500MG',  dosage: '1-0-1 After meal',   duration: '5 days', instructions: 'ACETAMINOPHEN 500MG' },
    { id: 2, medicine_name: 'TAB. CETIRIZINE 10MG',    dosage: '0-0-1 After meal',   duration: '5 days', instructions: '' },
    { id: 3, medicine_name: 'CAP. AMOXICILLIN 500MG',  dosage: '1-1-1 Before meal',  duration: '7 days', instructions: 'AMOXICILLIN TRIHYDRATE' },
  ],
  doctor_notes: 'Take bed rest.\nDrink plenty of fluids.\nAvoid cold food and drinks.',
}

/* ── Medicine Table ───────────────────────────────────────────── */
function MedTable({ items, L }) {
  if (!items?.length) return <p className="dpt-no-meds">No medicines prescribed.</p>
  const meds = items.map(parseMed)
  return (
    <table className="dpt-med-table">
      <thead>
        <tr className="dpt-med-thead">
          <th className="dpt-th dpt-th--no"></th>
          <th className="dpt-th dpt-th--name">{L.medicine} Name</th>
          <th className="dpt-th dpt-th--dosage">Dosage</th>
          <th className="dpt-th dpt-th--dur">Duration</th>
        </tr>
      </thead>
      <tbody>
        {meds.map((m, i) => {
          const timingParts = [
            m.morning   && `1 ${L.morning}`,
            m.afternoon && `1 ${L.afternoon}`,
            m.evening   && `1 ${L.evening}`,
          ].filter(Boolean)
          const timingStr = timingParts.join(', ') || '—'
          const mealStr   = m.beforeMeal ? `(${L.beforeMeal})` : m.afterMeal ? `(${L.afterMeal})` : ''
          const daysStr   = m.days ? `${m.days} ${L.days}` : '—'
          const totStr    = m.qty ? `(Tot:${m.qty} Tab)` : ''
          return (
            <tr key={m.id} className="dpt-med-row">
              <td className="dpt-td dpt-td--no">{i + 1})</td>
              <td className="dpt-td dpt-td--name">
                <span className="dpt-med-name">{m.name}</span>
                {m.notes?.trim() && <div className="dpt-med-generic">{m.notes}</div>}
              </td>
              <td className="dpt-td dpt-td--dosage">
                <div className="dpt-dosage-line">{timingStr}</div>
                {mealStr && <div className="dpt-meal-line">{mealStr}</div>}
              </td>
              <td className="dpt-td dpt-td--dur">
                <div className="dpt-days-line">{daysStr}</div>
                {totStr && <div className="dpt-tot-line">{totStr}</div>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── Medical Cross / Caduceus placeholder ─────────────────────── */
function MedIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="26" cy="26" r="24" stroke="#0d9488" strokeWidth="2" fill="none" opacity="0.15"/>
      <rect x="22" y="10" width="8" height="32" rx="2" fill="#0d9488" opacity="0.7"/>
      <rect x="10" y="22" width="32" height="8" rx="2" fill="#0d9488" opacity="0.7"/>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   DefaultPrescriptionTemplate
   ══════════════════════════════════════════════════════════════ */
export default function DefaultPrescriptionTemplate({
  clinic,       // { name, doctorName, qualification, regNo, address, contact, timing, days, logoUrl }
  watermark,    // { text, color, enabled }
  prescription, // null → use dummy
  lang,
  isPreview,    // true when shown inside settings preview
}) {
  const L   = LANG[lang] || LANG.en
  const rx  = prescription ?? DUMMY
  const cl  = clinic ?? {}
  const wm  = watermark ?? { text: 'Clinora', color: '#0d9488', enabled: true }

  const patient = rx.patient ?? {}
  const patientLine = [
    patient.name,
    patient.gender ? `(${genderLabel(patient.gender)})` : null,
    patient.age    ? `/ ${patient.age} Y` : null,
  ].filter(Boolean).join(' ')

  const adviceLines = (rx.doctor_notes ?? '')
    .split(/\n|\r\n|\r/)
    .map(l => l.trim())
    .filter(Boolean)

  const doctorName = cl.doctorName || cl.doctor_name || ''
  const regNo      = cl.regNo || cl.registration_number || ''

  return (
    <div className={`dpt-paper${isPreview ? ' dpt-paper--preview' : ''}`}>

      {/* Watermark */}
      {wm.enabled && wm.text?.trim() && (
        <div className="dpt-watermark" aria-hidden="true" style={{ color: wm.color }}>
          {wm.text}
        </div>
      )}

      {/* ── Header ── */}
      <div className="dpt-header">
        <div className="dpt-hdr-left">
          {doctorName && <div className="dpt-dr-name">Dr. {doctorName}</div>}
          {cl.qualification && <div className="dpt-dr-qual">{cl.qualification}</div>}
          {regNo && <div className="dpt-dr-reg">Reg. No: {regNo}</div>}
        </div>

        <div className="dpt-hdr-center">
          {cl.logoUrl
            ? <img src={cl.logoUrl} alt="Logo" className="dpt-logo" />
            : <MedIcon />
          }
        </div>

        <div className="dpt-hdr-right">
          {cl.name && <div className="dpt-clinic-name">{cl.name}</div>}
          {cl.address && <div className="dpt-clinic-addr">{cl.address}</div>}
          {(cl.contact || cl.timing) && (
            <div className="dpt-clinic-contact">
              {cl.contact && `Ph: ${cl.contact}`}
              {cl.contact && cl.timing && ' | '}
              {cl.timing && `Timing: ${cl.timing}`}
            </div>
          )}
          {cl.days && <div className="dpt-clinic-contact">Closed: {cl.days}</div>}
        </div>
      </div>

      <div className="dpt-divider" />

      {/* ── Date + Patient info ── */}
      <div className="dpt-date-row">
        <span />
        <span className="dpt-date-val">Date: {fmtDate(rx.prescribed_at)}</span>
      </div>

      <div className="dpt-patient-block">
        <div className="dpt-patient-row">
          <span className="dpt-pt-label">Patient</span>
          <span className="dpt-pt-colon">:</span>
          <span className="dpt-pt-val dpt-pt-name">{patientLine || '—'}</span>
          {patient.mobile && (
            <span className="dpt-pt-mob">Mob. No.: {patient.mobile}</span>
          )}
        </div>
        {patient.address && (
          <div className="dpt-patient-row">
            <span className="dpt-pt-label">Address</span>
            <span className="dpt-pt-colon">:</span>
            <span className="dpt-pt-val">{patient.address}</span>
          </div>
        )}
      </div>

      {/* ── Diagnosis ── */}
      {rx.visit?.diagnosis && (
        <div className="dpt-diagnosis-block">
          <span className="dpt-diag-label">Diagnosis:</span>
          <span className="dpt-diag-val">R/ {rx.visit.diagnosis}</span>
        </div>
      )}

      {/* ── Rx symbol + Medicines ── */}
      <div className="dpt-rx-row">
        <span className="dpt-rx-symbol">&#8478;</span>
      </div>

      <MedTable items={rx.items} L={L} />

      {/* ── Advice ── */}
      {adviceLines.length > 0 && (
        <div className="dpt-advice-block">
          <div className="dpt-advice-label">Advice:</div>
          {adviceLines.map((line, i) => (
            <div key={i} className="dpt-advice-line">&#x2217; {line}</div>
          ))}
        </div>
      )}

      {/* ── Signature ── */}
      <div className="dpt-sig-block">
        <div className="dpt-sig-line" />
        <div className="dpt-sig-name">
          {doctorName ? `Dr. ${doctorName}` : 'Doctor'}
        </div>
        {cl.qualification && <div className="dpt-sig-qual">{cl.qualification}</div>}
        {regNo && <div className="dpt-sig-qual">Reg. No: {regNo}</div>}
      </div>

      {/* ── Footer ── */}
      <div className="dpt-footer">
        Substitute with equivalent generics as required.
      </div>

    </div>
  )
}
