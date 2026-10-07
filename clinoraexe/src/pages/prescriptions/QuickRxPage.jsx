import '../../styles/quick-rx.css'
import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { searchPatients, createPatient, getPatient } from '../../services/patientService'
import { createVisit, saveFee } from '../../services/visitService'
import { createPrescription, sendPrescription } from '../../services/prescriptionService'
import { getPatientAllergies } from '../../services/medicalHistoryService'
import { getVisit } from '../../services/visitService'
import { searchMedicineTemplates, saveMedicineTemplate } from '../../services/medicineTplService'
import { searchMedicines, createMedicine } from '../../services/medicineService'
import { getSettings } from '../../services/settingsService'
import { invoke } from '@tauri-apps/api/core'
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
    dosePerIntake: 1,
    days: '', quantity: '', notes: '',
  }
}

function buildDosage(row) {
  const hasAnyTiming = row.morning || row.afternoon || row.evening
  const dose = Number(row.dosePerIntake) || 1
  const timing = hasAnyTiming
    ? [row.morning ? dose : '0', row.afternoon ? dose : '0', row.evening ? dose : '0'].join('-')
    : null
  const meal = [row.beforeMeal && 'Before meal', row.afterMeal && 'After meal'].filter(Boolean).join(' & ') || null
  const qty  = row.quantity?.trim() || null
  return [timing, meal, qty].filter(Boolean).join(' ') || null
}

const EMPTY_PT = { name: '', age: '', mobile: '', dob: '', gender: '', address: '' }

/* ── Rx overlay coordinate helpers (shared with RxLivePanel) ─── */
const PANEL_W = 480          // live-preview column width in px
const TPLNAT_W = 720         // natural template width (px)
const PANEL_SCALE = PANEL_W / TPLNAT_W  // = 0.667 (exactly 2/3)

