import '../../styles/pharmacy-stock.css'
import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  getMedicines, patchMedicine, createMedicine, deleteMedicine, importMedicines, updateMedicine,
} from '../../services/medicineService'
import { getStockItems, createStockItem, updateStockItem, deleteStockItem } from '../../services/stockItemService'
import Spinner from '../../components/ui/Spinner'

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
function StockDot({ qty }) {
  const level = qty === 0 ? 'out' : qty <= 5 ? 'low' : 'ok'
  return <span className={`phs-stock-dot phs-stock-dot--${level}`} title={
    level === 'out' ? 'Out of stock' : level === 'low' ? `Low stock (${qty})` : `In stock (${qty})`
  } />
}

/* ── Edit medicine modal ──────────────────────────────────────────────── */
function EditMedicineModal({ medicine, categories, medicines, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         medicine.name,
    generic_name: medicine.generic_name ?? '',
    category:     medicine.category ?? '',
    unit:         medicine.unit ?? '',
    quantity:     medicine.quantity != null ? String(medicine.quantity) : '0',
    price:        medicine.price != null ? String(medicine.price) : '',
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
        name:         form.name.trim(),
        generic_name: form.generic_name.trim() || null,
        category:     form.category.trim()     || null,
        unit:         form.unit.trim()         || null,
        quantity:     form.quantity !== '' ? parseInt(form.quantity, 10) : 0,
        price:        form.price    !== '' ? parseFloat(form.price)     : null,
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

/* ── Medicine tab ─────────────────────────────────────────────────────── */
function MedicineTab() {
  const [medicines,    setMedicines]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [status,       setStatus]       = useState('loading')
  const [search,       setSearch]       = useState('')
  const [activeCat,    setActiveCat]    = useState('All')

  /* add form */
  const [showAdd,      setShowAdd]      = useState(false)
  const [addForm,      setAddForm]      = useState({ name: '', generic_name: '', category: '', unit: '', price: '', quantity: '' })
  const [adding,       setAdding]       = useState(false)
  const [addDupWarn,   setAddDupWarn]   = useState(false)

  /* inline qty / price edit */
  const [editingQty,   setEditingQty]   = useState({})
  const [editingPrice, setEditingPrice] = useState({})
  const [savingId,     setSavingId]     = useState(null)

  /* full edit modal */
  const [editMed,      setEditMed]      = useState(null)

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
    let list = medicines
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
  }, [medicines, search, activeCat])

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
      const payload = field === 'quantity'
        ? { quantity: parsed }
        : { price: rawValue === '' ? null : parseFloat(rawValue) }
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
        name:         addForm.name.trim(),
        generic_name: addForm.generic_name.trim() || null,
        category:     addForm.category.trim()     || null,
        unit:         addForm.unit.trim()          || null,
        price:        addForm.price !== '' ? parseFloat(addForm.price) : null,
        quantity:     addForm.quantity !== '' ? parseInt(addForm.quantity, 10) : 0,
      })
      setMedicines(prev => [data, ...prev])
      setTotal(t => t + 1)
      setAddForm({ name: '', generic_name: '', category: '', unit: '', price: '', quantity: '' })
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

  if (status === 'error') return <div className="card state-panel">Could not load medicine stock.</div>

  return (
    <>
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
            onClick={() => { setShowAdd(s => !s); setAddForm({ name: '', generic_name: '', category: '', unit: '', price: '', quantity: '' }); setAddDupWarn(false) }}>
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
          <div className="ml-empty">
            {medicines.length === 0
              ? 'No medicines yet. Add or import to get started.'
              : activeCat !== 'All'
                ? `No medicines in "${activeCat}".`
                : 'No medicines match your search.'}
          </div>
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
                  <th style={{ textAlign: 'right', width: '80px' }}>Qty</th>
                  <th style={{ textAlign: 'right', width: '110px' }}>Price</th>
                  <th style={{ width: '90px' }}></th>
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
                        <StockDot qty={med.quantity ?? 0} />
                      </td>
                      <td className="ml-td-name">{med.name}</td>
                      <td className="ml-td-muted">{med.generic_name || '—'}</td>
                      <td>
                        {med.category
                          ? <span className="phs-cat-tag">{med.category}</span>
                          : <span className="ml-td-muted">—</span>}
                      </td>
                      <td className="ml-td-muted">{med.unit || '—'}</td>

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
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { load(); setShowImport(false) }}
        />
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
  const [addForm,    setAddForm]    = useState(EMPTY_ITEM)
  const [adding,     setAdding]     = useState(false)
  const [editingId,  setEditingId]  = useState(null)
  const [editForm,   setEditForm]   = useState(EMPTY_ITEM)
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

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

  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.name.trim()) { toast.error('Name is required.'); return }
    setAdding(true)
    try {
      const { data } = await createStockItem({
        name:           addForm.name.trim(),
        category:       addForm.category.trim()       || null,
        unit:           addForm.unit.trim()            || null,
        selling_price:  addForm.selling_price !== '' ? parseFloat(addForm.selling_price) : null,
        stock_quantity: addForm.stock_quantity !== '' ? parseInt(addForm.stock_quantity, 10) : 0,
      })
      setItems(prev => [data, ...prev])
      setAddForm(EMPTY_ITEM)
      setShowAdd(false)
      toast.success(`${data.name} added`)
    } catch { toast.error('Could not add item.') }
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
          onClick={() => { setShowAdd(s => !s); setAddForm(EMPTY_ITEM); setEditingId(null) }}>
          {showAdd ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showAdd && (
        <form className="card phs-add-form" onSubmit={handleAdd}>
          <div className="phs-add-grid">
            <div className="field-group">
              <label className="field-label">Item Name *</label>
              <input className="field" placeholder="e.g. Water bottle" value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="field-group">
              <label className="field-label">Category</label>
              <CategoryPicker value={addForm.category}
                onChange={v => setAddForm(f => ({ ...f, category: v }))}
                categories={itemCategories} />
            </div>
            <div className="field-group">
              <label className="field-label">Unit</label>
              <input className="field" placeholder="e.g. piece, pack" value={addForm.unit}
                onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Selling Price (₹)</label>
              <input className="field" type="number" min="0" step="0.01" placeholder="0.00"
                value={addForm.selling_price} onChange={e => setAddForm(f => ({ ...f, selling_price: e.target.value }))} />
            </div>
            <div className="field-group">
              <label className="field-label">Stock Qty</label>
              <input className="field" type="number" min="0" step="1" placeholder="0"
                value={addForm.stock_quantity} onChange={e => setAddForm(f => ({ ...f, stock_quantity: e.target.value }))} />
            </div>
          </div>
          <div className="phs-add-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} disabled={adding}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={adding}>{adding ? 'Adding…' : 'Add Item'}</button>
          </div>
        </form>
      )}

      {status === 'loading' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}><Spinner size={26} /></div>
      ) : items.length === 0 ? (
        <div className="card" style={{ marginTop: 'var(--space-sm)' }}>
          <div className="ml-empty">No other items yet. Add water bottles, stationery, etc. above.</div>
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
                  <th style={{ width: '90px' }}></th>
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
    </>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function PharmacyStockPage() {
  const [activeTab, setActiveTab] = useState('medicines')

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

      {activeTab === 'medicines' ? <MedicineTab /> : <StockItemsTab />}
    </div>
  )
}
