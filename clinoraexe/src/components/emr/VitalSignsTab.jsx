import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { listVitals, createVital, deleteVital } from '../../services/vitalSignService'

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY = {
  bp_systolic: '', bp_diastolic: '', pulse: '', temperature: '',
  weight: '', height: '', spo2: '', respiratory_rate: '', blood_group: '', notes: '',
}

export default function VitalSignsTab({ patientId, visitId }) {
  const [vitals,  setVitals]  = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    setLoading(true)
    listVitals(patientId)
      .then(setVitals)
      .catch(() => toast.error('Could not load vitals'))
      .finally(() => setLoading(false))
  }, [patientId])

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {}
      if (visitId)               payload.visit_id         = Number(visitId)
      if (form.bp_systolic)      payload.bp_systolic      = Number(form.bp_systolic)
      if (form.bp_diastolic)     payload.bp_diastolic     = Number(form.bp_diastolic)
      if (form.pulse)            payload.pulse            = Number(form.pulse)
      if (form.temperature)      payload.temperature      = Number(form.temperature)
      if (form.weight)           payload.weight           = Number(form.weight)
      if (form.height)           payload.height           = Number(form.height)
      if (form.spo2)             payload.spo2             = Number(form.spo2)
      if (form.respiratory_rate) payload.respiratory_rate = Number(form.respiratory_rate)
      if (form.blood_group)      payload.blood_group      = form.blood_group
      if (form.notes)            payload.notes            = form.notes

      const created = await createVital(patientId, payload)
      setVitals(v => [created, ...v])
      setForm(EMPTY)
      setShowAdd(false)
      toast.success('Vitals recorded')
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this vital record?')) return
    try {
      await deleteVital(id)
      setVitals(v => v.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const latest = vitals[0]

  return (
    <div className="emr-panel">
      <div className="emr-panel-header">
        <h3 className="emr-panel-title">Vital Signs</h3>
        <button className="emr-add-btn" onClick={() => setShowAdd(true)}>+ Record Vitals</button>
      </div>

      {/* Latest vitals summary */}
      {latest && (
        <div className="vitals-grid" style={{ marginBottom: 'var(--space-lg)' }}>
          {latest.bp_systolic  && <VitalCard label="Blood Pressure" value={`${latest.bp_systolic}/${latest.bp_diastolic}`} unit="mmHg" />}
          {latest.pulse        && <VitalCard label="Pulse"          value={latest.pulse}        unit="bpm" />}
          {latest.temperature  && <VitalCard label="Temperature"    value={latest.temperature}  unit="°C" />}
          {latest.spo2         && <VitalCard label="SpO₂"           value={`${latest.spo2}%`}   unit="" />}
          {latest.weight       && <VitalCard label="Weight"         value={latest.weight}       unit="kg" />}
          {latest.height       && <VitalCard label="Height"         value={latest.height}       unit="cm" />}
          {latest.respiratory_rate && <VitalCard label="Resp. Rate" value={latest.respiratory_rate} unit="/min" />}
          {latest.blood_group  && <VitalCard label="Blood Group"    value={latest.blood_group}  unit="" />}
        </div>
      )}

      {/* History list */}
      {loading && <div className="emr-empty">Loading…</div>}
      {!loading && vitals.length === 0 && <div className="emr-empty">No vitals recorded yet.</div>}
      {!loading && vitals.length > 0 && (
        <div>
          {vitals.map(v => (
            <div key={v.id} className="vitals-history-item">
              <span className="vital-hist-date">{fmtDate(v.recorded_at)}</span>
              <div className="vital-hist-values">
                {v.bp_systolic      && <span className="vital-chip">BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                {v.pulse            && <span className="vital-chip">P {v.pulse}bpm</span>}
                {v.temperature      && <span className="vital-chip">T {v.temperature}°C</span>}
                {v.spo2             && <span className="vital-chip">SpO₂ {v.spo2}%</span>}
                {v.weight           && <span className="vital-chip">{v.weight}kg</span>}
                {v.height           && <span className="vital-chip">{v.height}cm</span>}
                {v.respiratory_rate && <span className="vital-chip">RR {v.respiratory_rate}/min</span>}
              </div>
              <button className="emr-icon-btn emr-icon-btn--danger" onClick={() => handleDelete(v.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="emr-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="emr-modal" onClick={e => e.stopPropagation()}>
            <h4 className="emr-modal-title">Record Vital Signs</h4>
            <div className="emr-form-2col">
              <Field label="Systolic BP (mmHg)"  type="number" value={form.bp_systolic}      onChange={v => setForm(f => ({...f, bp_systolic: v}))} />
              <Field label="Diastolic BP (mmHg)" type="number" value={form.bp_diastolic}     onChange={v => setForm(f => ({...f, bp_diastolic: v}))} />
              <Field label="Pulse (bpm)"          type="number" value={form.pulse}            onChange={v => setForm(f => ({...f, pulse: v}))} />
              <Field label="Temperature (°C)"     type="number" value={form.temperature}      onChange={v => setForm(f => ({...f, temperature: v}))} />
              <Field label="Weight (kg)"          type="number" value={form.weight}           onChange={v => setForm(f => ({...f, weight: v}))} />
              <Field label="Height (cm)"          type="number" value={form.height}           onChange={v => setForm(f => ({...f, height: v}))} />
              <Field label="SpO₂ (%)"             type="number" value={form.spo2}             onChange={v => setForm(f => ({...f, spo2: v}))} />
              <Field label="Resp. Rate (/min)"    type="number" value={form.respiratory_rate} onChange={v => setForm(f => ({...f, respiratory_rate: v}))} />
            </div>
            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Blood Group</label>
                <select value={form.blood_group} onChange={e => setForm(f => ({...f, blood_group: e.target.value}))}>
                  <option value="">— Select —</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div />
            </div>
            <div className="emr-form-row">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </div>
            <div className="emr-modal-footer">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Vitals'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VitalCard({ label, value, unit }) {
  return (
    <div className="vital-card">
      <div className="vital-card-label">{label}</div>
      <div className="vital-card-value">{value} <span className="vital-card-unit">{unit}</span></div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <div className="emr-form-row">
      <label>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
