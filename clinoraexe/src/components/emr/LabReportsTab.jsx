import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { listLabReports, createLabReport, updateLabReport, deleteLabReport } from '../../services/labReportService'
import EmptyState from '../ui/EmptyState'

const STATUSES = ['ordered', 'received', 'reviewed']
const EMPTY_FORM = {
  report_name: '', lab_name: '', notes: '', status: 'ordered', ordered_at: '', received_at: '',
}
const EMPTY_ROW = { name: '', value: '', unit: '', normal_min: '', normal_max: '' }

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseResults(json) {
  if (!json) return []
  try { return JSON.parse(json) } catch { return [] }
}

function isOutOfRange(row) {
  const val = parseFloat(row.value)
  if (isNaN(val)) return false
  const lo = parseFloat(row.normal_min)
  const hi = parseFloat(row.normal_max)
  if (!isNaN(lo) && val < lo) return true
  if (!isNaN(hi) && val > hi) return true
  return false
}

function hasAnyOutOfRange(results) {
  return results.some(isOutOfRange)
}

export default function LabReportsTab({ patientId, visitId }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [rows,    setRows]    = useState([{ ...EMPTY_ROW }])
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    setLoading(true)
    listLabReports(patientId)
      .then(setItems)
      .catch(() => toast.error('Could not load lab reports'))
      .finally(() => setLoading(false))
  }, [patientId])

  function openAdd() {
    setForm(visitId
      ? { ...EMPTY_FORM, ordered_at: new Date().toISOString().split('T')[0] }
      : { ...EMPTY_FORM }
    )
    setRows([{ ...EMPTY_ROW }])
    setEditing(null)
    setShowAdd(true)
  }

  function openEdit(item) {
    setForm({
      report_name: item.report_name,
      lab_name:    item.lab_name    || '',
      notes:       item.notes       || '',
      status:      item.status,
      ordered_at:  item.ordered_at  || '',
      received_at: item.received_at || '',
    })
    const parsed = parseResults(item.results_json)
    setRows(parsed.length > 0 ? parsed : [{ ...EMPTY_ROW }])
    setEditing(item)
    setShowAdd(true)
  }

  function updateRow(idx, field, value) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(idx) {
    setRows(prev => prev.length === 1 ? [{ ...EMPTY_ROW }] : prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!form.report_name.trim()) { toast.error('Report name is required'); return }
    setSaving(true)
    try {
      const filledRows = rows.filter(r => r.name.trim())
      const results_json = filledRows.length > 0 ? JSON.stringify(filledRows) : null

      const payload = {
        ...form,
        results_json,
      }
      if (!payload.lab_name)    delete payload.lab_name
      if (!payload.notes)       delete payload.notes
      if (!payload.ordered_at)  delete payload.ordered_at
      if (!payload.received_at) delete payload.received_at

      if (editing) {
        const updated = await updateLabReport(editing.id, payload)
        setItems(prev => prev.map(i => i.id === editing.id ? updated : i))
        toast.success('Updated')
      } else {
        const p = { ...payload }
        if (visitId) p.visit_id = Number(visitId)
        const created = await createLabReport(patientId, p)
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
      {!loading && items.length === 0 && (
        <EmptyState compact icon="🧪" title="No lab reports yet" description="Add the first report using the button above." />
      )}

      {!loading && items.length > 0 && (
        <div className="lab-list">
          {items.map(item => {
            const results = parseResults(item.results_json)
            const anyOOR  = hasAnyOutOfRange(results)
            return (
              <div key={item.id} className="lab-item" style={{ flexDirection: 'column', gap: 6 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div style={{ flex: 1 }}>
                    <div className="lab-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.report_name}
                      {anyOOR && (
                        <span title="One or more values outside normal range"
                          style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                          ⚠ Out of Range
                        </span>
                      )}
                    </div>
                    <div className="lab-meta">
                      {item.lab_name   && <span>{item.lab_name} · </span>}
                      {item.ordered_at  && <span>Ordered: {fmtDate(item.ordered_at)} </span>}
                      {item.received_at && <span>· Received: {fmtDate(item.received_at)}</span>}
                      {item.notes       && <span> · {item.notes}</span>}
                    </div>
                  </div>
                  <button className={`lab-status-badge lab-status-${item.status}`}
                    onClick={() => cycleStatus(item)} title="Click to advance status" style={{ cursor: 'pointer', border: 'none' }}>
                    {item.status}
                  </button>
                  <div className="medh-actions">
                    <button className="emr-icon-btn" onClick={() => openEdit(item)}>Edit</button>
                    <button className="emr-icon-btn emr-icon-btn--danger" onClick={() => handleDelete(item.id)}>✕</button>
                  </div>
                </div>

                {/* Results table */}
                {results.length > 0 && (
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 2 }}>
                    <thead>
                      <tr style={{ background: 'var(--clr-surface)' }}>
                        <th style={TH}>Test</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Value</th>
                        <th style={TH}>Unit</th>
                        <th style={TH}>Normal Range</th>
                        <th style={TH}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => {
                        const oor = isOutOfRange(r)
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--clr-border)' }}>
                            <td style={TD}>{r.name}</td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: 600,
                              color: oor ? '#dc2626' : 'var(--clr-text)' }}>
                              {r.value}
                            </td>
                            <td style={{ ...TD, color: 'var(--clr-text-muted)' }}>{r.unit}</td>
                            <td style={{ ...TD, color: 'var(--clr-text-muted)' }}>
                              {r.normal_min || r.normal_max
                                ? `${r.normal_min || ''}${r.normal_min && r.normal_max ? ' – ' : ''}${r.normal_max || ''}`
                                : '—'}
                            </td>
                            <td style={TD}>
                              {oor
                                ? <span style={{ color: '#dc2626', fontWeight: 600 }}>↑↓ Abnormal</span>
                                : r.value ? <span style={{ color: '#16a34a' }}>Normal</span> : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showAdd && (
        <div className="emr-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="emr-modal" style={{ maxWidth: 680, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <h4 className="emr-modal-title">{editing ? 'Edit' : 'Add'} Lab Report</h4>

            <div className="emr-form-row">
              <label>Report Name *</label>
              <input value={form.report_name}
                onChange={e => setForm(f => ({ ...f, report_name: e.target.value }))}
                placeholder="e.g. CBC, Lipid Profile, HbA1c…" />
            </div>

            <div className="emr-form-2col">
              <div className="emr-form-row">
                <label>Lab / Hospital</label>
                <input value={form.lab_name}
                  onChange={e => setForm(f => ({ ...f, lab_name: e.target.value }))} />
              </div>
              <div className="emr-form-row">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="emr-form-row">
                <label>Ordered On</label>
                <input type="date" value={form.ordered_at}
                  onChange={e => setForm(f => ({ ...f, ordered_at: e.target.value }))} />
              </div>
              <div className="emr-form-row">
                <label>Received On</label>
                <input type="date" value={form.received_at}
                  onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))} />
              </div>
            </div>

            {/* Test results rows */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-muted)', textTransform: 'uppercase',
                letterSpacing: '.4px', marginBottom: 6 }}>
                Test Results
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--clr-surface)' }}>
                    <th style={TH}>Test Name</th>
                    <th style={TH}>Value</th>
                    <th style={TH}>Unit</th>
                    <th style={TH}>Normal Min</th>
                    <th style={TH}>Normal Max</th>
                    <th style={{ ...TH, width: 28 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {['name', 'value', 'unit', 'normal_min', 'normal_max'].map(field => (
                        <td key={field} style={{ padding: '3px 2px' }}>
                          <input
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px',
                              border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)',
                              background: 'var(--clr-bg)', color: 'var(--clr-text)' }}
                            placeholder={field === 'name' ? 'e.g. Hemoglobin' : field === 'value' ? '12.5' : field === 'unit' ? 'g/dL' : ''}
                            value={r[field]}
                            onChange={e => updateRow(i, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '3px 2px', textAlign: 'center' }}>
                        <button onClick={() => removeRow(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)', fontSize: 14, padding: 2 }}
                          title="Remove row">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addRow}
                style={{ marginTop: 6, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--clr-primary)', padding: 0 }}>
                + Add Test Parameter
              </button>
            </div>

            <div className="emr-form-row">
              <label>Notes / Findings</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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

const TH = {
  padding: '4px 6px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '.3px',
  borderBottom: '1px solid var(--clr-border)',
}
const TD = { padding: '5px 6px' }
