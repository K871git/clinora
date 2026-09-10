import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { importMedicines } from '../../services/medicineService'
import '../../styles/medicine-import-modal.css'

const ACCEPT = '.csv,.txt,.xls,.xlsx,.pdf,.docx'

// ── Column detection ─────────────────────────────────────────────────────────

function detectCols(headers) {
  const n = s => String(s ?? '').toLowerCase().replace(/[\s_\-]+/g, ' ').trim()
  const taken = new Set()

  function pick(patterns) {
    for (const p of patterns) {
      const i = headers.findIndex((h, idx) => !taken.has(idx) && n(h) === p)
      if (i >= 0) { taken.add(i); return i }
    }
    for (const p of patterns) {
      const i = headers.findIndex((h, idx) => !taken.has(idx) && n(h).includes(p))
      if (i >= 0) { taken.add(i); return i }
    }
    return -1
  }

  return {
    name:         pick(['name', 'medicine name', 'drug name', 'medicine', 'drug', 'item name', 'item']),
    generic_name: pick(['generic name', 'generic', 'salt', 'composition', 'active ingredient']),
    category:     pick(['category', 'drug category', 'type', 'drug type', 'class', 'group']),
    unit:         pick(['unit', 'form', 'dosage form', 'uom', 'unit form']),
    quantity:     pick(['quantity', 'qty', 'stock qty', 'stock', 'stocks', 'inventory']),
    price:        pick(['price', 'selling price', 'unit price', 'mrp', 'rate', 'cost', 'sp', 'sale price']),
  }
}

function interpretRows(rawRows) {
  if (!rawRows || rawRows.length === 0) throw new Error('No data found in file')

  const first = rawRows[0].map(c => String(c ?? ''))
  const isHeader = first.some(c => /name|generic|category|unit|qty|quantity|price|rate|mrp|stock/i.test(c))

  let colMap, dataRows
  if (isHeader) {
    colMap = detectCols(first)
    dataRows = rawRows.slice(1)
  } else {
    colMap = { name: 0, generic_name: 1, category: 2, unit: 3, quantity: 4, price: 5 }
    dataRows = rawRows
  }

  if (colMap.name < 0) colMap.name = 0

  return dataRows.map(row => ({
    name:         String(row[colMap.name] ?? '').trim(),
    generic_name: colMap.generic_name >= 0 ? (String(row[colMap.generic_name] ?? '').trim() || null) : null,
    category:     colMap.category >= 0 ? (String(row[colMap.category] ?? '').trim() || null) : null,
    unit:         colMap.unit >= 0 ? (String(row[colMap.unit] ?? '').trim() || null) : null,
    quantity:     colMap.quantity >= 0 ? (parseInt(String(row[colMap.quantity] ?? '0').replace(/[^\d]/g, ''), 10) || 0) : 0,
    price:        colMap.price >= 0 ? (parseFloat(String(row[colMap.price] ?? '').replace(/[₹,\s]/g, '')) || null) : null,
  })).filter(item => item.name)
}

