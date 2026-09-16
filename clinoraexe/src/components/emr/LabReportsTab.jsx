import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { listLabReports, createLabReport, updateLabReport, deleteLabReport } from '../../services/labReportService'

const STATUSES = ['ordered','received','reviewed']
const EMPTY = { report_name: '', lab_name: '', notes: '', status: 'ordered', ordered_at: '', received_at: '' }

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LabReportsTab({ patientId, visitId }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    setLoading(true)
    listLabReports(patientId)
      .then(setItems)
      .catch(() => toast.error('Could not load lab reports'))
      .finally(() => setLoading(false))
  }, [patientId])

  function openAdd()     { setForm(visitId ? {...EMPTY, ordered_at: new Date().toISOString().split('T')[0]} : EMPTY); setEditing(null); setShowAdd(true) }
  function openEdit(item){ setForm({ report_name: item.report_name, lab_name: item.lab_name || '', notes: item.notes || '',
    status: item.status, ordered_at: item.ordered_at || '', received_at: item.received_at || '' }); setEditing(item); setShowAdd(true) }

  async function handleSave() {
    if (!form.report_name.trim()) { toast.error('Report name is required'); return }
    setSaving(true)
    try {
      const payload = { ...form }
      if (visitId && !editing) payload.visit_id = Number(visitId)
      if (!payload.lab_name)    delete payload.lab_name
      if (!payload.notes)       delete payload.notes
      if (!payload.ordered_at)  delete payload.ordered_at
      if (!payload.received_at) delete payload.received_at

      if (editing) {
        const updated = await updateLabReport(editing.id, payload)
        setItems(prev => prev.map(i => i.id === editing.id ? updated : i))
        toast.success('Updated')
      } else {
        const created = await createLabReport(patientId, payload)
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
    if (!window.confirm('Delete this report?')) return
    try {
      await deleteLabReport(id)
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  async function cycleStatus(item) {
    const next = { ordered: 'received', received: 'reviewed', reviewed: 'ordered' }[item.status]
    try {
      const updated = await updateLabReport(item.id, { status: next })
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    } catch { toast.error('Failed to update') }
  }

  return (
    <div className="emr-panel">
      <div className="emr-panel-header">
        <h3 className="emr-panel-title">Lab Reports</h3>
        <button className="emr-add-btn" onClick={openAdd}>+ Add Report</button>
      </div>

      {loading && <div className="emr-empty">Loading…</div>}
      {!loading && items.length === 0 && <div className="emr-empty">No lab reports yet.</div>}
      {!loading && items.length > 0 && (
        <div className="lab-list">
          {items.map(item => (
            <div key={item.id} className="lab-item">
              <div style={{ flex: 1 }}>
                <div className="lab-name">{item.report_name}</div>
                <div className="lab-meta">
                  {item.lab_name && <span>{item.lab_name} · </span>}
                  {item.ordered_at  && <span>Ordered: {fmtDate(item.ordered_at)} </span>}
                  {item.received_at && <span>· Received: {fmtDate(item.received_at)}</span>}
                  {item.notes && <span> · {item.notes}</span>}
                </div>
              </div>
              <button className={`lab-status-badge lab-status-${item.status}`} onClick={() => cycleStatus(item)} title="Click to advance status" style={{ cursor: 'pointer', border: 'none' }}>
                {item.status}
              </button>
              <div className="medh-actions">
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
            <h4 className="emr-modal-title">{editing ? 'Edit' : 'Add'} Lab Report</h4>
            <div className="emr-form-row">
              <label>Report Name *</label>
              <input value={form.report_name} onChange={e => setForm(f => ({...f, report_name: e.target.value}))} placeholder="e.g. CBC, Lipid Profile, HbA1c…" />
            </div>
            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Lab / Hospital</label>
                <input value={form.lab_name} onChange={e => setForm(f => ({...f, lab_name: e.target.value}))} />
              </div>
              <div className="emr-form-row">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div className="emr-form-row">
                <label>Ordered On</label>
                <input type="date" value={form.ordered_at} onChange={e => setForm(f => ({...f, ordered_at: e.target.value}))} />
              </div>
              <div className="emr-form-row">
                <label>Received On</label>
                <input type="date" value={form.received_at} onChange={e => setForm(f => ({...f, received_at: e.target.value}))} />
              </div>
            </div>
            <div className="emr-form-row">
              <label>Notes / Findings</label>
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
