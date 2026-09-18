import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { listAppointments, createAppointment, updateAppointment, deleteAppointment } from '../../services/appointmentService'
import { searchPatients, createPatient } from '../../services/patientService'
import { sanitizeMobile, validateMobile, sanitizeAge, validateAge } from '../../lib/inputValidators'
import EmptyState from '../../components/ui/EmptyState'
import '../../styles/emr.css'
import '../../styles/appointments.css'

const TYPES    = ['consultation','follow_up','checkup','procedure','other']
const STATUSES = ['scheduled','confirmed','completed','cancelled','no_show']
const EMPTY_FORM = {
  patient_id: '', patient_name: '', title: '',
  scheduled_at: '', duration_minutes: 15,
  type: 'consultation', status: 'scheduled', notes: '',
}

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

/* ── Helpers ─────────────────────────────────────────────────────────── */

function parseUtc(iso) {
  if (!iso) return null
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
}
function fmtTime(iso) {
  const d = parseUtc(iso)
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateFull(iso) {
  const d = parseUtc(iso)
  if (!d) return ''
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().split('T')[0] }

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()           // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow   // shift to Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day.toISOString().split('T')[0]
  })
}

/* ── Week grid component ─────────────────────────────────────────────── */

function WeekGrid({ days, appts, onBookSlot, onEdit, onQuickStatus, onDelete }) {
  const today = todayStr()

  // Group by date
  const byDate = {}
  appts.forEach(a => {
    const d = a.scheduled_at?.slice(0, 10)
    if (d) {
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(a)
    }
  })
  Object.values(byDate).forEach(list =>
    list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  )

  return (
    <div className="appt-week-wrap">
      <div className="appt-week">
        {days.map((dateStr, i) => {
          const dayAppts = byDate[dateStr] ?? []
          const dayNum   = parseInt(dateStr.split('-')[2])
          const isToday  = dateStr === today

          return (
            <div key={dateStr} className={`appt-wday${isToday ? ' appt-wday--today' : ''}`}>
              {/* Header */}
              <div className="appt-wday-hdr">
                <span className="appt-wday-name">{DAY_NAMES[i]}</span>
                <span className="appt-wday-num">{dayNum}</span>
                {dayAppts.length > 0 && (
                  <span className="appt-wday-count">{dayAppts.length}</span>
                )}
              </div>

              {/* Body */}
              <div className="appt-wday-body">
                {dayAppts.map(appt => (
                  <div
                    key={appt.id}
                    className={`appt-wcard appt-wcard--${appt.status}`}
                    onClick={() => onEdit(appt)}
                  >
                    <div className="appt-wcard-time">{fmtTime(appt.scheduled_at)}</div>
                    <div className="appt-wcard-patient">{appt.patient?.name}</div>
                    <div className="appt-wcard-type">
                      {appt.title || appt.type.replace('_', ' ')}
                    </div>
                    <div className="appt-wcard-btns">
                      {appt.status === 'scheduled' && (
                        <button
                          onClick={e => { e.stopPropagation(); onQuickStatus(appt, 'confirmed') }}
                          title="Confirm"
                        >✓</button>
                      )}
                      {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                        <button
                          onClick={e => { e.stopPropagation(); onQuickStatus(appt, 'completed') }}
                          title="Mark done"
                        >Done</button>
                      )}
                      <button
                        className="appt-wcard-del"
                        onClick={e => { e.stopPropagation(); onDelete(appt.id) }}
                        title="Remove"
                      >✕</button>
                    </div>
                  </div>
                ))}

                <button className="appt-wday-add" onClick={() => onBookSlot(dateStr)}>
                  + Book
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd,      setShowAdd]      = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [patSearch,    setPatSearch]    = useState('')
  const [patResults,   setPatResults]   = useState([])
  const [patSearching, setPatSearching] = useState(false)
  const [showNewPat,   setShowNewPat]   = useState(false)
  const [newPat,       setNewPat]       = useState({ name: '', mobile: '', age: '', gender: '' })
  const [creatingPat,  setCreatingPat]  = useState(false)

  // Week view
  const [view,        setView]        = useState('list')   // 'list' | 'week'
  const [weekAppts,   setWeekAppts]   = useState([])
  const [weekLoading, setWeekLoading] = useState(false)

  /* ── Data loaders ── */

  const load = useCallback(() => {
    setLoading(true)
    const filters = { date: selectedDate }
    if (statusFilter) filters.status = statusFilter
    listAppointments(filters)
      .then(setAppointments)
      .catch(() => toast.error('Could not load appointments'))
      .finally(() => setLoading(false))
  }, [selectedDate, statusFilter])

  useEffect(() => {
    if (view === 'list') load()
  }, [load, view])

  const loadWeekData = useCallback(async (dateStr) => {
    setWeekLoading(true)
    const days = getWeekDays(dateStr)
    const months = [...new Set(days.map(d => d.slice(0, 7)))]
    try {
      const results = await Promise.all(months.map(m => listAppointments({ month: m })))
      const all  = results.flat()
      const daySet = new Set(days)
      setWeekAppts(all.filter(a => daySet.has(a.scheduled_at?.slice(0, 10))))
    } catch {
      toast.error('Could not load week')
    } finally {
      setWeekLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'week') loadWeekData(selectedDate)
  }, [view, selectedDate, loadWeekData])

  // Patient search with debounce
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

  /* ── Actions ── */

  function openAdd(dateStr) {
    const date = dateStr ?? selectedDate
    setForm({ ...EMPTY_FORM, scheduled_at: `${date}T09:00` })
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
    setEditing(appt)
    setShowAdd(true)
  }

  function pickDate(offset) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function pickWeek(offset) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + offset * 7)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  async function handleCreatePatient() {
    if (!newPat.name.trim()) { toast.error('Patient name is required'); return }
    const mobileErr = validateMobile(newPat.mobile)
    if (mobileErr) { toast.error(mobileErr); return }
    const ageErr = validateAge(newPat.age)
    if (ageErr) { toast.error(ageErr); return }
    setCreatingPat(true)
    try {
      const payload = { name: newPat.name.trim() }
      if (newPat.mobile) payload.mobile = newPat.mobile
      if (newPat.age)    payload.age    = Number(newPat.age)
      if (newPat.gender) payload.gender = newPat.gender
      const { data: patient } = await createPatient(payload)
      setForm(f => ({ ...f, patient_id: patient.id, patient_name: patient.name }))
      setPatSearch(patient.name)
      setPatResults([])
      setShowNewPat(false)
      toast.success(`${patient.name} created and selected`)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Could not create patient')
    } finally {
      setCreatingPat(false)
    }
  }

  async function handleSave() {
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
        if (view === 'week') await loadWeekData(selectedDate)
        toast.success('Updated')
      } else {
        const created = await createAppointment(payload)
        setAppointments(prev =>
          [...prev, created].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
        )
        if (view === 'week') await loadWeekData(selectedDate)
        toast.success('Appointment booked')
      }
      setShowAdd(false)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Cancel this appointment?')) return
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
    } catch { toast.error('Failed to update') }
  }

  const weekDays = getWeekDays(selectedDate)

  /* ── Render ── */

  return (
    <div className="appt-page">

      {/* Toolbar */}
      <div className="appt-toolbar">
        <h2 className="appt-toolbar-title">Appointments</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* List / Week toggle */}
          <div className="appt-view-toggle">
            <button
              className={`appt-view-btn${view === 'list' ? ' appt-view-btn--active' : ''}`}
              onClick={() => setView('list')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6"  x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6"  x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              List
            </button>
            <button
              className={`appt-view-btn${view === 'week' ? ' appt-view-btn--active' : ''}`}
              onClick={() => setView('week')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
                <line x1="3"  y1="14.5" x2="8" y2="14.5"/>
                <line x1="3"  y1="18" x2="8" y2="18"/>
              </svg>
              Week
            </button>
          </div>

          <button className="emr-add-btn" onClick={() => openAdd()}>+ Book Appointment</button>
        </div>
      </div>

      {/* Date / week navigation */}
      {view === 'list' ? (
        <div className="appt-date-nav">
          <button onClick={() => pickDate(-1)}>‹ Prev</button>
          <span className="appt-date-label">{fmtDateFull(selectedDate)}</span>
          <button onClick={() => pickDate(1)}>Next ›</button>
          <button onClick={() => setSelectedDate(todayStr())} style={{ marginLeft: 4, fontSize: 12 }}>Today</button>
        </div>
      ) : (
        <div className="appt-date-nav">
          <button onClick={() => pickWeek(-1)}>‹ Prev Week</button>
          <span className="appt-date-label">
            {new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(weekDays[6] + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => pickWeek(1)}>Next Week ›</button>
          <button onClick={() => setSelectedDate(todayStr())} style={{ marginLeft: 4, fontSize: 12 }}>This Week</button>
        </div>
      )}

      {/* Status filter — list view only */}
      {view === 'list' && (
        <div className="appt-filters">
          {['', ...STATUSES].map(s => (
            <button
              key={s}
              className={`appt-filter-btn${statusFilter === s ? ' appt-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s ? s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
            </button>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {loading && <div className="emr-empty">Loading…</div>}

          {!loading && appointments.length === 0 && (
            <EmptyState
              icon="📅"
              title="No appointments for this day"
              description="Book a new appointment using the button above."
            />
          )}

          {!loading && appointments.length > 0 && (
            <div className="appt-list">
              {appointments.map(appt => (
                <div key={appt.id} className="appt-item">
                  <div className="appt-time-col">
                    <div className="appt-time">{fmtTime(appt.scheduled_at)}</div>
                    <div className="appt-date">{appt.duration_minutes}min</div>
                  </div>
                  <div className="appt-divider" />
                  <div className="appt-info">
                    <div className="appt-patient">{appt.patient?.name}</div>
                    <div className="appt-type">{appt.title || appt.type.replace('_', ' ')}</div>
                  </div>
                  <span className={`appt-status-badge appt-status-${appt.status}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                  <div className="appt-actions">
                    {appt.status === 'scheduled' && (
                      <button className="emr-icon-btn" onClick={() => quickStatus(appt, 'confirmed')} title="Confirm">✓</button>
                    )}
                    {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                      <button className="emr-icon-btn" onClick={() => quickStatus(appt, 'completed')} title="Mark done">Done</button>
                    )}
                    <button className="emr-icon-btn" onClick={() => openEdit(appt)}>Edit</button>
                    <button className="emr-icon-btn emr-icon-btn--danger" onClick={() => handleDelete(appt.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── WEEK VIEW ── */}
      {view === 'week' && (
        weekLoading ? (
          <div className="emr-empty">Loading week…</div>
        ) : (
          <WeekGrid
            days={weekDays}
            appts={weekAppts}
            onBookSlot={openAdd}
            onEdit={openEdit}
            onQuickStatus={quickStatus}
            onDelete={handleDelete}
          />
        )
      )}

      {/* ── Book / Edit modal ── */}
      {showAdd && (
        <div className="emr-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="emr-modal" onClick={e => e.stopPropagation()}>
            <h4 className="emr-modal-title">{editing ? 'Edit Appointment' : 'Book Appointment'}</h4>

            {/* Patient search (new appointments only) */}
            {!editing && (
              <div className="emr-form-row" style={{ position: 'relative' }}>
                <label>Patient *</label>
                <input
                  value={patSearch}
                  onChange={e => {
                    setPatSearch(e.target.value)
                    setForm(f => ({ ...f, patient_id: '', patient_name: '' }))
                    setShowNewPat(false)
                  }}
                  placeholder="Search patient name…"
                  disabled={!!form.patient_id}
                />
                {patSearching && (
                  <div style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginTop: 4 }}>Searching…</div>
                )}

                {/* Search dropdown */}
                {!form.patient_id && patSearch.length >= 2 && !patSearching && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 220,
                    overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
                  }}>
                    {patResults.length > 0
                      ? patResults.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setForm(f => ({ ...f, patient_id: p.id, patient_name: p.name }))
                              setPatSearch(p.name)
                              setPatResults([])
                              setShowNewPat(false)
                            }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer',
                              fontSize: 13, borderBottom: '1px solid var(--clr-border)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            {p.name}
                            {p.mobile && <span style={{ color: 'var(--clr-text-muted)' }}> · {p.mobile}</span>}
                          </div>
                        ))
                      : (
                          <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--clr-text-muted)' }}>
                            No patient found.
                          </div>
                        )
                    }
                    <div
                      onClick={() => {
                        setShowNewPat(true)
                        setNewPat(n => ({ ...n, name: patSearch }))
                        setPatResults([])
                      }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                        color: 'var(--clr-primary)', fontWeight: 600,
                        borderTop: '1px solid var(--clr-border)', background: 'var(--clr-bg)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      + Create new patient "{patSearch}"
                    </div>
                  </div>
                )}

                {/* Selected patient */}
                {form.patient_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--clr-success)' }}>✓ {form.patient_name}</span>
                    <button
                      onClick={() => {
                        setForm(f => ({ ...f, patient_id: '', patient_name: '' }))
                        setPatSearch('')
                      }}
                      style={{ fontSize: 11, color: 'var(--clr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inline new patient form */}
            {!editing && showNewPat && (
              <div style={{
                background: 'var(--clr-bg)', border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '4px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 10 }}>
                  New Patient Details
                </div>
                <div className="emr-form-2col">
                  <div className="emr-form-row">
                    <label>Name *</label>
                    <input
                      value={newPat.name}
                      onChange={e => setNewPat(n => ({ ...n, name: e.target.value }))}
                      placeholder="Full name" autoFocus
                    />
                  </div>
                  <div className="emr-form-row">
                    <label>Mobile</label>
                    <input
                      value={newPat.mobile}
                      inputMode="numeric" maxLength={10} placeholder="10-digit number"
                      onChange={e => setNewPat(n => ({ ...n, mobile: sanitizeMobile(e.target.value) }))}
                    />
                  </div>
                  <div className="emr-form-row">
                    <label>Age</label>
                    <input
                      value={newPat.age}
                      inputMode="numeric" maxLength={3} placeholder="Years"
                      onChange={e => setNewPat(n => ({ ...n, age: sanitizeAge(e.target.value) }))}
                    />
                  </div>
                  <div className="emr-form-row">
                    <label>Gender</label>
                    <select value={newPat.gender} onChange={e => setNewPat(n => ({ ...n, gender: e.target.value }))}>
                      <option value="">— Select —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn-primary" onClick={handleCreatePatient} disabled={creatingPat} style={{ fontSize: 13 }}>
                    {creatingPat ? 'Creating…' : 'Create & Select'}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowNewPat(false)} style={{ fontSize: 13 }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Patient name (edit mode) */}
            {editing && (
              <div className="emr-form-row">
                <label>Patient</label>
                <input value={editing.patient?.name} disabled style={{ opacity: 0.7 }} />
              </div>
            )}

            <div className="emr-form-row">
              <label>Title (optional)</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Follow-up for BP, Routine checkup…"
              />
            </div>

            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Date & Time *</label>
                <input
                  type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                />
              </div>
              <div className="emr-form-row">
                <label>Duration (minutes)</label>
                <input
                  type="number" value={form.duration_minutes} min={5} max={480}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                />
              </div>
              <div className="emr-form-row">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div className="emr-form-row">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="emr-form-row">
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="emr-modal-footer">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