// ── File parsing ─────────────────────────────────────────────────────────────

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'pdf' || ext === 'docx') {
    const buf = await file.arrayBuffer()
    const bytes = Array.from(new Uint8Array(buf))
    const rows = await invoke('parse_medicine_document', { bytes, ext })
    return interpretRows(rows)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buf))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    return interpretRows(raw.map(r => r.map(c => String(c ?? ''))))
  }

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const isTsv = lines[0]?.includes('\t')
    const split = l => isTsv
      ? l.split('\t').map(c => c.trim())
      : (l.match(/("(?:[^"]|"")*"|[^,]*)/g) ?? []).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim())
    return interpretRows(lines.map(split))
  }

  throw new Error(`Unsupported file type: .${ext}`)
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function MedicineImportModal({ onClose, onDone }) {
  const [step,    setStep]    = useState('pick')   // pick | parsing | preview | importing
  const [file,    setFile]    = useState(null)
  const [rows,    setRows]    = useState([])
  const [error,   setError]   = useState(null)
  const [result,  setResult]  = useState(null)
  const [drag,    setDrag]    = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleFile(f) {
    if (!f) return
    setFile(f)
    setError(null)
    setResult(null)
    setStep('parsing')
    try {
      const parsed = await parseFile(f)
      if (parsed.length === 0) throw new Error('No valid medicine rows found — check column headers.')
      setRows(parsed)
      setStep('preview')
    } catch (err) {
      setError(err.message ?? String(err))
      setStep('pick')
    }
  }

  function onFileInput(e) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  async function handleImport() {
    setStep('importing')
    try {
      const { data } = await importMedicines(rows)
      setResult(data)
      toast.success(`Imported ${data.imported} medicine${data.imported !== 1 ? 's' : ''}`, {
        description: data.skipped ? `${data.skipped} duplicate(s) skipped` : undefined,
        duration: 4000,
      })
      onDone()
    } catch (err) {
      setError(err.message ?? 'Import failed')
      setStep('preview')
    }
  }

  const preview = rows.slice(0, 8)

  return (
    <div className="mim-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mim-modal">

        <div className="mim-head">
          <span className="mim-title">Import Medicines</span>
          <button className="mim-close" onClick={onClose} type="button">✕</button>
        </div>

        {/* ── Pick step ── */}
        {(step === 'pick' || step === 'parsing') && (
          <div className="mim-body">
            <div
              className={`mim-drop-zone${drag ? ' mim-drop-zone--drag' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="mim-file-input"
                onChange={onFileInput}
              />
              {step === 'parsing' ? (
                <div className="mim-parsing-state">
                  <div className="mim-spinner" />
                  <span>Reading {file?.name}…</span>
                </div>
              ) : (
                <>
                  <svg className="mim-drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="mim-drop-label">Click to pick a file or drag it here</span>
                  <span className="mim-drop-hint">PDF · DOCX · CSV · XLS · XLSX</span>
                </>
              )}
            </div>

            {error && (
              <div className="mim-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="mim-format-info">
              <strong>Column auto-detection:</strong> The importer reads your file's header row and maps columns by name.
              Recognized names: <em>Name, Generic Name, Category, Unit, Qty/Quantity, Price/MRP/Rate.</em>
              Missing columns get empty values you can fill in later.
            </div>
          </div>
        )}

        {/* ── Preview step ── */}
        {(step === 'preview' || step === 'importing') && (
          <div className="mim-body mim-body--preview">
            <div className="mim-preview-bar">
              <span className="mim-preview-count">
                <strong>{rows.length}</strong> medicine{rows.length !== 1 ? 's' : ''} detected
                {rows.length > 8 && <span className="mim-preview-more"> · showing first 8</span>}
              </span>
              <span className="mim-preview-file">{file?.name}</span>
            </div>

            <div className="mim-preview-wrap">
              <table className="mim-preview-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Generic</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="mim-td-name">{row.name}</td>
                      <td className="mim-td-muted">{row.generic_name || '—'}</td>
                      <td className="mim-td-muted">{row.category || '—'}</td>
                      <td className="mim-td-muted">{row.unit || '—'}</td>
                      <td className="mim-td-num">{row.quantity ?? 0}</td>
                      <td className="mim-td-num">{row.price != null ? `₹${parseFloat(row.price).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="mim-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <p className="mim-preview-note">
              Duplicates (same name already in library) are skipped automatically.
              Imported medicines can be edited afterward.
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mim-foot">
          {step === 'pick' && (
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          )}
          {step === 'parsing' && (
            <button className="btn-secondary" disabled>Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn-secondary" onClick={() => { setStep('pick'); setRows([]); setFile(null) }}>
                Change File
              </button>
              <button className="btn-primary" onClick={handleImport}>
                Import {rows.length} Medicine{rows.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'importing' && (
            <>
              <button className="btn-secondary" disabled>Change File</button>
              <button className="btn-primary" disabled>
                <span className="mim-spinner mim-spinner--sm" /> Importing…
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
