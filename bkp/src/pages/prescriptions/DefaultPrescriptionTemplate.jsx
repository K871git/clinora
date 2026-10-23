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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
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
    { id: 1, medicine_name: 'TAB. PARACETAMOL 500MG',  dosage: '1-0-1 After meal',  duration: '5 days', instructions: 'ACETAMINOPHEN 500MG' },
    { id: 2, medicine_name: 'TAB. CETIRIZINE 10MG',    dosage: '0-0-1 After meal',  duration: '3 days', instructions: '' },
    { id: 3, medicine_name: 'CAP. AMOXICILLIN 500MG',  dosage: '1-1-1 Before meal', duration: '7 days', instructions: 'AMOXICILLIN TRIHYDRATE 500MG' },
  ],
  doctor_notes: 'Take complete bed rest.\nDrink plenty of warm fluids.\nAvoid cold food and drinks.\nDo blood test after 3 days.',
  follow_up: '2024-09-06',
}

/* ── Clinora watermark — brand PNG ───────────────────────────── */
function WatermarkMark() {
  return (
    <div className="dpt-wm-wrap" aria-hidden="true">
      <img src="/logos/clinoraLogo.png" alt="" className="dpt-wm-img" />
    </div>
  )
}

/* ── Medicine List ────────────────────────────────────────────── */
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

        const timingStr = timingParts.join(', ')
        const mealStr   = m.afterMeal ? ` (${L.afterMeal})` : m.beforeMeal ? ` (${L.beforeMeal})` : ''
        const daysStr   = m.days ? `${m.days} ${L.days}` : ''
        const totStr    = m.qty  ? `(Tot:${m.qty} Tab)` : ''

        return (
          <div key={m.id} className="dpt-med-entry">
            {/* Main row: number + name | timing | days */}
            <div className="dpt-med-row">
              <div className="dpt-med-name-col">
                <span className="dpt-med-num">{i + 1})</span>
                <span className="dpt-med-brand">{m.name}</span>
              </div>
              <div className="dpt-med-timing-col">
                {timingStr || '—'}{mealStr}
              </div>
              <div className="dpt-med-dur-col">
                {daysStr && <div className="dpt-med-days">{daysStr}</div>}
                {totStr  && <div className="dpt-med-tot">{totStr}</div>}
              </div>
            </div>
            {/* Generic / composition sub-line */}
            {m.notes?.trim() && (
              <div className="dpt-med-generic">{m.notes}</div>
            )}
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

  /* Patient summary line */
  const patientMeta = [
    patient.name,
    (patient.gender || patient.age)
      ? `(${[patient.age ? `${patient.age}y` : '', genderLabel(patient.gender)].filter(Boolean).join(', ')})`
      : null,
    patient.mobile ? `Mob. No.: ${patient.mobile}` : null,
  ].filter(Boolean).join('  ·  ')

  /* Vitals */
  const vitalItems = [
    visit.bp     && `BP: ${visit.bp} mmHg`,
    visit.weight && `Weight (Kg): ${visit.weight}`,
    visit.height
      ? visit.bmi
        ? `Height (Cm): ${visit.height} (B.M.I. = ${Number(visit.bmi).toFixed(2)})`
        : `Height (Cm): ${visit.height}`
      : null,
  ].filter(Boolean)

  /* CC / CF */
  const complaints = toLines(visit.chief_complaints)
  const findings   = toLines(visit.clinical_findings)
  const hasCCCF    = complaints.length > 0 || findings.length > 0

  const adviceLines = toLines(rx.doctor_notes)
  const followUp    = rx.follow_up || visit?.follow_up

  /* Logo: custom clinic logo OR Clinora default */
  const centerLogoSrc = cl.logoUrl || '/logos/clinoraLogo.png'

  return (
    <div className={`dpt-paper${isPreview ? ' dpt-paper--preview' : ''}`}>

      {/* ── Watermark ── */}
      {wm.enabled && <WatermarkMark />}

      {/* ══ HEADER: Clinic LEFT | Logo CENTER | Doctor RIGHT ══ */}
      <div className="dpt-header">

        {/* LEFT — clinic */}
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

        {/* CENTER — logo */}
        <div className="dpt-hdr-logo">
          <img src={centerLogoSrc} alt="Logo" className="dpt-logo-img" />
        </div>

        {/* RIGHT — doctor */}
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

      {/* ══ PATIENT BAND ══ */}
      <div className="dpt-patient-block">
        <div className="dpt-pt-main-line">
          {patientMeta && <span className="dpt-pt-meta">{patientMeta}</span>}
        </div>
        {patient.address && (
          <div className="dpt-pt-addr-line">
            <span className="dpt-pt-label">Address :</span>
            <span className="dpt-pt-addr-val">{patient.address}</span>
          </div>
        )}
        <div className="dpt-pt-date-badge">
          Date : {fmtDate(rx.prescribed_at)}
        </div>
      </div>

      {/* ── Vitals band ── */}
      {vitalItems.length > 0 && (
        <div className="dpt-vitals-bar">
          {vitalItems.map((v, i) => (
            <span key={i} className="dpt-vital-item">{v}</span>
          ))}
        </div>
      )}

      {/* ── Chief Complaints / Clinical Findings ── */}
      {hasCCCF && (
        <div className="dpt-cc-cf-grid">
          <div className="dpt-cc-col">
            <div className="dpt-cc-title">Chief Complaints</div>
            {complaints.map((c, i) => <div key={i} className="dpt-cc-item">* {c}</div>)}
          </div>
          <div className="dpt-cf-col">
            <div className="dpt-cf-title">Clinical Findings</div>
            {findings.map((f, i) => <div key={i} className="dpt-cf-item">* {f}</div>)}
          </div>
        </div>
      )}

      {/* ── Diagnosis ── */}
      {visit.diagnosis && (
        <div className="dpt-diagnosis-block">
          <div className="dpt-diag-label">Diagnosis:</div>
          <div className="dpt-diag-val">* {visit.diagnosis}</div>
        </div>
      )}

      {/* ── Rx symbol ── */}
      <div className="dpt-rx-row">
        <span className="dpt-rx-symbol">&#8478;</span>
      </div>

      {/* ── Medicine table header ── */}
      <div className="dpt-med-header">
        <div className="dpt-med-hdr-name">Medicine Name</div>
        <div className="dpt-med-hdr-timing">Dosage</div>
        <div className="dpt-med-hdr-dur">Duration</div>
      </div>

      {/* ── Medicine rows ── */}
      <MedList items={rx.items} L={L} />

      {/* ── Advice ── */}
      {adviceLines.length > 0 && (
        <div className="dpt-advice-block">
          <div className="dpt-advice-label">Advice:</div>
          {adviceLines.map((line, i) => (
            <div key={i} className="dpt-advice-line">* {line}</div>
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
