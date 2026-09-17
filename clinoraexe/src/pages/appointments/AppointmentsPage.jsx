import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { listAppointments, createAppointment, updateAppointment, deleteAppointment } from '../../services/appointmentService'
import { searchPatients, createPatient } from '../../services/patientService'
import { sanitizeMobile, validateMobile, sanitizeAge, validateAge } from '../../lib/inputValidators'
import EmptyState from '../../components/ui/EmptyState'
import '../../styles/emr.css'

const TYPES    = ['consultation','follow_up','checkup','procedure','other']
const STATUSES = ['scheduled','confirmed','completed','cancelled','no_show']
const EMPTY_FORM = { patient_id: '', patient_name: '', title: '', scheduled_at: '', duration_minutes: 15, type: 'consultation', status: 'scheduled', notes: '' }

function parseUtc(iso) {
  if (!iso) return null
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
}
function fmtTime(iso) {
  const d = parseUtc(iso)
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(iso) {
  const d = parseUtc(iso)
  if (!d) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function fmtDateFull(iso) {
  const d = parseUtc(iso)
  if (!d) return ''
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().split('T')[0] }

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

  const load = useCallback(() => {
    setLoading(true)
    const filters = { date: selectedDate }
    if (statusFilter) filters.status = statusFilter
    listAppointments(filters)
      .then(setAppointments)
      .catch(() => toast.error('Could not load appointments'))
      .finally(() => setLoading(false))
  }, [selectedDate, statusFilter])

  useEffect(() => { load() }, [load])

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

  function openAdd() {
    setForm({ ...EMPTY_FORM, scheduled_at: `${selectedDate}T09:00` })
    setPatSearch(''); setPatResults([]); setEditing(null)
    setShowNewPat(false); setNewPat({ name: '', mobile: '', age: '', gender: '' })
    setShowAdd(true)
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
  function openEdit(appt) {
    const dt = appt.scheduled_at ? appt.scheduled_at.slice(0,16) : ''
    setForm({ patient_id: appt.patient_id, patient_name: appt.patient?.name || '', title: appt.title || '',
      scheduled_at: dt, duration_minutes: appt.duration_minutes, type: appt.type, status: appt.status, notes: appt.notes || '' })
    setPatSearch(appt.patient?.name || ''); setEditing(appt); setShowAdd(true)
  }

  function pickDate(offset) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  async function handleSave() {
    if (!form.patient_id) { toast.error('Select a patient'); return }
    if (!form.scheduled_at) { toast.error('Set date and time'); return }
    setSaving(true)
    try {
      const payload = {
        patient_id: Number(form.patient_id),
        scheduled_at: form.scheduled_at.replace('T', ' ') + ':00',
        duration_minutes: Number(form.duration_minutes),
        type: form.type,
        status: form.status,
        title: form.title || null,
        notes: form.notes || null,
      }
      if (editing) {
        const updated = await updateAppointment(editing.id, payload)
        setAppointments(prev => prev.map(a => a.id === editing.id ? updated : a))
        toast.success('Updated')
      } else {
        const created = await createAppointment(payload)
        setAppointments(prev => [...prev, created].sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at)))
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
      toast.success('Removed')
    } catch { toast.error('Failed to remove') }
  }

  async function quickStatus(appt, status) {
    try {
      const updated = await updateAppointment(appt.id, { status })
      setAppointments(prev => prev.map(a => a.id === appt.id ? updated : a))
    } catch { toast.error('Failed to update') }
  }

  return (
    <div className="appt-page">
      <div className="appt-toolbar">
        <h2 className="appt-toolbar-title">Appointments</h2>
        <button className="emr-add-btn" onClick={openAdd}>+ Book Appointment</button>
      </div>

      {/* Date nav */}
      <div className="appt-date-nav">
        <button onClick={() => pickDate(-1)}>‹ Prev</button>
        <span className="appt-date-label">{fmtDateFull(selectedDate)}</span>
        <button onClick={() => pickDate(1)}>Next ›</button>
        <button onClick={() => setSelectedDate(todayStr())} style={{ marginLeft: 4, fontSize: 12 }}>Today</button>
      </div>

      {/* Status filter */}
      <div className="appt-filters">
        {['', ...STATUSES].map(s => (
          <button key={s} className={`appt-filter-btn${statusFilter === s ? ' appt-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter(s)}>
            {s ? s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
          </button>
        ))}
      </div>

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
                <div className="appt-type">{appt.title || appt.type.replace('_',' ')}</div>
              </div>
              <span className={`appt-status-badge appt-status-${appt.status}`}>
                {appt.status.replace('_',' ')}
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

      {/* Book / Edit modal */}
      {showAdd && (
        <div className="emr-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="emr-modal" onClick={e => e.stopPropagation()}>
            <h4 className="emr-modal-title">{editing ? 'Edit Appointment' : 'Book Appointment'}</h4>

            {/* Patient search */}
            {!editing && (
              <div className="emr-form-row" style={{ position: 'relative' }}>
                <label>Patient *</label>
                <input
                  value={patSearch}
                  onChange={e => { setPatSearch(e.target.value); setForm(f => ({...f, patient_id: '', patient_name: ''})); setShowNewPat(false) }}
                  placeholder="Search patient name…"
                  disabled={!!form.patient_id}
                />
                {patSearching && <div style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginTop: 4 }}>Searching…</div>}

                {/* Dropdown: search results OR "not found" prompt */}
                {!form.patient_id && patSearch.length >= 2 && !patSearching && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--clr-surface)',
                    border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
                    {patResults.length > 0
                      ? patResults.map(p => (
                          <div key={p.id}
                            onClick={() => { setForm(f => ({...f, patient_id: p.id, patient_name: p.name})); setPatSearch(p.name); setPatResults([]); setShowNewPat(false) }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--clr-border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            {p.name} {p.mobile && <span style={{ color: 'var(--clr-text-muted)' }}>· {p.mobile}</span>}
                          </div>
                        ))
                      : <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--clr-text-muted)' }}>No patient found.</div>
                    }
                    {/* Always show "Create new" option at bottom */}
                    <div
                      onClick={() => { setShowNewPat(true); setNewPat(n => ({ ...n, name: patSearch })); setPatResults([]) }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--clr-primary)',
                        fontWeight: 600, borderTop: '1px solid var(--clr-border)', background: 'var(--clr-bg)' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      + Create new patient "{patSearch}"
                    </div>
                  </div>
                )}

                {/* Selected patient confirmation */}
                {form.patient_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--clr-success)' }}>✓ {form.patient_name}</span>
                    <button onClick={() => { setForm(f => ({...f, patient_id: '', patient_name: ''})); setPatSearch('') }}
                      style={{ fontSize: 11, color: 'var(--clr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inline new patient form */}
            {!editing && showNewPat && (
              <div style={{ background: 'var(--clr-bg)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)',
                padding: '12px', marginBottom: '4px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 10 }}>
                  New Patient Details
                </div>
                <div className="emr-form-2col">
                  <div className="emr-form-row">
                    <label>Name *</label>
                    <input value={newPat.name} onChange={e => setNewPat(n => ({...n, name: e.target.value}))} placeholder="Full name" autoFocus />
                  </div>
                  <div className="emr-form-row">
                    <label>Mobile</label>
                    <input
                      value={newPat.mobile}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit number"
                      onChange={e => setNewPat(n => ({...n, mobile: sanitizeMobile(e.target.value)}))}
                    />
                  </div>
                  <div className="emr-form-row">
                    <label>Age</label>
                    <input
                      value={newPat.age}
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="Years"
                      onChange={e => setNewPat(n => ({...n, age: sanitizeAge(e.target.value)}))}
                    />
                  </div>
                  <div className="emr-form-row">
                    <label>Gender</label>
                    <select value={newPat.gender} onChange={e => setNewPat(n => ({...n, gender: e.target.value}))}>
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
            {editing && (
              <div className="emr-form-row">
                <label>Patient</label>
                <input value={editing.patient?.name} disabled style={{ opacity: 0.7 }} />
              </div>
            )}

            <div className="emr-form-row">
              <label>Title (optional)</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Follow-up for BP, Routine checkup…" />
            </div>
            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Date & Time *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at: e.target.value}))} />
              </div>
              <div className="emr-form-row">
                <label>Duration (minutes)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({...f, duration_minutes: e.target.value}))} min={5} max={480} />
              </div>
              <div className="emr-form-row">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="emr-form-row">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </div>
            </div>
            <div className="emr-form-row">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </div>
            <div className="emr-modal-footer">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
