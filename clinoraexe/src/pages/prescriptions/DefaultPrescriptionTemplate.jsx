import '../../styles/default-prescription.css'

/* ── Language labels ──────────────────────────────────────────── */
const LANG = {
  en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
        beforeMeal: 'Before Meal', afterMeal: 'After Meal', days: 'Days', daily: 'Daily' },
  hi: { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम',
        beforeMeal: 'खाने से पहले', afterMeal: 'खाने के बाद', days: 'दिन', daily: 'रोज' },
  mr: { morning: 'सकाळी', afternoon: 'दुपारी', evening: 'संध्याकाळी',
        beforeMeal: 'जेवणापूर्वी', afterMeal: 'जेवणानंतर', days: 'दिवस', daily: 'दररोज' },
}

/* ── Helpers ──────────────────────────────────────────────────── */
function parseMed(item) {
  const d   = item.dosage   ?? ''
  const dur = item.duration ?? ''
  const tim = d.match(/^(\d+)-(\d+)-(\d+)/)
  const days = (dur.match(/^(\d+)/) || [])[1] ?? ''
  const m1 = tim ? Number(tim[1]) : 0
  const m2 = tim ? Number(tim[2]) : 0
  const m3 = tim ? Number(tim[3]) : 0
  const timingCount = [m1, m2, m3].filter(n => n > 0).length
  const doseMax = Math.max(m1, m2, m3) || 1
  const qty = timingCount > 0 && days ? String(timingCount * doseMax * Number(days)) : ''
  return {
    id: item.id,
    name: item.medicine_name,
    doseM: m1, doseA: m2, doseE: m3,
    beforeMeal: /before meal/i.test(d),
    afterMeal:  /after meal/i.test(d),
    days, qty,
    notes: item.instructions ?? '',
  }
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

function genderLabel(g) {
  return g === 'male' ? 'Male' : g === 'female' ? 'Female' : g ? String(g) : ''
}

function toLines(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return String(val).split(/\n|\r\n|\r/).map(l => l.trim()).filter(Boolean)
}

/* ── Dummy data (Settings page live preview) ──────────────────── */
const DUMMY = {
  patient: { name: 'MS. RUTUJA GAIKWAD', age: 23, gender: 'female',
             mobile: '9876543210', address: 'Shop No.4, Vasant Vihar, Pune - 411041' },
  prescribed_at: '2024-08-30T10:00:00',
  visit: {
    diagnosis: 'Viral Fever with Chills',
    chief_complaints: ['Fever with Chills (4 Days)', 'Headache (2 Days)'],
    clinical_findings: ['Temperature: 102°F', 'Throat Inflamed'],
    weight: 70, height: 170, bmi: 24.2, bp: '120/80',
  },
  items: [
    { id: 1, medicine_name: 'TAB. PARACETAMOL 500MG',  dosage: '1-1-1 After meal',  duration: '3 days', instructions: '' },
    { id: 2, medicine_name: 'TAB. CETIRIZINE 10MG',    dosage: '1-0-1 After meal',  duration: '3 days', instructions: '' },
    { id: 3, medicine_name: 'CAP. AMOXICILLIN 500MG',  dosage: '1-1-1 Before meal', duration: '5 days', instructions: '' },
  ],
  doctor_notes: 'Take bed rest.\nDrink plenty of fluids.',
  follow_up: '2024-09-04',
}

/* ── Clinora watermark — brand PNG ───────────────────────────── */
function WatermarkMark() {
  return (
    <div className="dpt-wm-wrap" aria-hidden="true">
      <img src="/logos/clinoraLogo.png" alt="" className="dpt-wm-img" />
    </div>
  )
}

/* ── Medicine list — ONE LINE per medicine, timing in words ──── */
function MedList({ items, L }) {
  if (!items?.length) return <p className="dpt-no-meds">No medicines prescribed.</p>
  const meds = items.map(parseMed)

  return (
    <div className="dpt-med-list">
      {meds.map((m, i) => {
        const timingParts = [
          m.doseM > 0 && `${m.doseM} ${L.morning}`,
          m.doseA > 0 && `${m.doseA} ${L.afternoon}`,
          m.doseE > 0 && `${m.doseE} ${L.evening}`,
        ].filter(Boolean)

        const timingStr  = timingParts.join(' + ')
        const mealStr    = m.afterMeal  ? ` (${L.afterMeal})`  : m.beforeMeal ? ` (${L.beforeMeal})` : ''
        const durationStr = m.days ? `${L.daily} - ${m.days} ${L.days}` : ''

        return (
          <div key={m.id} className="dpt-med-row">
            {/* Col 1 — number + medicine name */}
            <div className="dpt-med-name-col">
              <span className="dpt-med-num">{i + 1})</span>
              <span className="dpt-med-brand">{m.name}</span>
            </div>
            {/* Col 2 — timing in words */}
            <div className="dpt-med-timing-col">
              {timingStr}{mealStr}
            </div>
            {/* Col 3 — duration */}
            <div className="dpt-med-dur-col">
              {durationStr}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DefaultPrescriptionTemplate
   ══════════════════════════════════════════════════════════════ */
export default function DefaultPrescriptionTemplate({
  clinic,
  watermark,
  prescription,
  lang,
  isPreview,
}) {
  const L  = LANG[lang] || LANG.en
  const rx = prescription ?? DUMMY
  const cl = clinic ?? {}
  const wm = watermark ?? { text: 'Clinora', color: '#0d9488', enabled: true }

  const patient = rx.patient ?? {}
  const visit   = rx.visit   ?? {}

  const doctorName = cl.doctorName || cl.doctor_name || ''
  const clinicName = cl.name       || ''
  const regNo      = cl.regNo || cl.registration_number || ''

  /* Patient line */
  const nameAgeGender = [
    patient.name,
    (patient.age || patient.gender)
      ? `(${[patient.age ? `${patient.age}y` : '', genderLabel(patient.gender)].filter(Boolean).join(', ')})`
      : null,
  ].filter(Boolean).join(' ')

  /* Vitals */
  const vitalItems = [
    visit.bp     && { label: 'BP',     val: `${visit.bp} mmHg` },
    visit.weight && { label: 'Weight', val: `${visit.weight} Kg` },
    visit.height && { label: 'Height', val: `${visit.height} Cm` },
    visit.bmi    && { label: 'BMI',    val: Number(visit.bmi).toFixed(1) },
  ].filter(Boolean)

  /* CC / CF */
  const complaints = toLines(visit.chief_complaints)
  const findings   = toLines(visit.clinical_findings)
  const hasCCCF    = complaints.length > 0 || findings.length > 0

  const adviceLines = toLines(rx.doctor_notes)
  const followUp    = rx.follow_up || visit?.follow_up

  /* Logo for center: custom clinic logo first, else Clinora default */
  const centerLogoSrc = cl.logoUrl || '/logos/clinoraLogo.png'

  return (
    <div className={`dpt-paper${isPreview ? ' dpt-paper--preview' : ''}`}>

      {/* ── Watermark ── */}
      {wm.enabled && <WatermarkMark />}

      {/* ══ HEADER: Clinic LEFT | Logo CENTER | Doctor RIGHT ══ */}
      <div className="dpt-header">

        {/* LEFT — Clinic info */}
        <div className="dpt-hdr-clinic">
          {clinicName && <div className="dpt-clinic-name">{clinicName}</div>}
          {cl.tagline  && <div className="dpt-clinic-tagline">{cl.tagline}</div>}
          {cl.address  && <div className="dpt-clinic-addr">{cl.address}</div>}
          {(cl.contact || cl.timing) && (
            <div className="dpt-clinic-contact">
              {cl.contact && `Ph: ${cl.contact}`}
              {cl.contact && cl.timing && '  |  '}
              {cl.timing  && `Timing: ${cl.timing}`}
              {cl.days    && `  |  Closed: ${cl.days}`}
            </div>
          )}
        </div>

        {/* CENTER — Medical logo */}
        <div className="dpt-hdr-logo">
          <img src={centerLogoSrc} alt="Logo" className="dpt-logo-img" />
        </div>

        {/* RIGHT — Doctor credentials */}
        <div className="dpt-hdr-doctor">
          {doctorName       && <div className="dpt-dr-name">Dr. {doctorName}</div>}
          {cl.qualification && <div className="dpt-dr-qual">{cl.qualification}</div>}
          {cl.institution   && <div className="dpt-dr-inst">{cl.institution}</div>}
          {regNo            && <div className="dpt-dr-reg">Reg. No. {regNo}</div>}
          {cl.speciality    && <div className="dpt-dr-spec">{cl.speciality}</div>}
        </div>
      </div>

      {/* ── Teal divider ── */}
      <div className="dpt-divider" />

      {/* ══ PATIENT BLOCK ══ */}
      <div className="dpt-patient-block">
        <div className="dpt-pt-info-col">
          {nameAgeGender && (
            <div className="dpt-pt-row">
              <span className="dpt-pt-label">Name</span>
              <span className="dpt-pt-colon">:</span>
              <span className="dpt-pt-val dpt-pt-val--name">{nameAgeGender}</span>
            </div>
          )}
          {patient.mobile && (
            <div className="dpt-pt-row">
              <span className="dpt-pt-label">Phone</span>
              <span className="dpt-pt-colon">:</span>
              <span className="dpt-pt-val">{patient.mobile}</span>
            </div>
          )}
          {patient.address && (
            <div className="dpt-pt-row">
              <span className="dpt-pt-label">Address</span>
              <span className="dpt-pt-colon">:</span>
              <span className="dpt-pt-val">{patient.address}</span>
            </div>
          )}
        </div>
        <div className="dpt-pt-date-col">
          <div className="dpt-pt-row dpt-pt-row--right">
            <span className="dpt-pt-label">Date</span>
            <span className="dpt-pt-colon">:</span>
            <span className="dpt-pt-val">{fmtDate(rx.prescribed_at)}</span>
          </div>
        </div>
      </div>

      {/* ── Vitals bar ── */}
      {vitalItems.length > 0 && (
        <div className="dpt-vitals-bar">
          {vitalItems.map((v, i) => (
            <span key={i} className="dpt-vital-item">
              <strong>{v.label}</strong> {v.val}
            </span>
          ))}
        </div>
      )}

      {/* ── CC / CF ── */}
      {hasCCCF && (
        <div className="dpt-cc-cf-grid">
          <div className="dpt-cc-col">
            <div className="dpt-cc-title">Chief Complaints</div>
            {complaints.map((c, i) => <div key={i} className="dpt-cc-item">• {c}</div>)}
          </div>
          <div className="dpt-cf-col">
            <div className="dpt-cf-title">Clinical Findings</div>
            {findings.map((f, i) => <div key={i} className="dpt-cf-item">• {f}</div>)}
          </div>
        </div>
      )}

      {/* ── Diagnosis ── */}
      {visit.diagnosis && (
        <div className="dpt-diagnosis-block">
          <span className="dpt-diag-label">Diagnosis : </span>
          <span className="dpt-diag-val">{visit.diagnosis}</span>
        </div>
      )}

      {/* ── Rx symbol ── */}
      <div className="dpt-rx-row">
        <span className="dpt-rx-symbol">&#8478;</span>
      </div>

      {/* ── Medicine column headers ── */}
      <div className="dpt-med-header">
        <div className="dpt-med-hdr-name">Medicine</div>
        <div className="dpt-med-hdr-timing">Timing</div>
        <div className="dpt-med-hdr-dur">Duration</div>
      </div>

      {/* ── Medicine rows — one line each ── */}
      <MedList items={rx.items} L={L} />

      {/* ── Advice ── */}
      {adviceLines.length > 0 && (
        <div className="dpt-advice-block">
          <span className="dpt-advice-label">Advice: </span>
          {adviceLines.map((line, i) => (
            <span key={i} className="dpt-advice-line">{line}{i < adviceLines.length - 1 ? ',  ' : ''}</span>
          ))}
        </div>
      )}

      {/* ── Follow Up ── */}
      {followUp && (
        <div className="dpt-followup-row">
          Follow Up: <span className="dpt-followup-val">{fmtDate(followUp)}</span>
        </div>
      )}

      {/* ── Signature ── */}
      <div className="dpt-sig-block">
        <div className="dpt-sig-line" />
        <div className="dpt-sig-name">{doctorName ? `Dr. ${doctorName}` : 'Doctor'}</div>
        {cl.qualification && <div className="dpt-sig-qual">{cl.qualification}</div>}
      </div>

      {/* ── Footer ── */}
      <div className="dpt-footer">
        {(cl.days || cl.timing) && (
          <div className="dpt-footer-line">
            <strong>Working days:</strong>{' '}
            {[cl.days, cl.timing].filter(Boolean).join('  |  ')}
          </div>
        )}
        {cl.address && (
          <div className="dpt-footer-line">
            <strong>Address:</strong> {cl.address}
          </div>
        )}
        {cl.contact && (
          <div className="dpt-footer-line">
            <strong>For Appointment:</strong> {cl.contact}
          </div>
        )}
        {!cl.days && !cl.timing && !cl.address && !cl.contact && (
          <div className="dpt-footer-line dpt-footer-line--hint">
            Substitute with equivalent generics as required.
          </div>
        )}
      </div>

    </div>
  )
}
