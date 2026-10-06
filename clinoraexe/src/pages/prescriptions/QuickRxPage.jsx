import '../../styles/quick-rx.css'
import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { searchPatients, createPatient } from '../../services/patientService'
import { createVisit, saveFee } from '../../services/visitService'
import { createPrescription } from '../../services/prescriptionService'
import { getPatientAllergies } from '../../services/medicalHistoryService'
import { getVisit } from '../../services/visitService'
import { searchMedicineTemplates } from '../../services/medicineTplService'
import { getSettings } from '../../services/settingsService'
import { AuthContext } from '../../contexts/AuthContext'
import PageLoader from '../../components/ui/PageLoader'
import RxPreview from './RxPreview'
import { toast } from 'sonner'

/* ── Draft persistence ───────────────────────────────────────── */
const DRAFT_KEY = 'clinora:qrx-draft'
const LANG_KEY  = 'clinora:rx-lang'
function loadDraft() { try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null } catch { return null } }
function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch {} }
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY) } catch {} }
function loadLang() { return localStorage.getItem(LANG_KEY) || 'en' }
function saveLang(l) { try { localStorage.setItem(LANG_KEY, l) } catch {} }

/* ── Medicine helpers ────────────────────────────────────────── */
function newMedRow() {
  return {
    id: Math.random().toString(36).slice(2),
    name: '', morning: false, afternoon: false, evening: false,
    beforeMeal: false, afterMeal: false,
    days: '', quantity: '', notes: '',
  }
}

function buildDosage(row) {
  const hasAnyTiming = row.morning || row.afternoon || row.evening
  const timing = hasAnyTiming
    ? [row.morning ? '1' : '0', row.afternoon ? '1' : '0', row.evening ? '1' : '0'].join('-')
    : null
  const meal = [row.beforeMeal && 'Before meal', row.afterMeal && 'After meal'].filter(Boolean).join(' & ') || null
  const qty  = row.quantity?.trim() || null
  return [timing, meal, qty].filter(Boolean).join(' ') || null
}

const EMPTY_PT = { name: '', age: '', mobile: '', dob: '', gender: '', address: '' }

