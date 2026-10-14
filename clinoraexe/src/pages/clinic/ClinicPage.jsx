import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { listOpdRegister, recordVisitPayment, completeVisit, updateVisit } from '../../services/visitService'
import { listAppointments, createAppointment, updateAppointment, deleteAppointment } from '../../services/appointmentService'
import { searchPatients, createPatient } from '../../services/patientService'
import { sanitizeMobile, validateMobile, sanitizeAge, validateAge } from '../../lib/inputValidators'
import { confirmDelete } from '../../lib/swal'
import EmptyState from '../../components/ui/EmptyState'
import '../../styles/clinic.css'
import '../../styles/opd.css'
import '../../styles/appointments.css'

/* ── Shared helpers ─────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().split('T')[0] }

function fmtTime(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateFull(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
function parseUtc(iso) {
  if (!iso) return null
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
}
function fmtApptTime(iso) {
  const d = parseUtc(iso)
  return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
}
function fmtApptDateFull(iso) {
  const d = parseUtc(iso)
  return d ? d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

const PAY_COLOR = { paid: 'var(--clr-success)', partial: 'var(--clr-warning)', unpaid: 'var(--clr-danger)' }
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#0d9488']
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length] }

const APPT_TYPES    = ['consultation','follow_up','checkup','procedure','other']
const APPT_STATUSES = ['scheduled','confirmed','completed','cancelled','no_show']
const EMPTY_APPT = {
  patient_id: '', patient_name: '', title: '',
  scheduled_at: '', duration_minutes: 15,
  type: 'consultation', status: 'scheduled', notes: '',
}
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day.toISOString().split('T')[0]
  })
}

/* ── OPD sort indicator ─────────────────────────────────────────────── */
function OpdSort({ col, sortCol, sortDir }) {
  const active = sortCol === col
  const up   = !active || sortDir === 'asc'
  const down = !active || sortDir === 'desc'
  return (
    <span className={`opd-sort${active ? ' opd-sort--active' : ''}`} aria-hidden="true">
      {up   && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 4L3.5 1L6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'desc' ? 0.3 : 1}/></svg>}
      {down && <svg width="7" height="5" viewBox="0 0 7 5"><path d="M1 1L3.5 4L6 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={active && sortDir === 'asc' ? 0.3 : 1}/></svg>}
    </span>
  )
}

