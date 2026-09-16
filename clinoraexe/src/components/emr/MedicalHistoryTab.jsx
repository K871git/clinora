import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { listMedicalHistory, createMedicalHistory, updateMedicalHistory, deleteMedicalHistory } from '../../services/medicalHistoryService'

const TYPES = ['allergy','chronic','surgery','medication','family','other']
const SEVERITIES = ['mild','moderate','severe']

const EMPTY = { type: 'chronic', title: '', description: '', severity: '', diagnosed_at: '', is_active: true }

export default function MedicalHistoryTab({ patientId }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    setLoading(true)
    listMedicalHistory(patientId)
      .then(setItems)
      .catch(() => toast.error('Could not load medical history'))
      .finally(() => setLoading(false))
  }, [patientId])

  function openAdd()     { setForm(EMPTY);    setEditing(null); setShowAdd(true) }
  function openEdit(item){ setForm({ type: item.type, title: item.title, description: item.description || '',
    severity: item.severity || '', diagnosed_at: item.diagnosed_at || '', is_active: item.is_active })
    setEditing(item); setShowAdd(true) }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, is_active: Boolean(form.is_active) }
      if (!payload.severity)     delete payload.severity
      if (!payload.diagnosed_at) delete payload.diagnosed_at
      if (!payload.description)  delete payload.description

      if (editing) {
        const updated = await updateMedicalHistory(editing.id, payload)
        setItems(prev => prev.map(i => i.id === editing.id ? updated : i))
        toast.success('Updated')
      } else {
        const created = await createMedicalHistory(patientId, payload)
        setItems(prev => [created, ...prev])
        toast.success('Added')
      }
      setShowAdd(false)
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this record?')) return
    try {
      await deleteMedicalHistory(id)
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success('Removed')
    } catch { toast.error('Failed to delete') }
  }

  async function toggleActive(item) {
    try {
      const updated = await updateMedicalHistory(item.id, { is_active: !item.is_active })
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    } catch { toast.error('Failed to update') }
  }

  return (
    <div className="emr-panel">
      <div className="emr-panel-header">
        <h3 className="emr-panel-title">Medical History</h3>
        <button className="emr-add-btn" onClick={openAdd}>+ Add</button>
      </div>

      {loading && <div className="emr-empty">Loading…</div>}
      {!loading && items.length === 0 && <div className="emr-empty">No medical history recorded.</div>}
      {!loading && items.length > 0 && (
        <div className="medh-list">
          {items.map(item => (
            <div key={item.id} className={`medh-item${!item.is_active ? ' medh-item--inactive' : ''}`}>
              <span className={`medh-type-badge medh-type-${item.type}`}>{item.type}</span>
              <div style={{ flex: 1 }}>
                <div className="medh-title">{item.title}
                  {item.severity && <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--clr-text-muted)' }}>({item.severity})</span>}
                </div>
                {item.description && <div className="medh-desc">{item.description}</div>}
                {item.diagnosed_at && <div className="medh-desc">Since: {item.diagnosed_at}</div>}
              </div>
              <div className="medh-actions">
                <button className="emr-icon-btn" onClick={() => toggleActive(item)} title={item.is_active ? 'Mark inactive' : 'Mark active'}>
                  {item.is_active ? '✓' : '○'}
                </button>
                <button className="emr-icon-btn" onClick={() => openEdit(item)}>Edit</button>
                <button className="emr-icon-btn emr-icon-btn--danger" onClick={() => handleDelete(item.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="emr-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="emr-modal" onClick={e => e.stopPropagation()}>
            <h4 className="emr-modal-title">{editing ? 'Edit' : 'Add'} Medical History</h4>
            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                  {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div className="emr-form-row">
                <label>Severity (optional)</label>
                <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}>
                  <option value="">— None —</option>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="emr-form-row">
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Penicillin Allergy, Type 2 Diabetes…" />
            </div>
            <div className="emr-form-row">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Diagnosed on</label>
                <input type="date" value={form.diagnosed_at} onChange={e => setForm(f => ({...f, diagnosed_at: e.target.value}))} />
              </div>
              <div className="emr-form-row" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                <input type="checkbox" id="mh-active" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} style={{ width: 'auto' }} />
                <label htmlFor="mh-active" style={{ fontSize: 13, color: 'var(--clr-text)' }}>Currently active</label>
              </div>
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