/* ── Language labels ─────────────────────────────────────────── */
const LANG = {
  en: { prescription: 'Prescription', patient: 'Patient', age: 'Age', date: 'Date',
        medicine: 'Medicine', timing: 'Timing', days: 'Days', notes: 'Notes',
        morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
        beforeMeal: 'Before Meal', afterMeal: 'After Meal', quantity: 'Qty',
        doctor: 'Dr.', signature: 'Signature' },
  hi: { prescription: 'पर्चा', patient: 'मरीज', age: 'उम्र', date: 'दिनांक',
        medicine: 'दवा', timing: 'समय', days: 'दिन', notes: 'नोट्स',
        morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम',
        beforeMeal: 'खाने से पहले', afterMeal: 'खाने के बाद', quantity: 'मात्रा',
        doctor: 'डॉ.', signature: 'हस्ताक्षर' },
  mr: { prescription: 'प्रिस्क्रिप्शन', patient: 'रुग्ण', age: 'वय', date: 'दिनांक',
        medicine: 'औषध', timing: 'वेळ', days: 'दिवस', notes: 'नोंद',
        morning: 'सकाळी', afternoon: 'दुपारी', evening: 'संध्याकाळी',
        beforeMeal: 'जेवणापूर्वी', afterMeal: 'जेवणानंतर', quantity: 'प्रमाण',
        doctor: 'डॉ.', signature: 'सही' },
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function QuickRxPage() {
  const { visitId: routeVisitId } = useParams()
  const navigate   = useNavigate()
  const visitMode  = !!routeVisitId
  const { user }   = useContext(AuthContext)

  /* Visit-mode */
  const [visitData, setVisitData]       = useState(null)
  const [visitLoading, setVisitLoading] = useState(visitMode)

  /* Patient */
  const [pt, setPt]                           = useState(EMPTY_PT)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [suggestions, setSuggestions]         = useState([])
  const [showSugg, setShowSugg]               = useState(false)
  const [allergies, setAllergies]             = useState([])

  /* Medicines */
  const [medicines, setMedicines]   = useState([newMedRow()])
  const [lastAddedId, setLastAddedId] = useState(null)

  /* Notes + fee */
  const [doctorNotes, setDoctorNotes] = useState('')
  const [fee, setFee]                 = useState('')

  /* Language */
  const [lang, setLang] = useState(loadLang)

  /* Preview */
  const [showPreview, setShowPreview] = useState(false)
  const [tplUrl, setTplUrl] = useState(null)

  /* UI */
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)

  const nameWrapRef = useRef(null)
  const searchTimer = useRef(null)
  const draftTimer  = useRef(null)

  /* ── Load prescription template URL ── */
  useEffect(() => {
    getSettings().then(({ data }) => setTplUrl(data.prescription_template_url ?? null)).catch(() => {})
  }, [])

  /* ── Visit mode: load patient ── */
  useEffect(() => {
    if (!visitMode) return
    getVisit(routeVisitId)
      .then(({ data }) => {
        setVisitData(data)
        setVisitLoading(false)
        getPatientAllergies(data.patient_id).then(a => setAllergies(a ?? [])).catch(() => {})
      })
      .catch(() => setVisitLoading(false))
  }, [routeVisitId, visitMode])

  /* ── Draft restore ── */
  useEffect(() => {
    if (visitMode) return
    const draft = loadDraft()
    if (!draft) return
    if (draft.pt)              setPt(draft.pt)
    if (draft.selectedPatient) setSelectedPatient(draft.selectedPatient)
    if (draft.medicines?.length) setMedicines(draft.medicines)
    if (draft.doctorNotes)     setDoctorNotes(draft.doctorNotes)
    if (draft.fee)             setFee(draft.fee)
    if (draft.selectedPatient?.id) {
      getPatientAllergies(draft.selectedPatient.id).then(a => setAllergies(a ?? [])).catch(() => {})
    }
  }, []) // eslint-disable-line

  /* ── Auto-save draft ── */
  useEffect(() => {
    if (visitMode) return
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      saveDraft({ pt, selectedPatient, medicines, doctorNotes, fee })
    }, 500)
    return () => clearTimeout(draftTimer.current)
  }, [pt, selectedPatient, medicines, doctorNotes, fee, visitMode])

  /* ── Patient name search ── */
  useEffect(() => {
    if (visitMode || selectedPatient) { setSuggestions([]); return }
    const q = pt.name.trim()
    if (q.length < 2) { setSuggestions([]); setShowSugg(false); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await searchPatients(q)
        const list = Array.isArray(data) ? data : (data?.data ?? [])
        setSuggestions(list)
        setShowSugg(list.length > 0)
      } catch { setSuggestions([]) }
    }, 280)
    return () => clearTimeout(searchTimer.current)
  }, [pt.name, selectedPatient, visitMode])

  /* ── Close patient suggestions on outside click ── */
  useEffect(() => {
    function onDown(e) {
      if (!nameWrapRef.current?.contains(e.target)) setShowSugg(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  /* ── Patient handlers ── */
  function handleNameChange(value) {
    setPt(p => ({ ...p, name: value }))
    if (selectedPatient) { setSelectedPatient(null); setAllergies([]) }
    setShowSugg(true)
  }

  function selectPatient(p) {
    setSelectedPatient(p)
    setPt({ name: p.name || '', age: p.age != null ? String(p.age) : '',
            mobile: p.mobile || '', dob: p.date_of_birth || '',
            gender: p.gender || '', address: p.address || '' })
    setShowSugg(false); setSuggestions([])
    setErrors(e => ({ ...e, name: null, mobile: null }))
    getPatientAllergies(p.id).then(a => setAllergies(a ?? [])).catch(() => {})
  }

  /* ── Medicine handlers ── */
  function updateMed(id, field, value) {
    setMedicines(ms => ms.map(m => m.id === id ? { ...m, [field]: value } : m))
  }
  function applyTemplate(medId, tpl) {
    setMedicines(ms => ms.map(m => m.id !== medId ? m : {
      ...m,
      morning:    tpl.morning,
      afternoon:  tpl.afternoon,
      evening:    tpl.evening,
      beforeMeal: tpl.meal === 'before' || tpl.meal === 'both',
      afterMeal:  tpl.meal === 'after'  || tpl.meal === 'both',
      days:       tpl.days    ? String(tpl.days) : m.days,
      quantity:   tpl.quantity || m.quantity,
      notes:      tpl.notes   || m.notes,
    }))
  }
  function addMed() {
    const row = newMedRow()
    setLastAddedId(row.id)
    setMedicines(ms => [...ms, row])
  }
  function removeMed(id) {
    setMedicines(ms => ms.length === 1 ? ms : ms.filter(m => m.id !== id))
  }

  /* ── Language toggle ── */
  function switchLang(l) { setLang(l); saveLang(l) }

  /* ── Save ── */
  async function handleSave() {
    const errs = {}
    if (!visitMode) {
      if (!pt.name.trim()) errs.name = 'Patient name is required.'
      if (!selectedPatient && !pt.mobile.trim()) errs.mobile = 'Mobile is required for new patients.'
      else if (!selectedPatient && pt.mobile.trim() && !/^\d{10}$/.test(pt.mobile.trim()))
        errs.mobile = 'Enter a valid 10-digit mobile.'
    }

    const filled = medicines.filter(m => m.name.trim())
    if (filled.length === 0) {
      errs.medicines = 'Add at least one medicine.'
    } else {
      const names = filled.map(m => m.name.trim().replace(/\s+/g, ' ').toLowerCase())
      const dupes = names.filter((n, i) => names.indexOf(n) !== i)
      if (dupes.length) {
        const dup = filled.find(m => dupes.includes(m.name.trim().replace(/\s+/g, ' ').toLowerCase()))?.name
        errs.medicines = `Duplicate: "${dup}" added more than once.`
      }
    }

    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)

    try {
      let patientId
      let visitId = routeVisitId ? Number(routeVisitId) : null

      if (!visitMode) {
        if (selectedPatient) {
          patientId = selectedPatient.id
        } else {
          const { data: np } = await createPatient({
            name: pt.name.trim(), mobile: pt.mobile.trim(),
            age: pt.age ? Number(pt.age) : null,
            date_of_birth: pt.dob || null,
            gender: pt.gender || null,
            address: pt.address.trim() || null,
            consent_obtained: true,
          })
          patientId = np.id
        }
        const { data: visit } = await createVisit(patientId, {
          visited_at: new Date().toISOString(),
          consultation_notes: doctorNotes.trim() || null,
        })
        visitId = visit.id
        if (fee && parseFloat(fee) > 0) await saveFee(visitId, parseFloat(fee))
      }

      const items = filled.map((m, idx) => ({
        medicine_name: m.name.trim(),
        dosage:        buildDosage(m),
        frequency:     null,
        duration:      m.days ? `${m.days} days` : null,
        instructions:  m.notes.trim() || null,
        sort_order:    idx,
      }))

      const { data: rx } = await createPrescription(visitId, {
        prescribed_at: new Date().toISOString(),
        doctor_notes:  visitMode ? (doctorNotes.trim() || null) : null,
        items,
      })

      clearDraft()
      navigate(`/prescriptions/${rx.id}`, { replace: true })
    } catch {
      toast.error('Could not save — please try again.')
      setSubmitting(false)
    }
  }

  if (visitLoading) return <PageLoader />

  const displayPatient = visitMode ? visitData?.patient : (selectedPatient || null)
  const previewPatient = visitMode ? visitData?.patient : {
    name: pt.name, age: pt.age, gender: pt.gender,
    mobile: pt.mobile, address: pt.address,
  }

  return (
    <div className="qrx-page">

      {/* ── Top bar ── */}
      <div className="qrx-topbar">
        <button className="btn-link detail-back" onClick={() => navigate(-1)}>
          ← {visitMode ? (visitData?.patient?.name ?? 'Back') : 'New Prescription'}
        </button>
        <div className="qrx-topbar-right">
          {/* Language toggle */}
          <div className="qrx-lang-toggle">
            {['en', 'hi', 'mr'].map(l => (
              <button
                key={l}
                className={`qrx-lang-btn${lang === l ? ' qrx-lang-btn--active' : ''}`}
                onClick={() => switchLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {!visitMode && <span className="qrx-draft-badge">Draft auto-saved</span>}
        </div>
      </div>

      {/* ── Allergy banner ── */}
      {allergies.length > 0 && (
        <div className="qrx-allergy-alert">
          <span className="qrx-allergy-icon">⚠️</span>
          <div>
            <div className="qrx-allergy-title">Allergy Alert — {displayPatient?.name || pt.name}</div>
            <div className="qrx-allergy-list">
              {allergies.map((a, i) => (
                <span key={a.id}>
                  <strong>{a.title}</strong>
                  {a.severity && ` (${a.severity})`}
                  {i < allergies.length - 1 && ' · '}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Patient section ── */}
      {!visitMode && (
        <div className="card qrx-section">
          <div className="qrx-section-label">
            Patient
            {selectedPatient && <span className="qrx-existing-badge">✓ Existing</span>}
            {!selectedPatient && pt.name.trim() && <span className="qrx-new-badge">New Patient</span>}
          </div>

          <div className="qrx-pt-row">
            <div className="qrx-pt-name-wrap" ref={nameWrapRef}>
              <input
                className={`field qrx-pt-input${errors.name ? ' has-error' : ''}${selectedPatient ? ' qrx-pt-input--filled' : ''}`}
                placeholder="Patient name…"
                value={pt.name}
                autoFocus
                onChange={e => handleNameChange(e.target.value)}
                onFocus={() => suggestions.length && setShowSugg(true)}
                autoComplete="off"
              />
              {selectedPatient && (
                <button type="button" className="qrx-pt-clear-name"
                  onClick={() => { setSelectedPatient(null); setPt(EMPTY_PT); setAllergies([]) }}
                  title="Clear patient">×</button>
              )}
              {showSugg && suggestions.length > 0 && (
                <div className="qrx-sugg-dropdown">
                  {suggestions.map(p => (
                    <button key={p.id} type="button" className="qrx-sugg-item" onClick={() => selectPatient(p)}>
                      <span className="qrx-sugg-avatar">{(p.name?.[0] ?? '?').toUpperCase()}</span>
                      <span className="qrx-sugg-name">{p.name}</span>
                      {p.mobile && <span className="qrx-sugg-chip">{p.mobile}</span>}
                      {p.age    && <span className="qrx-sugg-chip">{p.age} yrs</span>}
                      {p.gender && <span className="qrx-sugg-chip qrx-sugg-chip--gender">{p.gender}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input className="field qrx-pt-age" type="number" min="0" placeholder="Age"
              value={pt.age} onChange={e => setPt(p => ({ ...p, age: e.target.value }))} />

            <div className="qrx-pt-mobile-wrap">
              <input className={`field qrx-pt-mobile${errors.mobile ? ' has-error' : ''}`}
                placeholder="Mobile" value={pt.mobile} maxLength={10}
                onChange={e => setPt(p => ({ ...p, mobile: e.target.value }))} />
              {errors.mobile && <span className="field-error-msg qrx-inline-err">{errors.mobile}</span>}
            </div>

            <input className="field qrx-pt-dob" type="date" value={pt.dob} title="Date of birth"
              onChange={e => setPt(p => ({ ...p, dob: e.target.value }))} />

            <select className="field qrx-pt-gender" value={pt.gender}
              onChange={e => setPt(p => ({ ...p, gender: e.target.value }))}>
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <input className="field qrx-pt-address" placeholder="Address" value={pt.address}
              onChange={e => setPt(p => ({ ...p, address: e.target.value }))} />
          </div>
          {errors.name && <span className="field-error-msg" style={{ marginTop: 4, display: 'block' }}>{errors.name}</span>}
        </div>
      )}

      {/* ── Medicines ── */}
      <div className="card qrx-section">
        <div className="qrx-section-label">Medicines</div>
        {errors.medicines && <span className="field-error-msg qrx-med-err">{errors.medicines}</span>}

        <div className="qrx-med-table">
          <div className="qrx-med-header">
            <span className="qrx-col-name">Medicine</span>
            <span className="qrx-col-timing">Timing</span>
            <span className="qrx-col-meal">Meal</span>
            <span className="qrx-col-days">Days</span>
            <span className="qrx-col-qty">Qty</span>
            <span className="qrx-col-notes">Notes</span>
            <span className="qrx-col-del" />
          </div>

          {medicines.map((m, idx) => (
            <MedRow
              key={m.id}
              row={m}
              idx={idx}
              autoFocusName={m.id === lastAddedId}
              onChange={updateMed}
              onApplyTemplate={applyTemplate}
              onRemove={removeMed}
              canRemove={medicines.length > 1}
            />
          ))}
        </div>

        <button type="button" className="qrx-add-med" onClick={addMed}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Medicine
        </button>
      </div>

      {/* ── Notes — auto-grow ── */}
      <div className="card qrx-section">
        <div className="qrx-section-label">Notes <span className="qrx-opt">optional</span></div>
        <AutoTextarea
          className="field qrx-notes-ta"
          placeholder="Diagnosis, instructions for pharmacist, clinical observations…"
          value={doctorNotes}
          onChange={e => setDoctorNotes(e.target.value)}
        />
      </div>

      {/* ── Fee ── */}
      {!visitMode && (
        <div className="card qrx-section qrx-fee-card">
          <div className="qrx-section-label">Consultation Fee <span className="qrx-opt">optional</span></div>
          <div className="qrx-fee-wrap">
            <span className="qrx-fee-sym">₹</span>
            <input type="number" className="field qrx-fee-input" min="0" step="0.01"
              placeholder="0.00" value={fee}
              onChange={e => { if (parseFloat(e.target.value) < 0) return; setFee(e.target.value) }} />
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="qrx-footer">
        <div className="qrx-footer-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
          <button type="button" className="qrx-preview-btn" onClick={() => setShowPreview(true)} disabled={submitting}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Preview
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Prescription'}
          </button>
        </div>
      </div>

      {/* ── Preview overlay ── */}
      {showPreview && (
        <RxPreview
          onClose={() => setShowPreview(false)}
          patient={previewPatient}
          medicines={medicines}
          doctorNotes={doctorNotes}
          fee={fee}
          lang={lang}
          langLabels={LANG[lang] || LANG.en}
          doctorName={user?.name || 'Doctor'}
          clinicName={user?.clinic?.name || 'Clinic'}
          templateUrl={tplUrl}
        />
      )}
    </div>
  )
}

/* ── Auto-growing textarea ───────────────────────────────────── */
function AutoTextarea({ value, onChange, className, placeholder }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = ref.current.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={1}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  )
}

/* ── Medicine Row ────────────────────────────────────────────── */
function MedRow({ row, idx, autoFocusName, onChange, onApplyTemplate, onRemove, canRemove }) {
  const [medSuggs, setMedSuggs]     = useState([])
  const [showMedSugg, setShowMedSugg] = useState(false)
  const wrapRef   = useRef(null)
  const timerRef  = useRef(null)

  /* Close dropdown on outside click */
  useEffect(() => {
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setShowMedSugg(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function handleMedName(value) {
    onChange(row.id, 'name', value)
    clearTimeout(timerRef.current)
    if (value.trim().length < 2) { setMedSuggs([]); setShowMedSugg(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await searchMedicineTemplates(value.trim())
        setMedSuggs(data)
        setShowMedSugg(data.length > 0)
      } catch { setMedSuggs([]) }
    }, 250)
  }

  function selectTemplate(tpl) {
    onChange(row.id, 'name', tpl.name)
    onApplyTemplate(row.id, tpl)
    setShowMedSugg(false)
    setMedSuggs([])
  }

  return (
    <div className="qrx-med-row">
      {/* Name with template autocomplete */}
      <div className="qrx-med-name-wrap" ref={wrapRef}>
        <input
          className="field qrx-med-name"
          placeholder={`Medicine ${idx + 1}…`}
          value={row.name}
          autoFocus={autoFocusName}
          onChange={e => handleMedName(e.target.value)}
          onFocus={() => medSuggs.length && setShowMedSugg(true)}
          autoComplete="off"
        />
        {showMedSugg && medSuggs.length > 0 && (
          <div className="qrx-med-sugg">
            {medSuggs.map(t => (
              <button key={t.id} type="button" className="qrx-med-sugg-item" onClick={() => selectTemplate(t)}>
                <span className="qrx-med-sugg-name">{t.name}</span>
                <span className="qrx-med-sugg-meta">
                  {[t.morning && 'M', t.afternoon && 'A', t.evening && 'E'].filter(Boolean).join('-') || '—'}
                  {t.days ? ` · ${t.days}d` : ''}
                  {t.quantity ? ` · ${t.quantity}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timing: M A E */}
      <div className="qrx-timing-group">
        {[['morning', 'M'], ['afternoon', 'A'], ['evening', 'E']].map(([field, label]) => (
          <label key={field} className={`qrx-chk${row[field] ? ' qrx-chk--on' : ''}`}
            title={{ morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }[field]}>
            <input type="checkbox" checked={row[field]} onChange={e => onChange(row.id, field, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>

      {/* Meal: Bef Aft */}
      <div className="qrx-meal-group">
        {[['beforeMeal', 'Bef'], ['afterMeal', 'Aft']].map(([field, label]) => (
          <label key={field} className={`qrx-chk qrx-chk--meal${row[field] ? ' qrx-chk--on' : ''}`}
            title={{ beforeMeal: 'Before meal', afterMeal: 'After meal' }[field]}>
            <input type="checkbox" checked={row[field]} onChange={e => onChange(row.id, field, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>

      {/* Days */}
      <input className="field qrx-days-input" type="number" min="1" placeholder="Days"
        value={row.days} onChange={e => onChange(row.id, 'days', e.target.value)} />

      {/* Quantity */}
      <input className="field qrx-qty-input" placeholder="Qty" value={row.quantity}
        onChange={e => onChange(row.id, 'quantity', e.target.value)} />

      {/* Notes */}
      <input className="field qrx-row-notes" placeholder="Notes…" value={row.notes}
        onChange={e => onChange(row.id, 'notes', e.target.value)} />

      {canRemove ? (
        <button type="button" className="qrx-remove-btn" onClick={() => onRemove(row.id)} title="Remove">×</button>
      ) : (
        <span className="qrx-remove-placeholder" />
      )}
    </div>
  )
}
