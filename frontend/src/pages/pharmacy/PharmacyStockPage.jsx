import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { getMedicines, patchMedicine } from '../../services/medicineService'
import Spinner from '../../components/ui/Spinner'

function fmtPrice(p) {
  if (p == null) return '—'
  return '₹' + parseFloat(p).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export default function PharmacyStockPage() {
  const [medicines,  setMedicines]  = useState([])
  const [total,      setTotal]      = useState(0)
  const [status,     setStatus]     = useState('loading')
  const [search,     setSearch]     = useState('')
  const [editingQty, setEditingQty] = useState({}) // { [id]: string }
  const [savingId,   setSavingId]   = useState(null)

  useEffect(() => {
    getMedicines('', 500)
      .then(({ data }) => {
        setMedicines(data.data || [])
        setTotal(data.meta?.total ?? 0)
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return medicines
    const q = search.toLowerCase()
    return medicines.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.generic_name ?? '').toLowerCase().includes(q) ||
      (m.category ?? '').toLowerCase().includes(q)
    )
  }, [medicines, search])

  function startEditQty(med) {
    setEditingQty(prev => ({ ...prev, [med.id]: String(med.quantity ?? 0) }))
  }

  async function saveQty(med) {
    const raw = editingQty[med.id]
    const qty = parseInt(raw, 10)
    if (isNaN(qty) || qty < 0 || qty === med.quantity) {
      setEditingQty(prev => { const n = { ...prev }; delete n[med.id]; return n })
      return
    }
    setSavingId(med.id)
    try {
      const { data } = await patchMedicine(med.id, { quantity: qty })
      setMedicines(prev => prev.map(m => m.id === med.id ? data.data : m))
      toast.success(`Stock updated for ${med.name}`)
    } catch {
      toast.error('Could not update stock')
    } finally {
      setSavingId(null)
      setEditingQty(prev => { const n = { ...prev }; delete n[med.id]; return n })
    }
  }

  if (status === 'error') {
    return <div className="card state-panel">Could not load medicine stock — check your connection.</div>
  }

  return (
    <div>
      {/* Search toolbar */}
      <div className="phs-toolbar">
        <input
          className="field phs-search"
          type="search"
          placeholder="Search medicine, generic or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="ml-count-tag">
          {status === 'loading' ? '…' : `${filtered.length} of ${total}`}
        </span>
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
              ? 'No medicines in the library yet. Ask the doctor to add medicines.'
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
                  <th style={{ textAlign: 'right', width: '110px' }}>Qty in Stock</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(med => {
                  const isEditingQty = editingQty[med.id] !== undefined
                  const isSaving     = savingId === med.id
                  return (
                    <tr key={med.id}>
                      <td className="ml-td-name">{med.name}</td>
                      <td className="ml-td-muted">{med.generic_name || '—'}</td>
                      <td className="ml-td-muted">{med.category || '—'}</td>
                      <td className="ml-td-muted">{med.unit || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {isEditingQty ? (
                          <input
                            className="phs-qty-input"
                            type="number"
                            min="0"
                            step="1"
                            value={editingQty[med.id]}
                            onChange={e => setEditingQty(prev => ({ ...prev, [med.id]: e.target.value }))}
                            onBlur={() => saveQty(med)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveQty(med)
                              if (e.key === 'Escape') setEditingQty(prev => { const n = { ...prev }; delete n[med.id]; return n })
                            }}
                            disabled={isSaving}
                            autoFocus
                          />
                        ) : (
                          <button
                            className={`phs-qty-btn${med.quantity === 0 ? ' phs-qty-btn--zero' : ''}`}
                            onClick={() => startEditQty(med)}
                            title="Click to update stock"
                          >
                            {med.quantity ?? 0}
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtPrice(med.price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="phs-hint">
        Click on any quantity to update stock. Changes are saved automatically on blur or Enter.
      </p>
    </div>
  )
}
