import '../../styles/medicines-page.css'
import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { invoke } from '@tauri-apps/api/core'
import { confirmDelete } from '../../lib/swal'
import {
  getMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  importMedicines,
} from '../../services/medicineService'
import Spinner from '../../components/ui/Spinner'
import MedicineImportModal from '../../components/medicines/MedicineImportModal'

const UNIT_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Gel', 'Powder', 'Sachet', 'Inhaler', 'Patch']

const CATEGORY_OPTIONS = [
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream / Ointment',
  'Eye Drops', 'Ear Drops', 'Inhaler', 'Powder', 'Patch / Transdermal',
  'Suppository', 'Solution', 'Suspension', 'Gel',
]

const BLANK_FORM = {
  name: '', generic_name: '', category: '', unit: '', quantity: '', price: '',
}

/* ── Export helpers ────────────────────────────────────────────────────── */

const EXPORT_COLS = ['Name', 'Generic Name', 'Category', 'Unit', 'Quantity', 'Price']

function toRows(list) {
  return list.map(m => [
    m.name,
    m.generic_name  || '',
    m.category      || '',
    m.unit          || '',
    m.quantity      ?? 0,
    m.price != null ? parseFloat(m.price) : '',
  ])
}

async function doExport(fmt, list) {
  if (!list.length) return
  const rows = toRows(list)
  try {
    if (fmt === 'csv') {
      const BOM  = '﻿'
      const body = [EXPORT_COLS, ...rows]
        .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n')
      const saved = await invoke('write_text_to_downloads', { content: BOM + body, filename: 'medicines.csv' })
      toast.success(`Exported to Downloads: ${saved}`)
      return
    }
    if (fmt === 'txt') {
      const body = [EXPORT_COLS, ...rows].map(r => r.join('\t')).join('\r\n')
      const saved = await invoke('write_text_to_downloads', { content: body, filename: 'medicines.txt' })
      toast.success(`Exported to Downloads: ${saved}`)
      return
    }
    if (fmt === 'xls') {
      const data = list.map(m => ({
        'Name':         m.name,
        'Generic Name': m.generic_name  || '',
        'Category':     m.category      || '',
        'Unit':         m.unit          || '',
        'Quantity':     m.quantity      ?? 0,
        'Price':        m.price != null ? parseFloat(m.price) : '',
      }))
      const ws  = XLSX.utils.json_to_sheet(data)
      const wb  = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Medicines')
      const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
      const saved = await invoke('write_bytes_to_downloads', { b64, filename: 'medicines.xlsx' })
      toast.success(`Exported to Downloads: ${saved}`)
    }
  } catch {
    toast.error('Export failed — could not write file.')
  }
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

function ExportMenu({ list }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(fmt) {
    setOpen(false)
    doExport(fmt, list)
  }

  return (
    <div className="ml-export-wrap" ref={ref}>
      <button
        className="btn-secondary ml-export-btn"
        onClick={() => setOpen(o => !o)}
        disabled={list.length === 0}
        title={list.length === 0 ? 'No medicines to export' : 'Export medicines list'}
      >
        <IconDownload />
        Export
        <span className="ml-export-caret">▾</span>
      </button>
      {open && (
        <div className="ml-export-menu">
          <button className="ml-export-item" onClick={() => pick('csv')}>Export CSV</button>
          <button className="ml-export-item" onClick={() => pick('txt')}>Export TXT</button>
          <button className="ml-export-item" onClick={() => pick('xls')}>Export XLS</button>
        </div>
      )}
    </div>
  )
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/* ── Category combobox ───────────────────────────────────────────────────── */

function CategoryCombobox({ value, onChange, categories = [] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Merge static options with dynamic categories from loaded medicines (deduplicated)
  const allOpts = useMemo(() => {
    const combined = [...new Set([...categories, ...CATEGORY_OPTIONS])]
    return combined.sort()
  }, [categories])

  const filtered = value.trim()
    ? allOpts.filter(c => c.toLowerCase().includes(value.toLowerCase()))
    : allOpts

  return (
    <div className="ml-cat-wrap" ref={wrapRef}>
      <input
        className="field"
        placeholder="Select or type category…"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="ml-cat-drop">
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              className={`ml-cat-option${c === value ? ' ml-cat-option--active' : ''}`}
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

/* ── Multi-add modal ─────────────────────────────────────────────────────── */

let _rowSeq = 0
function makeRow() {
  _rowSeq += 1
  return { id: _rowSeq, name: '', generic_name: '', category: '', unit: '', quantity: '', price: '' }
}

function AddMedicineModal({ onClose, onDone, categories = [], existingNames = [] }) {
  const [rows,   setRows]   = useState(() => [makeRow()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function addRow() {
    setRows(prev => [...prev, makeRow()])
  }

  function removeRow(id) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  function updateRow(id, field, val) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
  }

  const validCount = rows.filter(r => r.name.trim()).length

  async function handleSave(e) {
    e.preventDefault()
    const valid = rows.filter(r => r.name.trim())
    if (valid.length === 0) return
    setSaving(true)
    try {
      const results = await Promise.all(valid.map(r =>
        createMedicine({
          name:         r.name.trim(),
          generic_name: r.generic_name.trim() || null,
          category:     r.category.trim()     || null,
          unit:         r.unit.trim()         || null,
          quantity:     r.quantity !== '' ? parseInt(r.quantity, 10) : 0,
          price:        r.price    !== '' ? parseFloat(r.price)     : null,
        })
      ))
      toast.success(
        valid.length === 1
          ? 'Medicine added to library'
          : `${valid.length} medicines added to library`
      )
      onDone(results.map(r => r.data))
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not save medicines')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ml-modal-backdrop">
      <div className="ml-modal ml-add-modal">
        <div className="ml-modal-head">
          <span className="ml-modal-title">Add Medicines to Library</span>
          <button className="ml-modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSave}>
          <div className="ml-add-body">
            {rows.map((row, idx) => (
              <div key={row.id} className="ml-entry-card">
                <div className="ml-entry-hdr">
                  <span className="ml-entry-hdr-num">Medicine {idx + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="ml-entry-hdr-rm"
                      title="Remove this entry"
                      onClick={() => removeRow(row.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="ml-entry-fields">
                  <div className="field-group">
                    <label className="field-label">
                      Name <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <input
                      className={`field${existingNames.includes(row.name.trim().toLowerCase()) && row.name.trim() ? ' field--warn' : ''}`}
                      placeholder="e.g. Paracetamol 500mg"
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                      autoFocus={idx === 0}
                    />
                    {existingNames.includes(row.name.trim().toLowerCase()) && row.name.trim() && (
                      <p className="phs-dup-warn">⚠ Already in library — will be skipped or overwrite.</p>
                    )}
                  </div>

                  <div className="field-group">
                    <label className="field-label">Generic Name</label>
                    <input
                      className="field"
                      placeholder="e.g. Paracetamol"
                      value={row.generic_name}
                      onChange={e => updateRow(row.id, 'generic_name', e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Category</label>
                    <CategoryCombobox
                      value={row.category}
                      onChange={v => updateRow(row.id, 'category', v)}
                      categories={categories}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Unit / Form</label>
                    <input
                      className="field"
                      placeholder="e.g. Tablet"
                      list="ml-unit-list"
                      value={row.unit}
                      onChange={e => updateRow(row.id, 'unit', e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Stock Qty</label>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={row.quantity}
                      onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Default Price (₹)</label>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={row.price}
                      onChange={e => updateRow(row.id, 'price', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="ml-add-more-wrap">
              <button type="button" className="ml-add-more-btn" onClick={addRow}>
                <IconPlus />
                Add Another Medicine
              </button>
            </div>
          </div>

          <div className="ml-modal-foot">
            <span className="ml-foot-info">
              {validCount > 0
                ? <><strong>{validCount}</strong> medicine{validCount !== 1 ? 's' : ''} ready to save</>
                : 'Fill in at least one medicine name'
              }
            </span>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Dismiss
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || validCount === 0}
            >
              {saving
                ? 'Saving…'
                : validCount > 1
                  ? `Save ${validCount} Medicines`
                  : 'Save Medicine'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Single-medicine edit modal ──────────────────────────────────────────── */

function MedicineModal({ title, form, setForm, onClose, onSubmit, saving, categories = [], existingNames = [], editingId = null }) {
  const isDup = form.name.trim().length > 0 &&
    existingNames.includes(form.name.trim().toLowerCase())

  return (
    <div className="ml-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ml-modal">
        <div className="ml-modal-head">
          <span className="ml-modal-title">{title}</span>
          <button className="ml-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-stack">
            <div className="field-group">
              <label className="field-label">
                Name <span style={{ color: 'var(--clr-danger)' }}>*</span>
              </label>
              <input
                className={`field${isDup ? ' field--warn' : ''}`}
                placeholder="e.g. Paracetamol 500mg"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
              {isDup && <p className="phs-dup-warn">⚠ Another medicine with this name already exists.</p>}
            </div>

            <div className="field-group">
              <label className="field-label">Generic Name</label>
              <input
                className="field"
                placeholder="e.g. Paracetamol"
                value={form.generic_name}
                onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
              />
            </div>

            <div className="med-row">
              <div className="field-group">
                <label className="field-label">Category</label>
                <CategoryCombobox
                  value={form.category}
                  onChange={v => setForm(f => ({ ...f, category: v }))}
                  categories={categories}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Unit / Form</label>
                <input
                  className="field"
                  placeholder="Tablet"
                  list="ml-unit-list"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                />
                <datalist id="ml-unit-list">
                  {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
                </datalist>
              </div>
            </div>

            <div className="med-row">
              <div className="field-group">
                <label className="field-label">Quantity (stock)</label>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Default Price (₹)</label>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="ml-modal-foot">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── CSV import modal ────────────────────────────────────────────────────── */

function ImportModal({ onClose, onDone }) {
  const [file,    setFile]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)

  async function handleImport(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (!lines.length) throw new Error('File is empty')

      // Detect separator and skip header if present
      const isTsv = lines[0].includes('\t')
      const split = l => isTsv ? l.split('\t').map(c => c.trim()) : l.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
      const firstCols = split(lines[0])
      const hasHeader = /^name$/i.test(firstCols[0])
      const dataLines = hasHeader ? lines.slice(1) : lines

      const items = dataLines.map(line => {
        const c = split(line)
        return {
          name:         c[0] ?? '',
          generic_name: c[1] || null,
          category:     c[2] || null,
          unit:         c[3] || null,
          quantity:     c[4] ? (parseInt(c[4], 10) || 0) : 0,
          price:        c[5] ? (parseFloat(c[5]) || null) : null,
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
      const msg = err.message ?? err.response?.data?.message ?? 'Import failed — check file format.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ml-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ml-modal">
        <div className="ml-modal-head">
          <span className="ml-modal-title">Import Medicines from CSV</span>
          <button className="ml-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleImport}>
          <div className="ml-import-zone">
            <div className="ml-import-hint">
              Select a <strong>CSV or TXT</strong> file. Supported columns:
              <span className="ml-import-cols"> Name, Generic Name, Category, Unit, Price</span>
              <br />
              First column must be the medicine name. Duplicates are skipped automatically.
            </div>

            <input
              type="file"
              accept=".csv,.txt"
              className="field"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
            />

            {result && (
              <div className="ml-import-result">
                ✓ {result.imported} imported &nbsp;·&nbsp; {result.skipped} skipped
              </div>
            )}
          </div>

          <div className="ml-modal-foot">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!file || loading}
            >
              {loading ? 'Importing…' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([])
  const [total,     setTotal]     = useState(0)
  const [status,    setStatus]    = useState('loading')
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(null) // null | 'add' | 'edit' | 'import'
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(BLANK_FORM)
  const [saving,    setSaving]    = useState(false)

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

  useEffect(load, [])

  // Derived lists for dynamic category dropdown and duplicate detection
  const categories = useMemo(
    () => [...new Set(medicines.map(m => m.category).filter(Boolean))].sort(),
    [medicines]
  )
  const existingNames = useMemo(
    () => medicines.map(m => m.name.toLowerCase()),
    [medicines]
  )
  const editingExistingNames = useMemo(
    () => medicines.filter(m => m.id !== editing?.id).map(m => m.name.toLowerCase()),
    [medicines, editing]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? medicines.filter(m =>
          m.name.toLowerCase().includes(q) ||
          (m.generic_name ?? '').toLowerCase().includes(q) ||
          (m.category ?? '').toLowerCase().includes(q)
        )
      : medicines
    return [...list].sort((a, b) => {
      const aLow = (a.quantity ?? 0) < 10 ? 0 : 1
      const bLow = (b.quantity ?? 0) < 10 ? 0 : 1
      return aLow - bLow
    })
  }, [medicines, search])

  function openAdd() {
    setModal('add')
  }

  function openEdit(med) {
    setForm({
      name:         med.name,
      generic_name: med.generic_name ?? '',
      category:     med.category ?? '',
      unit:         med.unit ?? '',
      quantity:     med.quantity != null ? String(med.quantity) : '',
      price:        med.price != null ? String(med.price) : '',
    })
    setEditing(med)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name:         form.name.trim(),
      generic_name: form.generic_name.trim() || null,
      category:     form.category.trim()     || null,
      unit:         form.unit.trim()         || null,
      quantity:     form.quantity !== '' ? parseInt(form.quantity, 10) : 0,
      price:        form.price    !== '' ? parseFloat(form.price)     : null,
    }
    try {
      const { data } = await updateMedicine(editing.id, payload)
      setMedicines(prev => prev.map(m => m.id === editing.id ? data : m))
      toast.success('Medicine updated')
      closeModal()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not save medicine')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(med) {
    const ok = await confirmDelete({ title: `Delete "${med.name}"?`, text: 'It will be removed from the medicine library.' })
    if (!ok) return
    try {
      await deleteMedicine(med.id)
      setMedicines(prev => prev.filter(m => m.id !== med.id))
      setTotal(t => t - 1)
      toast.success('Medicine removed')
    } catch {
      toast.error('Could not delete medicine')
    }
  }

  function fmtPrice(p) {
    if (p == null) return '—'
    return '₹' + parseFloat(p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (status === 'error') {
    return <div className="card state-panel">Could not load medicine library — check your connection.</div>
  }

  return (
    <div>
      {/* Shared datalist for unit options */}
      <datalist id="ml-unit-list">
        {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
      </datalist>

      {/* Toolbar */}
      <div className="ml-toolbar">
        <input
          className="field ml-search"
          type="search"
          placeholder="Search by name, generic or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="ml-count-tag">
          {status === 'loading' ? '…' : `${filtered.length} / ${total}`}
        </span>
        <div className="ml-actions">
          <ExportMenu list={filtered} />
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setModal('import')}
          >
            <IconUpload /> Import
          </button>
          <button
            className="btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={openAdd}
          >
            <IconPlus /> Add Medicine
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {status === 'loading' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0', color: 'var(--clr-text-muted)' }}>
            <Spinner size={26} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="ml-empty">
            {medicines.length === 0
              ? 'No medicines in the library yet. Add one or import from a CSV file.'
              : 'No medicines match your search.'}
          </div>
        ) : (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Generic</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(med => (
                  <tr key={med.id} className={(med.quantity ?? 0) < 10 ? 'ml-row--low-stock' : ''}>
                    <td className="ml-td-name">{med.name}</td>
                    <td className="ml-td-muted">{med.generic_name || '—'}</td>
                    <td className="ml-td-muted">{med.category || '—'}</td>
                    <td className="ml-td-muted">{med.unit || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{med.quantity ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>{fmtPrice(med.price)}</td>
                    <td>
                      <div className="ml-row-actions">
                        <button className="ml-row-btn" title="Edit" onClick={() => openEdit(med)}>
                          <IconEdit />
                        </button>
                        <button
                          className="ml-row-btn ml-row-btn--danger"
                          title="Delete"
                          onClick={() => handleDelete(med)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-add modal */}
      {modal === 'add' && (
        <AddMedicineModal
          categories={categories}
          existingNames={existingNames}
          onClose={closeModal}
          onDone={newMeds => {
            setMedicines(prev => [...newMeds, ...prev])
            setTotal(t => t + newMeds.length)
            closeModal()
          }}
        />
      )}

      {/* Edit modal */}
      {modal === 'edit' && (
        <MedicineModal
          title="Edit Medicine"
          form={form}
          setForm={setForm}
          onClose={closeModal}
          onSubmit={handleSave}
          saving={saving}
          categories={categories}
          existingNames={editingExistingNames}
          editingId={editing?.id}
        />
      )}

      {/* Import modal */}
      {modal === 'import' && (
        <MedicineImportModal
          onClose={closeModal}
          onDone={() => { closeModal(); load() }}
        />
      )}
    </div>
  )
}