/* ── Appointments week grid ─────────────────────────────────────────── */
function WeekGrid({ days, appts, onBookSlot, onEdit, onQuickStatus, onDelete }) {
  const today = todayStr()
  const byDate = {}
  appts.forEach(a => {
    const d = a.scheduled_at?.slice(0, 10)
    if (d) { if (!byDate[d]) byDate[d] = []; byDate[d].push(a) }
  })
  Object.values(byDate).forEach(list => list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))

  return (
    <div className="appt-week-wrap">
      <div className="appt-week">
        {days.map((dateStr, i) => {
          const dayAppts = byDate[dateStr] ?? []
          const dayNum   = parseInt(dateStr.split('-')[2])
          const isToday  = dateStr === today
          return (
            <div key={dateStr} className={`appt-wday${isToday ? ' appt-wday--today' : ''}`}>
              <div className="appt-wday-hdr">
                <span className="appt-wday-name">{DAY_NAMES[i]}</span>
                <span className="appt-wday-num">{dayNum}</span>
                {dayAppts.length > 0 && <span className="appt-wday-count">{dayAppts.length}</span>}
              </div>
              <div className="appt-wday-body">
                {dayAppts.map(appt => (
                  <div key={appt.id} className={`appt-wcard appt-wcard--${appt.status}`} onClick={() => onEdit(appt)}>
                    <div className="appt-wcard-time">{fmtApptTime(appt.scheduled_at)}</div>
                    <div className="appt-wcard-patient">{appt.patient?.name}</div>
                    <div className="appt-wcard-type">{appt.title || appt.type.replace('_', ' ')}</div>
                    <div className="appt-wcard-btns">
                      {appt.status === 'scheduled' && (
                        <button onClick={e => { e.stopPropagation(); onQuickStatus(appt, 'confirmed') }} title="Confirm">✓</button>
                      )}
                      {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                        <button onClick={e => { e.stopPropagation(); onQuickStatus(appt, 'completed') }} title="Mark done">Done</button>
                      )}
                      <button className="appt-wcard-del" onClick={e => { e.stopPropagation(); onDelete(appt.id) }} title="Remove">✕</button>
                    </div>
                  </div>
                ))}
                <button className="appt-wday-add" onClick={() => onBookSlot(dateStr)}>+ Book</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function ClinicPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('opd')

  /* ── OPD state ── */
  const [opdDate,    setOpdDate]    = useState(todayStr())
  const [visits,     setVisits]     = useState([])
  const [opdLoading, setOpdLoading] = useState(true)
  const [sortCol,    setSortCol]    = useState(null)
  const [sortDir,    setSortDir]    = useState('asc')

  /* ── Appointments state ── */
  const [appointments, setAppointments] = useState([])
  const [apptLoading,  setApptLoading]  = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd,      setShowAdd]      = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [form,         setForm]         = useState(EMPTY_APPT)
  const [saving,       setSaving]       = useState(false)
  const [patSearch,    setPatSearch]    = useState('')
  const [patResults,   setPatResults]   = useState([])
  const [patSearching, setPatSearching] = useState(false)
  const [showNewPat,   setShowNewPat]   = useState(false)
  const [newPat,       setNewPat]       = useState({ name: '', mobile: '', age: '', gender: '' })
  const [creatingPat,  setCreatingPat]  = useState(false)
  const [apptView,     setApptView]     = useState('list')
  const [weekAppts,    setWeekAppts]    = useState([])
  const [weekLoading,  setWeekLoading]  = useState(false)
  const [dupPatient,   setDupPatient]   = useState(null)

  /* ── OPD load ── */
  const loadOpd = useCallback(() => {
    setOpdLoading(true)
    listOpdRegister(opdDate)
      .then(setVisits)
      .catch(() => toast.error('Could not load OPD register'))
      .finally(() => setOpdLoading(false))
  }, [opdDate])

  useEffect(() => { if (activeTab === 'opd') loadOpd() }, [loadOpd, activeTab])

  /* ── Appointments load ── */
  const loadAppts = useCallback(() => {
    setApptLoading(true)
    const filters = { date: selectedDate }
    if (statusFilter) filters.status = statusFilter
    listAppointments(filters)
      .then(setAppointments)
      .catch(() => toast.error('Could not load appointments'))
      .finally(() => setApptLoading(false))
  }, [selectedDate, statusFilter])

  useEffect(() => {
    if (activeTab === 'appointments' && apptView === 'list') loadAppts()
  }, [loadAppts, activeTab, apptView])

  const loadWeekData = useCallback(async (dateStr) => {
    setWeekLoading(true)
    const days = getWeekDays(dateStr)
    const months = [...new Set(days.map(d => d.slice(0, 7)))]
    try {
      const results = await Promise.all(months.map(m => listAppointments({ month: m })))
      const all = results.flat()
      const daySet = new Set(days)
      setWeekAppts(all.filter(a => daySet.has(a.scheduled_at?.slice(0, 10))))
    } catch { toast.error('Could not load week') }
    finally { setWeekLoading(false) }
  }, [])

  useEffect(() => {
    if (activeTab === 'appointments' && apptView === 'week') loadWeekData(selectedDate)
  }, [apptView, selectedDate, loadWeekData, activeTab])

  /* ── Patient search debounce ── */
  useEffect(() => {
    if (!patSearch.trim() || patSearch.length < 2) { setPatResults([]); return }
    const t = setTimeout(async () => {
      setPatSearching(true)
      try {
        const res = await searchPatients(patSearch)
        setPatResults(res.data?.data ?? res.data ?? [])
      } catch { setPatResults([]) }
      finally { setPatSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [patSearch])

  /* ── OPD sort ── */
  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sorted = useMemo(() => {
    if (!sortCol) return visits
    return [...visits].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = (a.patient?.name ?? '').localeCompare(b.patient?.name ?? '')
      else if (sortCol === 'time') cmp = new Date(a.visited_at ?? 0) - new Date(b.visited_at ?? 0)
      else if (sortCol === 'status') cmp = (a.status ?? '').localeCompare(b.status ?? '')
      else if (sortCol === 'fee') cmp = (a.consultation_fee || 0) - (b.consultation_fee || 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [visits, sortCol, sortDir])

  /* ── OPD quick status toggle ── */
  const [togglingStatusId, setTogglingStatusId] = useState(null)
  async function handleToggleStatus(v, e) {
    e.stopPropagation()
    setTogglingStatusId(v.id)
    try {
      if (v.status === 'open') {
        await completeVisit(v.id)
        setVisits(prev => prev.map(x => x.id === v.id ? { ...x, status: 'completed' } : x))
        toast.success(`Done — ${v.patient?.name ?? 'Visit'}`)
      } else {
        await updateVisit(v.id, { status: 'open' })
        setVisits(prev => prev.map(x => x.id === v.id ? { ...x, status: 'open' } : x))
        toast.success(`Reopened — ${v.patient?.name ?? 'Visit'}`)
      }
    } catch { toast.error('Could not update visit status') }
    finally { setTogglingStatusId(null) }
  }

  /* ── OPD quick pay ── */
  const [markingPaidId, setMarkingPaidId] = useState(null)
  async function handleMarkPaid(v, e) {
    e.stopPropagation()
    if (!v.consultation_fee || v.consultation_fee <= 0) { toast.error('No fee set — go to visit to add fee first'); return }
    setMarkingPaidId(v.id)
    try {
      await recordVisitPayment(v.id, { payment_status: 'paid', amount_paid: v.consultation_fee })
      setVisits(prev => prev.map(x => x.id === v.id ? { ...x, payment_status: 'paid', amount_paid: v.consultation_fee } : x))
      toast.success(`Marked paid — ₹${v.consultation_fee}`)
    } catch {
      toast.error('Could not record payment — try again.')
    } finally {
      setMarkingPaidId(null)
    }
  }

  /* ── OPD date nav ── */
  function pickOpdDate(offset) {
    const d = new Date(opdDate); d.setDate(d.getDate() + offset)
    setOpdDate(d.toISOString().split('T')[0])
  }
  const isOpdToday = opdDate === todayStr()
  const totalFee  = visits.reduce((s, v) => s + (v.consultation_fee || 0), 0)
  const openCount = visits.filter(v => v.status === 'open').length
  const doneCount = visits.filter(v => v.status === 'completed').length
  const paidFee   = visits.filter(v => v.payment_status === 'paid').reduce((s, v) => s + (v.consultation_fee || 0), 0)

  /* ── Appointments actions ── */
  function openAdd(dateStr) {
    const date = dateStr ?? selectedDate
    setForm({ ...EMPTY_APPT, scheduled_at: `${date}T09:00` })
    setPatSearch(''); setPatResults([])
    setEditing(null); setShowNewPat(false)
    setNewPat({ name: '', mobile: '', age: '', gender: '' })
    setShowAdd(true)
  }
  function openEdit(appt) {
    const dt = appt.scheduled_at ? appt.scheduled_at.slice(0, 16) : ''
    setForm({
      patient_id: appt.patient_id, patient_name: appt.patient?.name || '',
      title: appt.title || '', scheduled_at: dt,
      duration_minutes: appt.duration_minutes, type: appt.type,
      status: appt.status, notes: appt.notes || '',
    })
    setPatSearch(appt.patient?.name || '')
    setEditing(appt); setShowAdd(true)
  }
  function pickApptDate(offset) {
    const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }
  function pickWeek(offset) {
    const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + offset * 7)
    setSelectedDate(d.toISOString().split('T')[0])
  }
  async function handleCreatePatient() {
    if (!newPat.name.trim()) { toast.error('Patient name is required'); return }
    const mobileErr = validateMobile(newPat.mobile)
    if (mobileErr) { toast.error(mobileErr); return }
    const ageErr = validateAge(newPat.age)
    if (ageErr) { toast.error(ageErr); return }
    if (dupPatient) {
      toast.error(`Patient already exists: ${dupPatient.name}. Select them from the list instead.`)
      return
    }
    setCreatingPat(true)
    try {
      const payload = { name: newPat.name.trim() }
      if (newPat.mobile) payload.mobile = newPat.mobile
      if (newPat.age)    payload.age    = Number(newPat.age)
      if (newPat.gender) payload.gender = newPat.gender
      const { data: patient } = await createPatient(payload)
      setForm(f => ({ ...f, patient_id: patient.id, patient_name: patient.name }))
      setPatSearch(patient.name); setPatResults([]); setShowNewPat(false); setDupPatient(null)
      toast.success(`${patient.name} added`, {
        description: 'Basic profile saved. Add history, address & more.',
        action: { label: 'Complete Profile', onClick: () => navigate(`/patients/${patient.id}`) },
      })
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Could not create patient')
    } finally { setCreatingPat(false) }
  }
  async function handleSaveAppt() {
    if (!form.patient_id)   { toast.error('Select a patient'); return }
    if (!form.scheduled_at) { toast.error('Set date and time'); return }
    setSaving(true)
    try {
      const payload = {
        patient_id:       Number(form.patient_id),
        scheduled_at:     form.scheduled_at.replace('T', ' ') + ':00',
        duration_minutes: Number(form.duration_minutes),
        type:             form.type,
        status:           form.status,
        title:            form.title  || null,
        notes:            form.notes  || null,
      }
      if (editing) {
        const updated = await updateAppointment(editing.id, payload)
        setAppointments(prev => prev.map(a => a.id === editing.id ? updated : a))
        if (apptView === 'week') await loadWeekData(selectedDate)
        toast.success('Updated')
      } else {
        const created = await createAppointment(payload)
        setAppointments(prev => [...prev, created].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
        if (apptView === 'week') await loadWeekData(selectedDate)
        toast.success('Appointment booked')
      }
      setShowAdd(false)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Failed to save')
    } finally { setSaving(false) }
  }
  async function handleDelete(id) {
    const ok = await confirmDelete({ title: 'Cancel this appointment?', text: 'This cannot be undone.' })
    if (!ok) return
    try {
      await deleteAppointment(id)
      setAppointments(prev => prev.filter(a => a.id !== id))
      setWeekAppts(prev => prev.filter(a => a.id !== id))
      toast.success('Removed')
    } catch { toast.error('Failed to remove') }
  }
  async function quickStatus(appt, status) {
    try {
      const updated = await updateAppointment(appt.id, { status })
      setAppointments(prev => prev.map(a => a.id === appt.id ? updated : a))
      setWeekAppts(prev => prev.map(a => a.id === appt.id ? { ...a, status } : a))
      const label = status === 'confirmed' ? 'Confirmed' : status === 'completed' ? 'Marked done' : 'Updated'
      toast.success(`${label} — ${appt.patient?.name ?? 'Appointment'}`)
    } catch { toast.error('Failed to update status') }
  }
  const weekDays = getWeekDays(selectedDate)

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="cpd-page">

      {/* ── Tab bar ── */}
      <div className="cpd-tabs">
        <button
          className={`cpd-tab${activeTab === 'opd' ? ' cpd-tab--on' : ''}`}
          onClick={() => setActiveTab('opd')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          OPD Register
          {visits.length > 0 && activeTab !== 'opd' && (
            <span className="cpd-tab-badge">{visits.length}</span>
          )}
        </button>
        <button
          className={`cpd-tab${activeTab === 'appointments' ? ' cpd-tab--on' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Appointments
          {appointments.length > 0 && activeTab !== 'appointments' && (
            <span className="cpd-tab-badge">{appointments.length}</span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          OPD TAB
          ═══════════════════════════════════════════════ */}
      {activeTab === 'opd' && (
        <>
          {/* Header */}
          <div className="cpd-hdr">
            <div className="cpd-hdr-left">
              <h1 className="cpd-title">OPD Register</h1>
              <span className="cpd-date-full">{fmtDateFull(opdDate)}</span>
            </div>
            <div className="cpd-date-nav">
              <button className="cpd-nav-btn" onClick={() => pickOpdDate(-1)}>‹ Prev</button>
              <input type="date" className="cpd-date-input" value={opdDate} onChange={e => setOpdDate(e.target.value)} />
              <button className="cpd-nav-btn" onClick={() => pickOpdDate(1)} disabled={isOpdToday}>Next ›</button>
              {!isOpdToday && (
                <button className="cpd-nav-btn cpd-nav-btn--today" onClick={() => setOpdDate(todayStr())}>Today</button>
              )}
            </div>
            <div className="cpd-hdr-right">
              {visits.length > 0 && (
                <button className="btn-secondary opd-print-btn" onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Print
                </button>
              )}
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => navigate('/prescriptions/new')}>
                + Prescription
              </button>
            </div>
          </div>

          {/* Gray body zone */}
          <div className="cpd-body">

            {/* Stat strip — card */}
            {visits.length > 0 && (
              <div className="cpd-strip">
                <div className="cpd-stat">
                  <div className="cpd-stat-val">{visits.length}</div>
                  <div className="cpd-stat-lbl">Total</div>
                </div>
                <div className={`cpd-stat${openCount > 0 ? ' cpd-stat--warn' : ''}`}>
                  <div className="cpd-stat-val">{openCount}</div>
                  <div className="cpd-stat-lbl">Open</div>
                </div>
                <div className={`cpd-stat${doneCount > 0 ? ' cpd-stat--ok' : ''}`}>
                  <div className="cpd-stat-val">{doneCount}</div>
                  <div className="cpd-stat-lbl">Done</div>
                </div>
                <div className="cpd-stat cpd-stat--blue">
                  <div className="cpd-stat-val">₹{totalFee.toLocaleString('en-IN')}</div>
                  <div className="cpd-stat-lbl">Billed</div>
                </div>
                <div className={`cpd-stat${paidFee > 0 ? ' cpd-stat--green' : ''}`}>
                  <div className="cpd-stat-val">₹{paidFee.toLocaleString('en-IN')}</div>
                  <div className="cpd-stat-lbl">Collected</div>
                </div>
              </div>
            )}

            {/* Table / states — card */}
            {opdLoading ? (
              <div className="cpd-loading">Loading visits…</div>
            ) : visits.length === 0 ? (
              <div className="cpd-empty">
                <div className="cpd-empty-icon">📋</div>
                <div className="cpd-empty-title">No visits for {isOpdToday ? 'today' : fmtDateShort(opdDate)}</div>
                <div className="cpd-empty-sub">Start a new prescription to record a visit</div>
                {isOpdToday && (
                  <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('/prescriptions/new')}>
                    + Start First Visit
                  </button>
                )}
              </div>
            ) : (
              <div className="cpd-table-card">
                <table className="opd-table">
                  <thead>
                    <tr>
                      <th className="opd-th-num">#</th>
                      <th className="opd-th--sortable" onClick={() => toggleSort('name')}>
                        Patient <OpdSort col="name" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="opd-th-time opd-th--sortable" onClick={() => toggleSort('time')}>
                        Time <OpdSort col="time" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="opd-th-age">Age / Sex</th>
                      <th>Notes / Complaint</th>
                      <th className="opd-th-status opd-th--sortable" onClick={() => toggleSort('status')}>
                        Status <OpdSort col="status" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="opd-th-fee opd-th--sortable" onClick={() => toggleSort('fee')}>
                        Fee <OpdSort col="fee" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className="opd-th-pay">Payment</th>
                      <th className="opd-th-fu">Follow-up</th>
                      <th className="opd-th-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((v, idx) => {
                      const name   = v.patient?.name ?? '—'
                      const isOpen = v.status === 'open'
                      return (
                        <tr key={v.id} className="opd-tr" onClick={() => navigate(`/visits/${v.id}`)}>
                          <td className="opd-td-num">{idx + 1}</td>
                          <td className="opd-td-name">
                            <div className="opd-avatar" style={{ background: avatarColor(name) }}>{name[0]?.toUpperCase()}</div>
                            <div>
                              <div className="opd-patient-name">{name}</div>
                              {v.patient?.mobile && <div className="opd-patient-mob">{v.patient.mobile}</div>}
                            </div>
                          </td>
                          <td className="opd-td-time">{fmtTime(v.visited_at)}</td>
                          <td className="opd-td-age">
                            {v.patient?.age ? `${v.patient.age}y` : '—'}
                            {v.patient?.gender && <span className="opd-gender"> {v.patient.gender[0].toUpperCase()}</span>}
                          </td>
                          <td className="opd-td-notes">
                            {v.consultation_notes
                              ? <span title={v.consultation_notes.length > 60 ? v.consultation_notes : undefined}>
                                  {v.consultation_notes.length > 60 ? v.consultation_notes.slice(0, 58) + '…' : v.consultation_notes}
                                </span>
                              : <span className="opd-muted">—</span>}
                          </td>
                          <td className="opd-td-status" onClick={e => e.stopPropagation()}>
                            <button
                              className={`opd-status-btn opd-status-btn--${v.status}`}
                              onClick={e => handleToggleStatus(v, e)}
                              disabled={togglingStatusId === v.id}
                              title={isOpen ? 'Click to mark done' : 'Click to reopen'}
                            >
                              {togglingStatusId === v.id ? '…' : isOpen ? 'Open' : 'Done'}
                            </button>
                          </td>
                          <td className="opd-td-fee">
                            {v.consultation_fee > 0 ? `₹${v.consultation_fee.toLocaleString('en-IN')}` : <span className="opd-muted">—</span>}
                          </td>
                          <td className="opd-td-pay" onClick={e => e.stopPropagation()}>
                            {v.consultation_fee > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="opd-pay-dot" style={{ color: PAY_COLOR[v.payment_status] ?? PAY_COLOR.unpaid }}>● {v.payment_status}</span>
                                {v.payment_status !== 'paid' && (
                                  <button
                                    className="opd-mark-paid-btn"
                                    onClick={e => handleMarkPaid(v, e)}
                                    disabled={markingPaidId === v.id}
                                    title="Mark as paid"
                                  >
                                    {markingPaidId === v.id ? '…' : 'Paid'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="opd-muted">—</span>
                            )}
                          </td>
                          <td className="opd-td-fu">
                            {v.followup_date
                              ? <span className="opd-fu-badge">{fmtDateShort(v.followup_date)}</span>
                              : <span className="opd-muted">—</span>}
                          </td>
                          <td className="opd-td-actions" onClick={e => e.stopPropagation()}>
                            <button
                              className="opd-rx-btn"
                              onClick={e => { e.stopPropagation(); navigate(`/prescriptions/new?patient=${v.patient_id}`) }}
                              title="Write new prescription"
                            >
                              + Rx
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>{/* end cpd-body */}
        </>
      )}

      {/* ═══════════════════════════════════════════════
          APPOINTMENTS TAB
          ═══════════════════════════════════════════════ */}
      {activeTab === 'appointments' && (
        <>
          {/* Header */}
          <div className="cpd-hdr">
            <div className="cpd-hdr-left">
              <h1 className="cpd-title">Appointments</h1>
              {apptView === 'list'
                ? <span className="cpd-date-full">{fmtApptDateFull(selectedDate)}</span>
                : <span className="cpd-date-full">
                    {new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' — '}
                    {new Date(weekDays[6] + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
              }
            </div>
            <div className="cpd-date-nav">
              {apptView === 'list' ? (
                <>
                  <button className="cpd-nav-btn" onClick={() => pickApptDate(-1)}>‹ Prev</button>
                  <button className="cpd-nav-btn" onClick={() => pickApptDate(1)}>Next ›</button>
                  <button className="cpd-nav-btn cpd-nav-btn--today" onClick={() => setSelectedDate(todayStr())}>Today</button>
                </>
              ) : (
                <>
                  <button className="cpd-nav-btn" onClick={() => pickWeek(-1)}>‹ Prev</button>
                  <button className="cpd-nav-btn" onClick={() => pickWeek(1)}>Next ›</button>
                  <button className="cpd-nav-btn cpd-nav-btn--today" onClick={() => setSelectedDate(todayStr())}>This Week</button>
                </>
              )}
            </div>
            <div className="cpd-hdr-right">
              <div className="cpd-view-seg">
                <button className={`cpd-view-btn${apptView === 'list' ? ' cpd-view-btn--on' : ''}`} onClick={() => setApptView('list')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  List
                </button>
                <button className={`cpd-view-btn${apptView === 'week' ? ' cpd-view-btn--on' : ''}`} onClick={() => setApptView('week')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Week
                </button>
              </div>
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => openAdd()}>
                + Book Appointment
              </button>
            </div>
          </div>

          {/* Status filter tabs (list view only) */}
          {apptView === 'list' && (
            <div className="cpd-filter-bar">
              {['', ...APPT_STATUSES].map(s => (
                <button
                  key={s}
                  className={`cpd-filter-btn${statusFilter === s ? ' cpd-filter-btn--on' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s ? s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
                </button>
              ))}
            </div>
          )}

          {/* Gray body zone */}
          <div className="cpd-body">

            {/* List view */}
            {apptView === 'list' && (
              apptLoading ? (
                <div className="cpd-loading">Loading appointments…</div>
              ) : appointments.length === 0 ? (
                <div className="cpd-empty">
                  <div className="cpd-empty-icon">📅</div>
                  <div className="cpd-empty-title">No appointments for this day</div>
                  <div className="cpd-empty-sub">Book a new appointment using the button above</div>
                </div>
              ) : (
                <div className="cpd-appt-card">
                  {appointments.map(appt => (
                    <div key={appt.id} className="cpd-appt-row">
                      <div className={`cpd-appt-accent cpd-appt-accent--${appt.status}`} />
                      <div className="cpd-appt-time-blk">
                        <div className="cpd-appt-time">{fmtApptTime(appt.scheduled_at)}</div>
                        <div className="cpd-appt-dur">{appt.duration_minutes} min</div>
                      </div>
                      <div className="cpd-appt-info">
                        <div className="cpd-appt-patient">{appt.patient?.name}</div>
                        <div className="cpd-appt-sub">
                          <span>{appt.title || appt.type.replace('_', ' ')}</span>
                          {appt.notes && (
                            <>
                              <span className="cpd-appt-sub-dot" />
                              <span>{appt.notes.length > 50 ? appt.notes.slice(0, 48) + '…' : appt.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`cpd-appt-badge cpd-appt-badge--${appt.status}`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                      <div className="cpd-appt-actions">
                        {appt.status === 'scheduled' && (
                          <button className="cpd-act-btn cpd-act-btn--confirm" onClick={() => quickStatus(appt, 'confirmed')}>
                            ✓ Confirm
                          </button>
                        )}
                        {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                          <button className="cpd-act-btn cpd-act-btn--done" onClick={() => quickStatus(appt, 'completed')}>
                            Done
                          </button>
                        )}
                        <button className="cpd-act-btn" onClick={() => openEdit(appt)}>Edit</button>
                        <button className="cpd-act-btn cpd-act-btn--del" onClick={() => handleDelete(appt.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Week view */}
            {apptView === 'week' && (
              weekLoading ? (
                <div className="cpd-loading">Loading week…</div>
              ) : (
                <WeekGrid
                  days={weekDays} appts={weekAppts}
                  onBookSlot={openAdd} onEdit={openEdit}
                  onQuickStatus={quickStatus} onDelete={handleDelete}
                />
              )
            )}

          </div>{/* end cpd-body */}

          {/* Book / Edit modal */}
          {showAdd && (
            <div className="emr-modal-backdrop" onClick={() => setShowAdd(false)}>
              <div className="emr-modal" onClick={e => e.stopPropagation()}>
                <h4 className="emr-modal-title">{editing ? 'Edit Appointment' : 'Book Appointment'}</h4>

                {!editing && (
                  <div className="emr-form-row" style={{ position: 'relative' }}>
                    <label>Patient *</label>
                    <input
                      value={patSearch}
                      onChange={e => { setPatSearch(e.target.value); setForm(f => ({ ...f, patient_id: '', patient_name: '' })); setShowNewPat(false) }}
                      placeholder="Search patient name…"
                      disabled={!!form.patient_id}
                    />
                    {patSearching && <div style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginTop: 4 }}>Searching…</div>}

                    {!form.patient_id && patSearch.length >= 2 && !patSearching && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
                        {patResults.length > 0
                          ? patResults.map(p => (
                              <div key={p.id}
                                onClick={() => { setForm(f => ({ ...f, patient_id: p.id, patient_name: p.name })); setPatSearch(p.name); setPatResults([]); setShowNewPat(false) }}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--clr-border)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-bg)'}
                                onMouseLeave={e => e.currentTarget.style.background = ''}
                              >
                                {p.name}{p.mobile && <span style={{ color: 'var(--clr-text-muted)' }}> · {p.mobile}</span>}
                              </div>
                            ))
                          : <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--clr-text-muted)' }}>No patient found.</div>
                        }
                        <div
                          onClick={() => { setShowNewPat(true); setNewPat(n => ({ ...n, name: patSearch })); setPatResults([]) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--clr-primary)', fontWeight: 600, borderTop: '1px solid var(--clr-border)', background: 'var(--clr-bg)' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          + Create new patient "{patSearch}"
                        </div>
                      </div>
                    )}
                    {form.patient_id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--clr-success)' }}>✓ {form.patient_name}</span>
                        <button onClick={() => { setForm(f => ({ ...f, patient_id: '', patient_name: '' })); setPatSearch('') }}
                          style={{ fontSize: 11, color: 'var(--clr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Change</button>
                      </div>
                    )}
                  </div>
                )}

                {!editing && showNewPat && (
                  <div style={{ background: 'var(--clr-bg)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 10 }}>New Patient Details</div>
                    <div className="emr-form-2col">
                      <div className="emr-form-row"><label>Name *</label><input value={newPat.name} onChange={e => setNewPat(n => ({ ...n, name: e.target.value }))} placeholder="Full name" autoFocus /></div>
                      <div className="emr-form-row"><label>Mobile</label><input value={newPat.mobile} inputMode="numeric" maxLength={10} placeholder="10-digit"
                            onChange={e => {
                              const val = sanitizeMobile(e.target.value)
                              setNewPat(n => ({ ...n, mobile: val }))
                              setDupPatient(null)
                              if (val.length === 10) {
                                searchPatients(val).then(res => {
                                  const list = res.data?.data ?? res.data ?? []
                                  const match = list.find(p => p.mobile === val)
                                  if (match) setDupPatient(match)
                                }).catch(() => {})
                              }
                            }}
                          /></div>
                      <div className="emr-form-row"><label>Age</label><input value={newPat.age} inputMode="numeric" maxLength={3} placeholder="Years" onChange={e => setNewPat(n => ({ ...n, age: sanitizeAge(e.target.value) }))} /></div>
                      <div className="emr-form-row">
                        <label>Gender</label>
                        <select value={newPat.gender} onChange={e => setNewPat(n => ({ ...n, gender: e.target.value }))}>
                          <option value="">— Select —</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    {dupPatient && (
                      <div className="cpd-dup-banner">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>Already registered: <strong>{dupPatient.name}</strong></span>
                        <button className="cpd-dup-select" onClick={() => {
                          setForm(f => ({ ...f, patient_id: dupPatient.id, patient_name: dupPatient.name }))
                          setPatSearch(dupPatient.name); setPatResults([]); setShowNewPat(false); setDupPatient(null)
                        }}>Select this patient</button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn-primary" onClick={handleCreatePatient} disabled={creatingPat || !!dupPatient} style={{ fontSize: 13 }}>{creatingPat ? 'Creating…' : 'Create & Select'}</button>
                      <button className="btn-secondary" onClick={() => { setShowNewPat(false); setDupPatient(null) }} style={{ fontSize: 13 }}>Cancel</button>
                    </div>
                  </div>
                )}

                {editing && <div className="emr-form-row"><label>Patient</label><input value={editing.patient?.name} disabled style={{ opacity: 0.7 }} /></div>}

                <div className="emr-form-row"><label>Title (optional)</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Follow-up for BP, Routine checkup…" /></div>

                <div className="emr-form-2col">
                  <div className="emr-form-row"><label>Date &amp; Time *</label><input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} /></div>
                  <div className="emr-form-row"><label>Duration (minutes)</label><input type="number" value={form.duration_minutes} min={5} max={480} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
                  <div className="emr-form-row">
                    <label>Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {APPT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div className="emr-form-row">
                    <label>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {APPT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                </div>

                <div className="emr-form-row"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

                <div className="emr-modal-footer">
                  <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveAppt} disabled={saving}>{saving ? 'Saving…' : 'Save Appointment'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
