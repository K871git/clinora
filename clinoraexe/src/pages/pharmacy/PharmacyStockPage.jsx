import '../../styles/pharmacy-stock.css'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getMedicines, patchMedicine, createMedicine, deleteMedicine, importMedicines, updateMedicine,
} from '../../services/medicineService'
import { getStockItems, createStockItem, updateStockItem, deleteStockItem } from '../../services/stockItemService'
import { getStockAuditLog } from '../../services/stockAuditService'
import Spinner from '../../components/ui/Spinner'
import MedicineImportModal from '../../components/medicines/MedicineImportModal'
import EmptyState from '../../components/ui/EmptyState'

const UNIT_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Gel', 'Powder', 'Sachet', 'Inhaler', 'Patch']
const FALLBACK_CATS = ['Analgesic', 'Antibiotic', 'Antacid', 'Antifungal', 'Antihistamine', 'Antiseptic', 'Vitamin', 'Syrup', 'Tablet', 'Injection']

function fmtPrice(p) {
  if (p == null) return '—'
  return '₹' + parseFloat(p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── Category picker (dynamic from medicines list) ──────────────────── */
function CategoryPicker({ value, onChange, categories }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const opts = categories.length > 0 ? categories : FALLBACK_CATS
  const filtered = value.trim()
    ? opts.filter(c => c.toLowerCase().includes(value.toLowerCase()))
    : opts

  useEffect(() => {
    if (!open) return
    function handle(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="phs-cat-wrap" ref={ref}>
      <input
        className="field"
        placeholder="Type or pick category…"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="phs-cat-drop">
          {filtered.map(c => (
            <button key={c} type="button"
              className={`phs-cat-option${c === value ? ' phs-cat-option--on' : ''}`}
              onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false) }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Stock level dot ──────────────────────────────────────────────────── */
function StockDot({ qty, reorderLevel = 10 }) {
  const level = qty === 0 ? 'out' : qty <= reorderLevel ? 'low' : 'ok'
  return <span className={`phs-stock-dot phs-stock-dot--${level}`} title={
    level === 'out' ? 'Out of stock' : level === 'low' ? `Low stock (${qty})` : `In stock (${qty})`
  } />
}

/* ── Expiry badge ─────────────────────────────────────────────────────── */
function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return <span style={{ color: 'var(--clr-text-muted)', fontSize: 11 }}>—</span>
  const today = new Date(); today.setHours(0,0,0,0)
  const exp   = new Date(expiryDate)
  const days  = Math.round((exp - today) / 86400000)
  const label = days < 0  ? 'Expired'
              : days === 0 ? 'Today'
              : days <= 30 ? `${days}d`
              : exp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  const color = days < 0  ? '#dc2626'
              : days <= 30 ? '#d97706'
              : '#16a34a'
  const bg    = days < 0  ? 'rgba(220,38,38,.10)'
              : days <= 30 ? 'rgba(217,119,6,.10)'
              : 'rgba(22,163,74,.10)'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      background: bg, color, whiteSpace: 'nowrap',
    }} title={expiryDate}>{label}</span>
  )
}

/* ── Edit medicine modal ──────────────────────────────────────────────── */
function EditMedicineModal({ medicine, categories, medicines, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:          medicine.name,
    generic_name:  medicine.generic_name  ?? '',
    category:      medicine.category      ?? '',
    unit:          medicine.unit           ?? '',
    quantity:      medicine.quantity != null ? String(medicine.quantity) : '0',
    price:         medicine.price != null ? String(medicine.price) : '',
    batch_number:  medicine.batch_number  ?? '',
    expiry_date:   medicine.expiry_date   ?? '',
    received_date: medicine.received_date ?? '',
    reorder_level: medicine.reorder_level != null ? String(medicine.reorder_level) : '10',
  })
  const [saving, setSaving] = useState(false)
  const [dupWarn, setDupWarn] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function checkDup(name) {
    const lower = name.trim().toLowerCase()
    setDupWarn(
      lower.length > 0 &&
      lower !== medicine.name.toLowerCase() &&
      medicines.some(m => m.id !== medicine.id && m.name.toLowerCase() === lower)
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const { data } = await updateMedicine(medicine.id, {
        name:          form.name.trim(),
        generic_name:  form.generic_name.trim()  || null,
        category:      form.category.trim()       || null,
        unit:          form.unit.trim()            || null,
        quantity:      form.quantity !== '' ? parseInt(form.quantity, 10) : 0,
        price:         form.price    !== '' ? parseFloat(form.price)     : null,
        batch_number:  form.batch_number.trim()   || null,
        expiry_date:   form.expiry_date           || null,
        received_date: form.received_date         || null,
        reorder_level: form.reorder_level !== '' ? parseInt(form.reorder_level, 10) : 10,
      })
      toast.success(`${data.name} updated`)
      onSaved(data)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not update medicine.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="phs-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="phs-modal">
        <div className="phs-modal-head">
          <span className="phs-modal-title">Edit Medicine</span>
          <button className="phs-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="phs-modal-body">
            <div className="field-group">
              <label className="field-label">Name *</label>
              <input className={`field${dupWarn ? ' field--warn' : ''}`}
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); checkDup(e.target.value) }}
                autoFocus required />
              {dupWarn && <p className="phs-dup-warn">⚠ A medicine with this name already exists.</p>}
            </div>
            <div className="field-group">
              <label className="field-label">Generic Name</label>
              <input className="field" placeholder="e.g. Acetaminophen"
                value={form.generic_name}
                onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))} />
            </div>
            <div className="phs-modal-row">
              <div className="field-group">
                <label className="field-label">Category</label>
                <CategoryPicker value={form.category}
                  onChange={v => setForm(f => ({ ...f, category: v }))}
                  categories={categories} />
              </div>
              <div className="field-group">
                <label className="field-label">Unit / Form</label>
                <input className="field" placeholder="Tablet" list="phs-unit-list"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="phs-modal-row">
              <div className="field-group">
                <label className="field-label">Stock Quantity</label>
                <input className="field" type="number" min="0" step="1" placeholder="0"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="field-label">Selling Price (₹)</label>
                <input className="field" type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
            </div>
            <div className="phs-modal-row">
              <div className="field-group">
                <label className="field-label">Batch Number</label>
                <input className="field" placeholder="e.g. BT-2024-001"
                  value={form.batch_number}
                  onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="field-label">Reorder Level</label>
                <input className="field" type="number" min="0" step="1" placeholder="10"
                  value={form.reorder_level}
                  onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} />
              </div>
            </div>
            <div className="phs-modal-row">
              <div className="field-group">
                <label className="field-label">Expiry Date</label>
                <input className="field" type="date"
                  value={form.expiry_date}
                  onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="field-label">Received Date</label>
                <input className="field" type="date"
                  value={form.received_date}
                  onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="phs-modal-foot">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Import modal ─────────────────────────────────────────────────────── */