const px = mm => `${(mm / 210) * 100}%`           // horizontal % of A4 width
const py = mm => `${mm - 5}mm`                     // vertical mm with scan offset
const pw = mm => `${(mm / 210) * 100}%`

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

  /* Post-save pharmacy prompt */
  const [savedRxId,      setSavedRxId]      = useState(null)
  const [pharmacySending, setPharmacySending] = useState(false)
  const [tplUrl, setTplUrl]     = useState(null)
  const [tplPath, setTplPath]   = useState(null)
  const [tplLayout, setTplLayout] = useState(null)

  /* UI */
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)

  const nameWrapRef = useRef(null)
  const searchTimer = useRef(null)
  const draftTimer  = useRef(null)

  /* ── Load prescription template URL + path ── */
  useEffect(() => {
    getSettings().then(({ data }) => {
      setTplUrl(data.prescription_template_url ?? null)
      setTplPath(data.prescription_template_path ?? null)
    }).catch(() => {})
  }, [])

  /* ── Scan PDF template layout for live preview ── */
  useEffect(() => {
    if (!tplPath || !tplPath.toLowerCase().endsWith('.pdf')) { setTplLayout(null); return }
    invoke('scan_template_layout', { path: tplPath })
      .then(l => setTplLayout(l))
      .catch(() => setTplLayout(null))
  }, [tplPath])

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
    setMedicines(ms => ms.map(m => {
      if (m.id !== id) return m
      const next = { ...m, [field]: value }
      if (['morning', 'afternoon', 'evening', 'dosePerIntake', 'days'].includes(field)) {
        const dose = Number(next.dosePerIntake) || 1
        const timings = [next.morning, next.afternoon, next.evening].filter(Boolean).length
        const days = Number(next.days) || 0
        next.quantity = timings > 0 && days > 0 ? String(timings * dose * days) : ''
      }
      return next
    }))
  }
  function applyTemplate(medId, tpl) {
    setMedicines(ms => ms.map(m => {
      if (m.id !== medId) return m
      const next = {
        ...m,
        morning:    tpl.morning,
        afternoon:  tpl.afternoon,
        evening:    tpl.evening,
        beforeMeal: tpl.meal === 'before' || tpl.meal === 'both',
        afterMeal:  tpl.meal === 'after'  || tpl.meal === 'both',
        days:       tpl.days ? String(tpl.days) : m.days,
        notes:      tpl.notes || m.notes,
      }
      const dose = Number(next.dosePerIntake) || 1
      const timings = [next.morning, next.afternoon, next.evening].filter(Boolean).length
      const days = Number(next.days) || 0
      next.quantity = timings > 0 && days > 0 ? String(timings * dose * days) : ''
      return next
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

  /* ── Post-save pharmacy prompt handlers ── */
  async function handleSendToPharmacy() {
    setPharmacySending(true)
    try {
      await sendPrescription(savedRxId)
      toast.success('Sent to pharmacy!')
    } catch {
      toast.error('Could not send — you can send it from Prescriptions page.')
    }
    navigate('/prescriptions')
  }

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
          const ptCheck = await getPatient(patientId).catch(() => null)
          if (!ptCheck?.data?.id) {
            // Patient missing from DB (stale draft) — re-insert using stored data
            const { data: np } = await createPatient({
              name:          selectedPatient.name?.trim() || pt.name.trim(),
              mobile:        selectedPatient.mobile?.trim() || pt.mobile?.trim() || '',
              age:           selectedPatient.age ? Number(selectedPatient.age) : null,
              date_of_birth: selectedPatient.date_of_birth || null,
              gender:        selectedPatient.gender || null,
              address:       selectedPatient.address?.trim() || null,
              consent_obtained: true,
            })
            patientId = np.id
            setSelectedPatient(np)
          }
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
        const now = new Date()
        const localDt = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 19).replace('T', ' ')
        const { data: visit } = await createVisit(patientId, {
          visited_at:         localDt,
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
      setSavedRxId(rx.id)
      // Persist language with this prescription so print page uses same lang
      try { localStorage.setItem('clinora:rx-lang-' + rx.id, lang) } catch {}
      // Fire-and-forget: persist newly introduced medicines to the library
      ;(async () => {
        for (const m of filled) {
          const name = m.name.trim()
          try {
            const { data: tpls } = await searchMedicineTemplates(name)
            const hasTpl = (tpls || []).some(t => t.name.toLowerCase() === name.toLowerCase())
            if (!hasTpl) {
              const meal = m.beforeMeal && m.afterMeal ? 'both'
                : m.beforeMeal ? 'before'
                : m.afterMeal  ? 'after'
                : ''
              await saveMedicineTemplate({
                name,
                morning:   m.morning,
                afternoon: m.afternoon,
                evening:   m.evening,
                meal,
                days:     m.days ? Number(m.days) : null,
                quantity: m.quantity?.trim() || null,
                notes:    m.notes.trim() || null,
                language: lang,
              })
            }
          } catch {}
          try {
            const { data: res } = await searchMedicines(name, 5)
            const list = res?.data ?? []
            const hasMed = list.some(med => med.name.toLowerCase() === name.toLowerCase())
            if (!hasMed) {
              await createMedicine({ name })
            }
          } catch {}
        }
      })()
      setSubmitting(false)
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message ?? 'Could not save — please try again.')
      toast.error(msg)
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
        <div className="qrx-topbar-left">
          <button className="qrx-back-btn" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {visitMode ? (visitData?.patient?.name ?? 'Back') : 'Back'}
          </button>
          <div className="qrx-topbar-sep" />
          <span className="qrx-topbar-title">
            {visitMode
              ? <>{visitData?.patient ? <span className="qrx-topbar-for">{visitData.patient.name}</span> : 'Add Prescription'}</>
              : 'New Prescription'
            }
          </span>
        </div>
        <div className="qrx-topbar-right">
          {!visitMode && (
            <span className="qrx-draft-badge">
              <span className="qrx-draft-dot" />
              Draft auto-saved
            </span>
          )}
          <div className="qrx-lang-toggle">
            {['en', 'hi', 'mr'].map(l => (
              <button key={l} className={`qrx-lang-btn${lang === l ? ' qrx-lang-btn--active' : ''}`} onClick={() => switchLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column body layout ── */}
      <div className="qrx-body-layout">
      <div className="qrx-form-col">

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
            <span className="qrx-sec-icon qrx-sec-icon--patient">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span>Patient</span>
            {selectedPatient && <span className="qrx-existing-badge">✓ Existing</span>}
            {!selectedPatient && pt.name.trim() && <span className="qrx-new-badge">New</span>}
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
        <div className="qrx-section-label">
          <span className="qrx-sec-icon qrx-sec-icon--med">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
            </svg>
          </span>
          <span>Medicines</span>
        </div>
        {errors.medicines && <span className="field-error-msg qrx-med-err">{errors.medicines}</span>}

        <div className="qrx-med-table">
          <div className="qrx-med-header">
            <span className="qrx-col-name">
              <span className="qrx-col-title">Medicine</span>
              <span className="qrx-col-desc">Drug / brand name</span>
            </span>
            <span className="qrx-col-timing">
              <span className="qrx-col-title">When to Take</span>
            </span>
            <span className="qrx-col-meal">
              <span className="qrx-col-title">Food</span>
            </span>
            <span className="qrx-col-days">
              <span className="qrx-col-title">Days</span>
            </span>
            <span className="qrx-col-notes">
              <span className="qrx-col-title">Notes / Instructions</span>
            </span>
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
        <div className="qrx-section-label">
          <span className="qrx-sec-icon qrx-sec-icon--notes">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </span>
          <span>Notes</span>
          <span className="qrx-opt">optional</span>
        </div>
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
          <div className="qrx-section-label">
            <span className="qrx-sec-icon qrx-sec-icon--fee">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
            <span>Consultation Fee</span>
            <span className="qrx-opt">optional</span>
          </div>
          <div className="qrx-fee-wrap">
            <span className="qrx-fee-sym">₹</span>
            <input type="number" className="field qrx-fee-input" min="0" step="0.01"
              placeholder="0.00" value={fee}
              onChange={e => { if (parseFloat(e.target.value) < 0) return; setFee(e.target.value) }} />
          </div>
        </div>
      )}

      </div>{/* close qrx-form-col */}

      {/* ── Live preview panel ── */}
      <div className="qrx-preview-col">
        <RxLivePanel
          patient={previewPatient}
          medicines={medicines}
          doctorNotes={doctorNotes}
          langLabels={LANG[lang] || LANG.en}
          templateUrl={tplUrl}
          templatePath={tplPath}
          layout={tplLayout}
          onClick={() => setShowPreview(true)}
        />
      </div>
      </div>{/* close qrx-body-layout */}

      {/* ── Actions ── */}
      <div className="qrx-footer">
        <div className="qrx-footer-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Prescription'}
          </button>
        </div>
      </div>

      {/* ── Pharmacy prompt (shown after save) ── */}
      {savedRxId && (
        <div className="qrx-pharmacy-overlay">
          <div className="qrx-pharmacy-card">
            <div className="qrx-pharmacy-check">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3 className="qrx-pharmacy-title">Prescription Saved!</h3>
            <p className="qrx-pharmacy-desc">Send this prescription to the pharmacy now, or save it for later.</p>
            <div className="qrx-pharmacy-btns">
              <button className="btn-secondary" onClick={() => navigate('/prescriptions')} disabled={pharmacySending}>
                Save for Later
              </button>
              <button className="btn-primary" onClick={handleSendToPharmacy} disabled={pharmacySending}>
                {pharmacySending ? 'Sending…' : 'Send to Pharmacy →'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          templatePath={tplPath}
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

/* ── Rx Medicine list (shared by live panel) ─────────────────── */
function RxMedList({ filled, medLine }) {
  if (!filled.length) return <p className="rxp-empty-meds">No medicines added.</p>
  return (
    <ol className="rxp-med-list">
      {filled.map(m => (
        <li key={m.id} className="rxp-med-item">
          <span className="rxp-med-name">{m.name}</span>
          {medLine(m) && <span className="rxp-med-meta">  —  {medLine(m)}</span>}
          {m.notes?.trim() && <div className="rxp-med-note">↳ {m.notes}</div>}
        </li>
      ))}
    </ol>
  )
}

/* ── Live prescription preview panel ────────────────────────── */
function RxLivePanel({ patient, medicines, doctorNotes, langLabels: L, templateUrl, templatePath, layout, onClick }) {
  const filled = medicines.filter(m => m.name.trim())
  const now = new Date()
  const dd   = String(now.getDate()).padStart(2,'0')
  const mm   = String(now.getMonth()+1).padStart(2,'0')
  const yyyy = now.getFullYear()

  function medLine(m) {
    const t = [m.morning && L.morning, m.afternoon && L.afternoon, m.evening && L.evening]
      .filter(Boolean).join(' - ')
    const meal = m.beforeMeal ? L.beforeMeal : m.afterMeal ? L.afterMeal : ''
    const days = m.days ? `${m.days} ${L.days}` : ''
    return [t, meal, days].filter(Boolean).join('  |  ')
  }

  const isPdf = (templatePath ?? '').toLowerCase().endsWith('.pdf')

  return (
    <div className="qrx-live-panel">
      <div className="qrx-live-label">
        Live Preview
        {templateUrl && <span className="qrx-live-label-hint">click to expand</span>}
      </div>

      {!templateUrl ? (
        <div className="qrx-live-empty" onClick={onClick}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>No template</span>
          <small>Upload in Prescription Settings</small>
        </div>
      ) : (
        <div className="qrx-live-outer" onClick={onClick} title="Click to open full preview">
          <div className="qrx-live-scale-wrap" style={{ transform: `scale(${PANEL_SCALE})` }}>

            {isPdf
              ? <iframe src={templateUrl} title="Rx" className="rxp-tpl-bg rxp-tpl-bg--pdf" />
              : <img    src={templateUrl} alt="Rx"   className="rxp-tpl-bg rxp-tpl-bg--img" />
            }

            {layout ? (
              <div className="rxp-on-tpl rxp-on-tpl--abs">
                <span className="rxp-tpl-val" style={{ top: py(layout.name_y), left: px(layout.name_x) }}>
                  {patient?.name || '—'}
                </span>
                {(() => {
                  const dy = layout.date_y, dx = layout.date_x
                  const SLOT = layout.date_slot_w ?? 10.5
                  return (
                    <>
                      <span className="rxp-tpl-val" style={{ top: py(dy), left: px(dx) }}>{dd}</span>
                      <span className="rxp-tpl-val" style={{ top: py(dy), left: px(dx + SLOT) }}>{mm}</span>
                      <span className="rxp-tpl-val" style={{ top: py(dy), left: px(dx + SLOT * 2) }}>{yyyy}</span>
                    </>
                  )
                })()}
                <div style={{ position: 'absolute', top: py(layout.meds_start_y), left: px(layout.meds_x), width: pw(layout.meds_w ?? 130) }}>
                  <RxMedList filled={filled} medLine={medLine} />
                  {doctorNotes?.trim() && <div className="rxp-tpl-notes">{doctorNotes}</div>}
                </div>
              </div>
            ) : (
              <div className="rxp-on-tpl rxp-on-tpl--pad">
                <div className="rxp-pt-row">
                  <span className="rxp-tpl-val">{patient?.name || '—'}</span>
                  <span className="rxp-tpl-val">{dd}  {mm}  {yyyy}</span>
                </div>
                <RxMedList filled={filled} medLine={medLine} />
                {doctorNotes?.trim() && <div className="rxp-tpl-notes">{doctorNotes}</div>}
              </div>
            )}
          </div>

          <div className="qrx-live-hint">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Full view
          </div>
        </div>
      )}
    </div>
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
        {[['morning','Morning','qrx-chk--morning'],['afternoon','Afternoon','qrx-chk--afternoon'],['evening','Evening','qrx-chk--evening']].map(([field, label, mod]) => (
          <label key={field} className={`qrx-chk ${mod}${row[field] ? ' qrx-chk--on' : ''}`}>
            <input type="checkbox" checked={row[field]} onChange={e => onChange(row.id, field, e.target.checked)} />
            {label}
          </label>
        ))}
      </div>

      {/* Meal: Before / After — mutually exclusive */}
      <div className="qrx-meal-group">
        {[['beforeMeal','Before','qrx-chk--before'],['afterMeal','After','qrx-chk--after']].map(([field, label, mod]) => {
          const other = field === 'beforeMeal' ? 'afterMeal' : 'beforeMeal'
          const isOn  = row[field]
          const dim   = !isOn && row[other]
          return (
            <label key={field}
              className={`qrx-chk qrx-chk--meal ${mod}${isOn ? ' qrx-chk--on' : ''}${dim ? ' qrx-chk--meal-dim' : ''}`}>
              <input type="checkbox" checked={isOn} onChange={e => {
                onChange(row.id, field, e.target.checked)
                if (e.target.checked) onChange(row.id, other, false)
              }} />
              {label}
            </label>
          )
        })}
      </div>

      {/* Days */}
      <input className="field qrx-days-input" type="number" min="1" placeholder="Days"
        value={row.days} onChange={e => onChange(row.id, 'days', e.target.value)} />

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
