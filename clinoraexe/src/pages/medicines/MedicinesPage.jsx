import '../../styles/medicines-page.css'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSessionState } from '../../hooks/useSessionState'
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
  getStockAlerts,
} from '../../services/medicineService'
import Spinner from '../../components/ui/Spinner'
import MedicineImportModal from '../../components/medicines/MedicineImportModal'
import EmptyState from '../../components/ui/EmptyState'

const UNIT_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Gel', 'Powder', 'Sachet', 'Inhaler', 'Patch']

const CATEGORY_OPTIONS = [
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream / Ointment',
  'Eye Drops', 'Ear Drops', 'Inhaler', 'Powder', 'Patch / Transdermal',
  'Suppository', 'Solution', 'Suspension', 'Gel',
]

const BLANK_FORM = {
  name: '', generic_name: '', category: '', unit: '', quantity: '', price: '',
}

/* ── Stock alert panel ───────────────────────────────────────────────────── */

function fmtExpiry(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AlertGroup({ variant, label, items, renderMeta }) {
  if (!items.length) return null
  return (
    <div className={`ml-alert-group ml-alert-group--${variant}`}>
      <div className="ml-alert-group-hdr">
        <span className={`ml-alert-dot ml-alert-dot--${variant}`} />
        <span className="ml-alert-group-label">{label} ({items.length})</span>
      </div>
      <ul className="ml-alert-list">
        {items.map(m => (
          <li key={m.id} className="ml-alert-item">
            <span className="ml-alert-name">{m.name}</span>
            <span className="ml-alert-meta">{renderMeta(m)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StockAlertPanel({ alerts, onDismiss }) {
  if (!alerts) return null
  const total = alerts.expired.length + alerts.expiring_soon.length + alerts.low_stock.length
  if (total === 0) return null

  return (
    <div className="ml-alert-panel">
      <div className="ml-alert-hdr">
        <div className="ml-alert-hdr-left">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, color: '#b45309' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="ml-alert-title">
            {total} stock alert{total !== 1 ? 's' : ''} need attention
          </span>
        </div>
        <button className="ml-alert-dismiss" onClick={onDismiss} title="Dismiss">×</button>
      </div>

      <div className="ml-alert-groups">
        <AlertGroup
          variant="red"
          label="Expired"
          items={alerts.expired}
          renderMeta={m => `exp. ${fmtExpiry(m.expiry_date)} · qty ${m.quantity}`}
        />
        <AlertGroup
          variant="amber"
          label="Expiring Soon"
          items={alerts.expiring_soon}
          renderMeta={m => `exp. ${fmtExpiry(m.expiry_date)} · qty ${m.quantity}`}
        />
        <AlertGroup
          variant="blue"
          label="Low Stock"
          items={alerts.low_stock}
          renderMeta={m => `qty ${m.quantity} · reorder at ${m.reorder_level}`}
        />
      </div>
    </div>
  )
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
    if (valid.some(r => r.price !== '' && parseFloat(r.price) < 0)) { toast.error('Price cannot be negative.'); return }
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
      <div className="ml-modal mlam-modal">
        <div className="ml-modal-head">
          <span className="ml-modal-title">Add Medicines to Library</span>
          <button className="ml-modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSave}>
          <div className="mlam-table-wrap">
            {/* Column headers */}
            <div className="mlam-col-hdr">
              <span className="mlam-lbl mlam-c-name">Name <span className="mlam-req">*</span></span>
              <span className="mlam-lbl mlam-c-generic">Generic</span>
              <span className="mlam-lbl mlam-c-cat">Category</span>
              <span className="mlam-lbl mlam-c-unit">Unit / Form</span>
              <span className="mlam-lbl mlam-c-qty">Qty</span>
              <span className="mlam-lbl mlam-c-price">Price (₹)</span>
              <span className="mlam-c-del" />
            </div>

            {/* One row per medicine */}
            {rows.map((row, idx) => {
              const isDup = existingNames.includes(row.name.trim().toLowerCase()) && row.name.trim()
              return (
                <div key={row.id} className={`mlam-row${isDup ? ' mlam-row--dup' : ''}`}>
                  <div className="mlam-c-name">
                    <input
                      className="mlam-input"
                      placeholder="Paracetamol 500mg"
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                      autoFocus={idx === 0}
                      title={isDup ? 'Already in library' : undefined}
                    />
                    {isDup && <span className="mlam-dup-dot" title="Already in library">!</span>}
                  </div>

                  <input
                    className="mlam-input mlam-c-generic"
                    placeholder="Paracetamol"
                    value={row.generic_name}
                    onChange={e => updateRow(row.id, 'generic_name', e.target.value)}
                  />

                  <div className="mlam-c-cat">
                    <CategoryCombobox
                      value={row.category}
                      onChange={v => updateRow(row.id, 'category', v)}
                      categories={categories}
                    />
                  </div>

                  <input
                    className="mlam-input mlam-c-unit"
                    placeholder="Tablet"
                    list="ml-unit-list"
                    value={row.unit}
                    onChange={e => updateRow(row.id, 'unit', e.target.value)}
                  />

                  <input
                    className="mlam-input mlam-c-qty"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={row.quantity}
                    onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                  />

                  <input
                    className="mlam-input mlam-c-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={row.price}
                    onChange={e => updateRow(row.id, 'price', e.target.value)}
                  />

                  <div className="mlam-c-del">
                    {rows.length > 1 && (
                      <button type="button" className="mlam-del-btn" onClick={() => removeRow(row.id)} title="Remove">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

          </div>

            {/* Add row button — outside the bordered table */}
            <button type="button" className="mlam-add-row-btn" onClick={addRow}>
              <IconPlus /> Add Another Medicine
            </button>

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
  const [search,    setSearch]    = useSessionState('medicines:search', '')
  const [modal,     setModal]     = useState(null) // null | 'add' | 'edit' | 'import'
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(BLANK_FORM)
  const [saving,    setSaving]    = useState(false)
  const [alerts,    setAlerts]    = useState(null)
  const [alertsDismissed, setAlertsDismissed] = useState(false)

  useEffect(() => {
    getStockAlerts()
      .then(({ data }) => setAlerts(data))
      .catch(() => {})
  }, [])

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
    if (form.price !== '' && parseFloat(form.price) < 0) { toast.error('Price cannot be negative.'); return }
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

  const lowStockCount = medicines.filter(m => (m.quantity ?? 0) < 10).length

  return (
    <div className="mlib-page">
      <datalist id="ml-unit-list">
        {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
      </datalist>

      {/* ── Page header ── */}
      <div className="mlib-hdr">
        <div className="mlib-hdr-info">
          <h1 className="mlib-title">Medicine Library</h1>
          <p className="mlib-sub">Stock · pricing · dosage forms</p>
        </div>
        <div className="mlib-hdr-meta">
          {status === 'done' && (
            <span className="mlib-count-pill">{total} medicines</span>
          )}
          {lowStockCount > 0 && (
            <span className="mlib-warn-pill">⚠ {lowStockCount} low stock</span>
          )}
        </div>
        <div className="mlib-hdr-actions">
          <ExportMenu list={filtered} />
          <button
            className="btn-secondary mlib-act-btn"
            onClick={() => setModal('import')}
          >
            <IconUpload /> Import
          </button>
          <button className="btn-primary mlib-act-btn" onClick={openAdd}>
            <IconPlus /> Add Medicine
          </button>
        </div>
      </div>

      {/* ── Stock alerts ── */}
      {!alertsDismissed && (
        <div className="mlib-alerts-wrap">
          <StockAlertPanel alerts={alerts} onDismiss={() => setAlertsDismissed(true)} />
        </div>
      )}

      {/* ── Gray body ── */}
      <div className="mlib-body">

        {/* Search row */}
        <div className="mlib-search-row">
          <div className="mlib-search-wrap">
            <svg className="mlib-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="mlib-search-input"
              type="search"
              placeholder="Search medicine, generic or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="mlib-count-tag">
            {status === 'loading' ? '…' : `${filtered.length} of ${total}`}
          </span>
        </div>

        {/* Table card */}
        <div className="mlib-table-card">
          {status === 'loading' ? (
            <div className="mlib-state-loading"><Spinner size={26} /></div>
          ) : filtered.length === 0 ? (
            <div className="mlib-state-empty">
              <div className="mlib-empty-icon">💊</div>
              <div className="mlib-empty-title">
                {medicines.length === 0 ? 'No medicines yet' : 'No medicines match your search'}
              </div>
              <div className="mlib-empty-sub">
                {medicines.length === 0 ? 'Add a medicine or import from a CSV file' : 'Try a different name or category'}
              </div>
              {medicines.length === 0 && (
                <button className="btn-primary" style={{ marginTop: 14, fontSize: 13 }} onClick={openAdd}>
                  <IconPlus /> Add First Medicine
                </button>
              )}
            </div>
          ) : (
            <div className="ml-table-wrap">
              <table className="ml-table mlib-tbl">
                <thead>
                  <tr>
                    <th className="mlib-th-name">Medicine Name</th>
                    <th>Generic</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th className="mlib-th-num">Qty</th>
                    <th className="mlib-th-num">Price</th>
                    <th className="mlib-th-act"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(med => {
                    const isLow = (med.quantity ?? 0) < 10
                    return (
                      <tr key={med.id} className={isLow ? 'ml-row--low-stock' : ''}>
                        <td className="mlib-td-name">
                          <span className="mlib-med-name">{med.name}</span>
                          {isLow && <span className="mlib-low-badge">Low stock</span>}
                        </td>
                        <td className="ml-td-muted">{med.generic_name || '—'}</td>
                        <td>
                          {med.category
                            ? <span className="mlib-cat-pill">{med.category}</span>
                            : <span className="ml-td-muted">—</span>
                          }
                        </td>
                        <td className="ml-td-muted">{med.unit || '—'}</td>
                        <td className="mlib-td-num">
                          <span className={isLow ? 'mlib-qty--low' : ''}>{med.quantity ?? 0}</span>
                        </td>
                        <td className="mlib-td-num">{fmtPrice(med.price)}</td>
                        <td className="mlib-td-act">
                          <div className="ml-row-actions">
                            <button className="mlib-row-btn mlib-row-btn--edit" title="Edit" onClick={() => openEdit(med)}>
                              <IconEdit /> Edit
                            </button>
                            <button className="mlib-row-btn mlib-row-btn--del" title="Delete" onClick={() => handleDelete(med)}>
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>{/* end mlib-body */}

      {/* ── Modals ── */}
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

      {modal === 'import' && (
        <MedicineImportModal
          onClose={closeModal}
          onDone={() => { closeModal(); load() }}
        />
      )}
    </div>
  )
}