function ImportModal({ onClose, onDone }) {
  const [file, setFile]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]  = useState(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleImport(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (!lines.length) throw new Error('File is empty')
      const isTsv = lines[0].includes('\t')
      const split = l => isTsv ? l.split('\t').map(c => c.trim()) : l.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
      const firstCols = split(lines[0])
      const hasHeader = /^name$/i.test(firstCols[0])
      const dataLines = hasHeader ? lines.slice(1) : lines
      const items = dataLines.map(line => {
        const c = split(line)
        return {
          name: c[0] ?? '', generic_name: c[1] || null, category: c[2] || null,
          unit: c[3] || null, quantity: c[4] ? (parseInt(c[4], 10) || 0) : 0,
          price: c[5] ? (parseFloat(c[5]) || null) : null,
        }
      }).filter(item => item.name.trim())
      if (!items.length) throw new Error('No valid medicine rows found in file')
      const { data } = await importMedicines(items)
      setResult(data)
      toast.success(`Imported ${data.imported} medicine${data.imported !== 1 ? 's' : ''}`, {
        description: data.skipped ? `${data.skipped} duplicate(s) skipped` : undefined,
        duration: 5000,
      })
      onDone()
    } catch (err) {
      toast.error(err.message ?? err.response?.data?.message ?? 'Import failed — check file format.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="phs-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="phs-modal">
        <div className="phs-modal-head">
          <span className="phs-modal-title">Import Medicines from CSV</span>
          <button className="phs-modal-close" onClick={onClose} type="button">✕</button>
        </div>
        <form onSubmit={handleImport}>
          <div className="phs-modal-body">
            <p className="phs-import-hint">
              Upload a <strong>CSV or TXT</strong> file. Columns: Name, Generic Name, Category, Unit, Price.
              First column must be the medicine name. Duplicates are skipped automatically.
            </p>
            <input type="file" accept=".csv,.txt" className="field"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
            {file && <p style={{ fontSize: '12px', color: 'var(--clr-text-muted)', marginTop: '6px' }}>
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>}
            {result && (
              <div className="phs-import-result">
                ✓ {result.imported} imported · {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped
              </div>
            )}
          </div>
          <div className="phs-modal-foot">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={!file || loading}>
              {loading ? 'Importing…' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Audit Log Modal ─────────────────────────────────────────────────── */
const REASON_LABEL = { manual_edit: 'Manual Edit', dispensed: 'Dispensed', import: 'Import' }
const REASON_COLOR = { manual_edit: '#6366f1', dispensed: '#0ea5e9', import: '#10b981' }

function AuditLogModal({ item, onClose }) {
  const [logs,   setLogs]   = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setStatus('loading')
    getStockAuditLog(item.type, item.id)
      .then(({ data }) => { setLogs(data.data ?? []); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [item.type, item.id])

  function fmtTs(iso) {
    if (!iso) return '—'
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function deltaLabel(delta) {
    if (delta > 0) return <span style={{ color: '#16a34a', fontWeight: 600 }}>+{delta}</span>
    if (delta < 0) return <span style={{ color: '#dc2626', fontWeight: 600 }}>{delta}</span>
    return <span style={{ color: 'var(--clr-text-muted)' }}>0</span>
  }

  return (
    <div className="phs-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="phs-modal phs-modal--wide">
        <div className="phs-modal-head">
          <span className="phs-modal-title">
            Stock History — <span style={{ color: 'var(--clr-primary)', fontWeight: 700 }}>{item.name}</span>
          </span>
          <button className="phs-modal-close" onClick={onClose} type="button">✕</button>
        </div>
        <div className="phs-modal-body phs-audit-body">
          {status === 'loading' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Spinner size={22} />
            </div>
          )}
          {status === 'error' && (
            <p style={{ textAlign: 'center', color: 'var(--clr-text-muted)', padding: '32px 0' }}>
              Could not load history.
            </p>
          )}
          {status === 'done' && logs.length === 0 && (
            <div className="phs-audit-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .35 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p>No stock changes recorded yet.</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Changes will appear here after you edit qty or dispense.</p>
            </div>
          )}
          {status === 'done' && logs.length > 0 && (
            <table className="phs-audit-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th style={{ textAlign: 'right' }}>Old Qty</th>
                  <th style={{ textAlign: 'center' }}>Change</th>
                  <th style={{ textAlign: 'right' }}>New Qty</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="phs-audit-ts">{fmtTs(log.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>{log.old_qty}</td>
                    <td style={{ textAlign: 'center' }}>{deltaLabel(log.change_delta)}</td>
                    <td style={{ textAlign: 'right' }}>{log.new_qty}</td>
                    <td>
                      <span className="phs-audit-reason"
                        style={{ background: REASON_COLOR[log.reason] + '18', color: REASON_COLOR[log.reason] }}>
                        {REASON_LABEL[log.reason] ?? log.reason}
                        {log.prescription_id ? ` #${log.prescription_id}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="phs-modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Medicine tab ─────────────────────────────────────────────────────── */
function MedicineTab({ preFilter }) {
  const [medicines,    setMedicines]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [status,       setStatus]       = useState('loading')
  const [search,       setSearch]       = useState('')
  const [activeCat,    setActiveCat]    = useState('All')

  /* add form */
  const [showAdd,      setShowAdd]      = useState(false)
  const [addForm,      setAddForm]      = useState({ name: '', generic_name: '', category: '', unit: '', price: '', quantity: '', batch_number: '', expiry_date: '', received_date: '', reorder_level: '10' })
  const [adding,       setAdding]       = useState(false)
  const [addDupWarn,   setAddDupWarn]   = useState(false)

  /* inline qty / price edit */
  const [editingQty,   setEditingQty]   = useState({})
  const [editingPrice, setEditingPrice] = useState({})
  const [savingId,     setSavingId]     = useState(null)

  /* full edit modal */
  const [editMed,      setEditMed]      = useState(null)

  /* audit log modal */
  const [auditItem,    setAuditItem]    = useState(null)

  /* delete */
  const [deletingId,   setDeletingId]   = useState(null)
  const [confirmDelId, setConfirmDelId] = useState(null)

  /* import */
  const [showImport,   setShowImport]   = useState(false)

  function load() {
    setStatus('loading')
    getMedicines('', 500)
      .then(({ data }) => {
        setMedicines(data.data || [])
        setTotal(data.data?.length ?? 0)
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => { load() }, [])

  /* Derived values */
  const categories = useMemo(() => {
    const cats = [...new Set(medicines.map(m => m.category).filter(Boolean))].sort()
    return cats
  }, [medicines])

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let list = medicines
    if (preFilter === 'out_of_stock') {
      list = list.filter(m => (m.quantity ?? 0) === 0)
    } else if (preFilter === 'low_stock') {
      list = list.filter(m => (m.quantity ?? 0) > 0 && (m.quantity ?? 0) <= (m.reorder_level ?? 10))
    } else if (preFilter === 'expiring_soon') {
      list = list.filter(m => {
        if (!m.expiry_date) return false
        const exp = new Date(m.expiry_date)
        const days = Math.round((exp - today) / 86400000)
        return days >= 0 && days <= 30
      })
    } else if (preFilter === 'expired') {
      list = list.filter(m => {
        if (!m.expiry_date) return false
        return new Date(m.expiry_date) < today
      })
    }
    if (activeCat !== 'All') list = list.filter(m => m.category === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.generic_name ?? '').toLowerCase().includes(q) ||
        (m.category ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [medicines, search, activeCat, preFilter])

  const stats = useMemo(() => ({
    total:    medicines.length,
    outStock: medicines.filter(m => (m.quantity ?? 0) === 0).length,
    value:    medicines.reduce((s, m) => {
      if (m.price != null && m.quantity > 0) return s + (parseFloat(m.price) * m.quantity)
      return s
    }, 0),
  }), [medicines])

  /* ── Inline save ─────────────────────────────────────────────────────── */
  async function saveField(med, field, rawValue) {
    const clear = () => {
      if (field === 'quantity') setEditingQty(p => { const n = { ...p }; delete n[med.id]; return n })
      else setEditingPrice(p => { const n = { ...p }; delete n[med.id]; return n })
    }
    const parsed = field === 'quantity' ? parseInt(rawValue, 10) : parseFloat(rawValue)
    const current = field === 'quantity' ? (med.quantity ?? 0) : med.price
    if (field === 'quantity' && (isNaN(parsed) || parsed < 0 || parsed === current)) { clear(); return }
    if (field === 'price' && rawValue === '' && current == null) { clear(); return }
    setSavingId(med.id)
    try {
      const payload = {
        name:          med.name,
        generic_name:  med.generic_name  ?? null,
        category:      med.category      ?? null,
        unit:          med.unit           ?? null,
        quantity:      field === 'quantity' ? parsed : (med.quantity ?? 0),
        price:         field === 'price' ? (rawValue === '' ? null : parseFloat(rawValue)) : (med.price ?? null),
        batch_number:  med.batch_number  ?? null,
        expiry_date:   med.expiry_date   ?? null,
        received_date: med.received_date ?? null,
        reorder_level: med.reorder_level ?? 10,
      }
      const { data } = await patchMedicine(med.id, payload)
      setMedicines(prev => prev.map(m => m.id === med.id ? data : m))
      toast.success(`Updated ${field === 'quantity' ? 'stock' : 'price'} for ${med.name}`)
    } catch {
      toast.error('Could not update — try again.')
    } finally { setSavingId(null); clear() }
  }

  /* ── Add medicine ─────────────────────────────────────────────────────── */
  function checkAddDup(name) {
    setAddDupWarn(name.trim().length > 0 &&
      medicines.some(m => m.name.toLowerCase() === name.trim().toLowerCase()))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.name.trim()) { toast.error('Name is required.'); return }
    setAdding(true)
    try {
      const { data } = await createMedicine({
        name:          addForm.name.trim(),
        generic_name:  addForm.generic_name.trim()  || null,
        category:      addForm.category.trim()       || null,
        unit:          addForm.unit.trim()            || null,
        price:         addForm.price    !== '' ? parseFloat(addForm.price)      : null,
        quantity:      addForm.quantity !== '' ? parseInt(addForm.quantity, 10) : 0,
        batch_number:  addForm.batch_number.trim()   || null,
        expiry_date:   addForm.expiry_date           || null,
        received_date: addForm.received_date         || null,
        reorder_level: addForm.reorder_level !== '' ? parseInt(addForm.reorder_level, 10) : 10,
      })
      setMedicines(prev => [data, ...prev])
      setTotal(t => t + 1)
      setAddForm({ name: '', generic_name: '', category: '', unit: '', price: '', quantity: '', batch_number: '', expiry_date: '', received_date: '', reorder_level: '10' })
      setShowAdd(false)
      setAddDupWarn(false)
      toast.success(`${data.name} added to stock`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not add medicine.')
    } finally { setAdding(false) }
  }

  /* ── Delete ──────────────────────────────────────────────────────────── */
  async function handleDelete(med) {
    setDeletingId(med.id)
    try {
      await deleteMedicine(med.id)
      setMedicines(prev => prev.filter(m => m.id !== med.id))
      setTotal(t => t - 1)
      toast.success(`${med.name} removed`)
    } catch {
      toast.error('Could not delete — medicine may be on active prescriptions.')
    } finally { setDeletingId(null); setConfirmDelId(null) }
  }

  const PRE_FILTER_LABELS = {
    out_of_stock:   { label: 'Out of Stock', color: '#ef4444', bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.25)' },
    low_stock:      { label: 'Low Stock',    color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)' },
    expiring_soon:  { label: 'Expiring in 30 days', color: '#d97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.25)' },
    expired:        { label: 'Expired',      color: '#dc2626', bg: 'rgba(220,38,38,.08)', border: 'rgba(220,38,38,.25)' },
  }

  if (status === 'error') return <div className="card state-panel">Could not load medicine stock.</div>

  return (
    <>
      {/* ── Pre-filter banner ─────────────────────────────────────────── */}
      {preFilter && PRE_FILTER_LABELS[preFilter] && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', marginBottom: 10, borderRadius: 8,
          background: PRE_FILTER_LABELS[preFilter].bg,
          border: `1px solid ${PRE_FILTER_LABELS[preFilter].border}`,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PRE_FILTER_LABELS[preFilter].color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: PRE_FILTER_LABELS[preFilter].color }}>
            Filtered: {PRE_FILTER_LABELS[preFilter].label}
          </span>
          <span style={{ fontSize: 11, color: PRE_FILTER_LABELS[preFilter].color, opacity: .7 }}>
            — {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="phs-stats">
        <div className="phs-stat">
          <span className="phs-stat-val">{stats.total}</span>
          <span className="phs-stat-lbl">Total SKUs</span>
        </div>
        <div className="phs-stat phs-stat--warn">
          <span className="phs-stat-val">{stats.outStock}</span>
          <span className="phs-stat-lbl">Out of Stock</span>
        </div>
        <div className="phs-stat phs-stat--green">
          <span className="phs-stat-val">
            {'₹' + stats.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          <span className="phs-stat-lbl">Stock Value</span>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="phs-toolbar">
        <input className="field phs-search" type="search" placeholder="Search medicine…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <span className="ml-count-tag">
          {status === 'loading' ? '…' : `${filtered.length} / ${total}`}
        </span>
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </button>
          <button className="btn-primary phs-add-btn"
            onClick={() => { setShowAdd(s => !s); setAddForm({ name: '', generic_name: '', category: '', unit: '', price: '', quantity: '', batch_number: '', expiry_date: '', received_date: '', reorder_level: '10' }); setAddDupWarn(false) }}>
            {showAdd ? 'Cancel' : '+ Add Medicine'}
          </button>
        </div>
      </div>

      {/* ── Category filter chips ──────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="phs-cat-chips">
          {['All', ...categories].map(cat => (
            <button key={cat}
              className={`phs-cat-chip${activeCat === cat ? ' phs-cat-chip--on' : ''}`}
              onClick={() => setActiveCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Add form ──────────────────────────────────────────────────── */}
      {showAdd && (
        <form className="card phs-add-form" onSubmit={handleAdd}>
          <div className="phs-add-grid">
            <div className="field-group">
              <label className="field-label">Name *</label>
              <input className={`field${addDupWarn ? ' field--warn' : ''}`}
                placeholder="e.g. Paracetamol 500mg" value={addForm.name}
                onChange={e => { setAddForm(f => ({ ...f, name: e.target.value })); checkAddDup(e.target.value) }}
                autoFocus />
              {addDupWarn && <p className="phs-dup-warn">⚠ This medicine already exists.</p>}
            </div>
            <div className="field-group">
              <label className="field-label">Generic Name</label>
              <input className="field" placeholder="e.g. Acetaminophen" value={addForm.generic_name}
                onChange={e => setAddForm(f => ({ ...f, generic_name: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Category</label>
              <CategoryPicker value={addForm.category}
                onChange={v => setAddForm(f => ({ ...f, category: v }))}
                categories={categories} />
            </div>
            <div className="field-group">
              <label className="field-label">Unit</label>
              <input className="field" placeholder="e.g. Tablet" list="phs-unit-list"
                value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Selling Price (₹)</label>
              <input className="field" type="number" min="0" step="0.01" placeholder="0.00"
                value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Stock Qty</label>
              <input className="field" type="number" min="0" step="1" placeholder="0"
                value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Batch Number</label>
              <input className="field" placeholder="e.g. BT-2024-001"
                value={addForm.batch_number} onChange={e => setAddForm(f => ({ ...f, batch_number: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Expiry Date</label>
              <input className="field" type="date"
                value={addForm.expiry_date} onChange={e => setAddForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Received Date</label>
              <input className="field" type="date"
                value={addForm.received_date} onChange={e => setAddForm(f => ({ ...f, received_date: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Reorder Level</label>
              <input className="field" type="number" min="0" step="1" placeholder="10"
                value={addForm.reorder_level} onChange={e => setAddForm(f => ({ ...f, reorder_level: e.target.value }))} />
            </div>
          </div>
          <div className="phs-add-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} disabled={adding}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? 'Adding…' : 'Add Medicine'}
            </button>
          </div>
        </form>
      )}

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 'var(--space-sm)' }}>
        {status === 'loading' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <Spinner size={26} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="💊"
            title={medicines.length === 0 ? 'No medicines yet' : activeCat !== 'All' ? `No medicines in "${activeCat}"` : 'No medicines match your search'}
            description={medicines.length === 0 ? 'Add a medicine or import from a CSV file.' : 'Try a different search or category.'}
          />
        ) : (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th style={{ width: '16px' }}></th>
                  <th>Medicine Name</th>
                  <th>Generic</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ width: '100px' }}>Expiry</th>
                  <th style={{ textAlign: 'right', width: '80px' }}>Qty</th>
                  <th style={{ textAlign: 'right', width: '110px' }}>Price</th>
                  <th style={{ width: '112px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(med => {
                  const isEditQty   = editingQty[med.id]   !== undefined
                  const isEditPrice = editingPrice[med.id] !== undefined
                  const isSaving    = savingId === med.id
                  const isDel       = deletingId === med.id
                  const isConfirm   = confirmDelId === med.id
                  return (
                    <tr key={med.id} className="ml-table-row">
                      <td style={{ padding: '10px 6px 10px 16px' }}>
                        <StockDot qty={med.quantity ?? 0} reorderLevel={med.reorder_level ?? 10} />
                      </td>
                      <td className="ml-td-name">{med.name}</td>
                      <td className="ml-td-muted">{med.generic_name || '—'}</td>
                      <td>
                        {med.category
                          ? <span className="phs-cat-tag">{med.category}</span>
                          : <span className="ml-td-muted">—</span>}
                      </td>
                      <td className="ml-td-muted">{med.unit || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <ExpiryBadge expiryDate={med.expiry_date} />
                      </td>

                      {/* Inline qty */}
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                        {isEditQty ? (
                          <input className="phs-qty-input" type="number" min="0" step="1"
                            value={editingQty[med.id]}
                            onChange={e => setEditingQty(p => ({ ...p, [med.id]: e.target.value }))}
                            onBlur={() => saveField(med, 'quantity', editingQty[med.id])}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveField(med, 'quantity', editingQty[med.id])
                              if (e.key === 'Escape') setEditingQty(p => { const n = { ...p }; delete n[med.id]; return n })
                            }}
                            disabled={isSaving} autoFocus />
                        ) : (
                          <button
                            className={`phs-qty-btn${(med.quantity ?? 0) === 0 ? ' phs-qty-btn--zero' : ''}`}
                            onClick={() => setEditingQty(p => ({ ...p, [med.id]: String(med.quantity ?? 0) }))}
                            title="Click to update stock">
                            {med.quantity ?? 0}
                          </button>
                        )}
                      </td>

                      {/* Inline price */}
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                        {isEditPrice ? (
                          <input className="phs-qty-input" type="number" min="0" step="0.01"
                            value={editingPrice[med.id]}
                            onChange={e => setEditingPrice(p => ({ ...p, [med.id]: e.target.value }))}
                            onBlur={() => saveField(med, 'price', editingPrice[med.id])}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveField(med, 'price', editingPrice[med.id])
                              if (e.key === 'Escape') setEditingPrice(p => { const n = { ...p }; delete n[med.id]; return n })
                            }}
                            disabled={isSaving} autoFocus />
                        ) : (
                          <button className="phs-qty-btn"
                            onClick={() => setEditingPrice(p => ({ ...p, [med.id]: med.price != null ? String(med.price) : '' }))}
                            title="Click to set price">
                            {med.price != null
                              ? fmtPrice(med.price)
                              : <span style={{ color: 'var(--clr-text-muted)', fontSize: '11px' }}>Set price</span>}
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        {isConfirm ? (
                          <span style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="phs-del-confirm-btn" onClick={() => handleDelete(med)} disabled={isDel}>
                              {isDel ? <Spinner size={10} /> : 'Yes'}
                            </button>
                            <button className="phs-del-cancel-btn" onClick={() => setConfirmDelId(null)}>✕</button>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="phs-hist-btn" title="Stock history"
                              onClick={() => setAuditItem({ type: 'medicine', id: med.id, name: med.name })}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                              </svg>
                            </button>
                            <button className="phs-edit-btn" onClick={() => setEditMed(med)} title="Edit medicine">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
                              </svg>
                            </button>
                            <button className="phs-del-btn" onClick={() => setConfirmDelId(med.id)} title="Remove">✕</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="phs-hint">
        Click qty or price to edit inline. Use ✎ to edit all fields. Dot: <span style={{ color: '#10b981' }}>●</span> In stock &nbsp; <span style={{ color: '#f59e0b' }}>●</span> Low &nbsp; <span style={{ color: '#ef4444' }}>●</span> Out of stock
      </p>

      {/* Datalist for units */}
      <datalist id="phs-unit-list">
        {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
      </datalist>

      {/* Edit modal */}
      {editMed && (
        <EditMedicineModal
          medicine={editMed}
          categories={categories}
          medicines={medicines}
          onClose={() => setEditMed(null)}
          onSaved={updated => {
            setMedicines(prev => prev.map(m => m.id === updated.id ? updated : m))
            setEditMed(null)
          }}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <MedicineImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { load(); setShowImport(false) }}
        />
      )}

      {/* Audit log modal */}
      {auditItem && (
        <AuditLogModal item={auditItem} onClose={() => setAuditItem(null)} />
      )}
    </>
  )
}

/* ── Other stock items tab ────────────────────────────────────────────── */
const EMPTY_ITEM = { name: '', category: '', unit: '', selling_price: '', stock_quantity: '' }

function StockItemsTab() {
  const [items,      setItems]      = useState([])
  const [status,     setStatus]     = useState('loading')
  const [showAdd,    setShowAdd]    = useState(false)
  const [addRows,    setAddRows]    = useState([{ ...EMPTY_ITEM }])
  const [adding,     setAdding]     = useState(false)
  const [editingId,  setEditingId]  = useState(null)
  const [editForm,   setEditForm]   = useState(EMPTY_ITEM)
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [auditItem,  setAuditItem]  = useState(null)

  useEffect(() => {
    getStockItems()
      .then(({ data }) => { setItems(data.data || []); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [])

  const itemCategories = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean))].sort(), [items])

  const itemStats = useMemo(() => ({
    total:    items.length,
    outStock: items.filter(i => (i.stock_quantity ?? 0) === 0).length,
    value:    items.reduce((s, i) => {
      if (i.selling_price != null && i.stock_quantity > 0) return s + (parseFloat(i.selling_price) * i.stock_quantity)
      return s
    }, 0),
  }), [items])

  function setRowField(idx, field, value) {
    setAddRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setAddRows(prev => [...prev, { ...EMPTY_ITEM }])
  }

  function removeRow(idx) {
    setAddRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleAdd(e) {
    e.preventDefault()
    const validRows = addRows.filter(r => r.name.trim())
    if (!validRows.length) { toast.error('At least one item name is required.'); return }
    setAdding(true)
    try {
      const results = await Promise.all(validRows.map(row => createStockItem({
        name:           row.name.trim(),
        category:       row.category.trim()       || null,
        unit:           row.unit.trim()            || null,
        selling_price:  row.selling_price !== '' ? parseFloat(row.selling_price) : null,
        stock_quantity: row.stock_quantity !== '' ? parseInt(row.stock_quantity, 10) : 0,
      })))
      const added = results.map(r => r.data)
      setItems(prev => [...added.reverse(), ...prev])
      setAddRows([{ ...EMPTY_ITEM }])
      setShowAdd(false)
      toast.success(added.length > 1 ? `${added.length} items added` : `${added[0].name} added`)
    } catch { toast.error('Could not add item(s) — try again.') }
    finally { setAdding(false) }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({
      name:           item.name,
      category:       item.category ?? '',
      unit:           item.unit ?? '',
      selling_price:  item.selling_price != null ? String(item.selling_price) : '',
      stock_quantity: String(item.stock_quantity ?? 0),
    })
  }

  async function handleSaveEdit(item) {
    setSaving(true)
    try {
      const { data } = await updateStockItem(item.id, {
        name:           editForm.name.trim() || item.name,
        category:       editForm.category.trim() || null,
        unit:           editForm.unit.trim() || null,
        selling_price:  editForm.selling_price !== '' ? parseFloat(editForm.selling_price) : null,
        stock_quantity: editForm.stock_quantity !== '' ? parseInt(editForm.stock_quantity, 10) : 0,
      })
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
      setEditingId(null)
      toast.success(`${data.name} updated`)
    } catch { toast.error('Could not save — try again.') }
    finally { setSaving(false) }
  }

  async function handleDelete(item) {
    setDeletingId(item.id)
    try {
      await deleteStockItem(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success(`${item.name} deleted`)
    } catch { toast.error('Could not delete item.') }
    finally { setDeletingId(null); setConfirmDel(null) }
  }

  if (status === 'error') return <div className="card state-panel">Could not load stock items.</div>

  return (
    <>
      {/* Stats */}
      <div className="phs-stats">
        <div className="phs-stat">
          <span className="phs-stat-val">{itemStats.total}</span>
          <span className="phs-stat-lbl">Total Items</span>
        </div>
        <div className="phs-stat phs-stat--warn">
          <span className="phs-stat-val">{itemStats.outStock}</span>
          <span className="phs-stat-lbl">Out of Stock</span>
        </div>
        <div className="phs-stat phs-stat--green">
          <span className="phs-stat-val">
            {'₹' + itemStats.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          <span className="phs-stat-lbl">Stock Value</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="phs-toolbar">
        <span style={{ color: 'var(--clr-text-muted)', fontSize: '13px' }}>
          {status === 'loading' ? '…' : `${items.length} items`}
        </span>
        <button className="btn-primary phs-add-btn" style={{ marginLeft: 'auto' }}
          onClick={() => { setShowAdd(s => !s); setAddRows([{ ...EMPTY_ITEM }]); setEditingId(null) }}>
          {showAdd ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showAdd && (
        <form className="card phs-add-form" onSubmit={handleAdd}>
          <div className="phs-multi-header">
            <span>Item Name *</span>
            <span>Category</span>
            <span>Unit</span>
            <span>Price (₹)</span>
            <span>Qty</span>
            <span></span>
          </div>
          {addRows.map((row, idx) => (
            <div key={idx} className="phs-multi-row">
              <input className="field" placeholder="e.g. Water bottle"
                value={row.name} autoFocus={idx === 0}
                onChange={e => setRowField(idx, 'name', e.target.value)} />
              <CategoryPicker value={row.category}
                onChange={v => setRowField(idx, 'category', v)}
                categories={itemCategories} />
              <input className="field" placeholder="piece, pack"
                value={row.unit}
                onChange={e => setRowField(idx, 'unit', e.target.value)} />
              <input className="field" type="number" min="0" step="0.01" placeholder="0.00"
                value={row.selling_price}
                onChange={e => setRowField(idx, 'selling_price', e.target.value)} />
              <input className="field" type="number" min="0" step="1" placeholder="0"
                value={row.stock_quantity}
                onChange={e => setRowField(idx, 'stock_quantity', e.target.value)} />
              <span className="phs-row-ctrl">
                <button type="button" className="phs-row-add-btn" onClick={addRow} title="Add another row">+</button>
                {addRows.length > 1 && (
                  <button type="button" className="phs-row-rm-btn" onClick={() => removeRow(idx)} title="Remove row">×</button>
                )}
              </span>
            </div>
          ))}
          <div className="phs-add-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} disabled={adding}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? 'Adding…' : addRows.filter(r => r.name.trim()).length > 1 ? `Add ${addRows.filter(r => r.name.trim()).length} Items` : 'Add Item'}
            </button>
          </div>
        </form>
      )}

      {status === 'loading' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}><Spinner size={26} /></div>
      ) : items.length === 0 ? (
        <div className="card" style={{ marginTop: 'var(--space-sm)' }}>
          <EmptyState icon="📦" title="No other items yet" description="Add water bottles, stationery, or other clinic supplies above." />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 'var(--space-sm)' }}>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th style={{ width: '16px' }}></th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '112px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isEditing = editingId === item.id
                  const isDel     = deletingId === item.id
                  const isConfirm = confirmDel === item.id
                  return (
                    <tr key={item.id} className="ml-table-row">
                      <td style={{ padding: '10px 6px 10px 16px' }}>
                        <StockDot qty={item.stock_quantity ?? 0} />
                      </td>
                      {isEditing ? (
                        <>
                          <td><input className="field phs-inline-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
                          <td><input className="field phs-inline-input" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} placeholder="—" /></td>
                          <td><input className="field phs-inline-input" value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} placeholder="—" /></td>
                          <td><input className="field phs-inline-input" type="number" min="0" step="0.01" value={editForm.selling_price} onChange={e => setEditForm(f => ({ ...f, selling_price: e.target.value }))} style={{ textAlign: 'right' }} /></td>
                          <td><input className="field phs-inline-input" type="number" min="0" step="1" value={editForm.stock_quantity} onChange={e => setEditForm(f => ({ ...f, stock_quantity: e.target.value }))} style={{ textAlign: 'right' }} /></td>
                          <td>
                            <span style={{ display: 'flex', gap: '4px' }}>
                              <button className="phs-del-confirm-btn" onClick={() => handleSaveEdit(item)} disabled={saving}>
                                {saving ? <Spinner size={10} /> : '✓ Save'}
                              </button>
                              <button className="phs-del-cancel-btn" onClick={() => setEditingId(null)}>✕</button>
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="ml-td-name">{item.name}</td>
                          <td>{item.category ? <span className="phs-cat-tag">{item.category}</span> : <span className="ml-td-muted">—</span>}</td>
                          <td className="ml-td-muted">{item.unit || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{fmtPrice(item.selling_price)}</td>
                          <td style={{ textAlign: 'right' }}>{item.stock_quantity}</td>
                          <td>
                            {isConfirm ? (
                              <span style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button className="phs-del-confirm-btn" onClick={() => handleDelete(item)} disabled={isDel}>
                                  {isDel ? <Spinner size={10} /> : 'Yes'}
                                </button>
                                <button className="phs-del-cancel-btn" onClick={() => setConfirmDel(null)}>✕</button>
                              </span>
                            ) : (
                              <span style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button className="phs-hist-btn" title="Stock history"
                                  onClick={() => setAuditItem({ type: 'stock_item', id: item.id, name: item.name })}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                  </svg>
                                </button>
                                <button className="phs-edit-btn" onClick={() => startEdit(item)}>Edit</button>
                                <button className="phs-del-btn" onClick={() => setConfirmDel(item.id)}>✕</button>
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="phs-hint">Manage non-medicine stock — water, stationery, and other dispensary supplies.</p>

      {auditItem && (
        <AuditLogModal item={auditItem} onClose={() => setAuditItem(null)} />
      )}
    </>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function PharmacyStockPage() {
  const [searchParams] = useSearchParams()
  const preFilter  = searchParams.get('filter') || null
  const initialTab = searchParams.get('tab') === 'stock' ? 'stock' : 'medicines'
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <div>
      <div className="phs-tabs">
        <button className={`phs-tab${activeTab === 'medicines' ? ' phs-tab--on' : ''}`}
          onClick={() => setActiveTab('medicines')}>
          Medicines
        </button>
        <button className={`phs-tab${activeTab === 'stock' ? ' phs-tab--on' : ''}`}
          onClick={() => setActiveTab('stock')}>
          Other Items
        </button>
      </div>

      {activeTab === 'medicines' ? <MedicineTab preFilter={preFilter} /> : <StockItemsTab />}
    </div>
  )
}
