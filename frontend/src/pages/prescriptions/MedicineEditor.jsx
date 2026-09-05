import { useRef } from 'react'
import { newMedicineItem } from './medicineUtils'
import MedicineCombobox from '../../components/ui/MedicineCombobox'

/**
 * Controlled medicine list editor.
 * Props:
 *   items      — array of medicine item objects (each has _key + fields)
 *   onChange   — called with the updated items array on every change
 *   itemErrors — optional array of per-item field error objects
 */
export default function MedicineEditor({ items, onChange, itemErrors }) {
  // Refs to medicine name inputs so we can focus the newest item on add
  const nameRefs = useRef({})

  function updateField(key, field, value) {
    onChange(items.map(item => item._key === key ? { ...item, [field]: value } : item))
  }

  function removeItem(key) {
    onChange(items.filter(item => item._key !== key))
  }

  function moveItem(idx, dir) {
    const next = [...items]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  function handleAdd() {
    const item = newMedicineItem()
    onChange([...items, item])
    // Focus the new name input after React renders the new item
    setTimeout(() => nameRefs.current[item._key]?.focus(), 0)
  }

  return (
    <div>
      {items.length === 0 && (
        <p className="med-empty">No medicines added yet. Click &ldquo;Add Medicine&rdquo; below to start.</p>
      )}

      {items.length > 0 && (
        <ul className="med-list">
          {items.map((item, idx) => {
            const errs = itemErrors?.[idx] ?? {}
            return (
              <li key={item._key} className="med-card">

                {/* Card header: number + reorder + remove */}
                <div className="med-card-header">
                  <span className="med-card-num">Medicine {idx + 1}</span>
                  <div className="med-card-controls">
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label="Move up"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, -1)}
                    >↑</button>
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label="Move down"
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(idx, 1)}
                    >↓</button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-remove"
                      aria-label="Remove medicine"
                      onClick={() => removeItem(item._key)}
                    >✕</button>
                  </div>
                </div>

                <div className="form-stack" style={{ gap: '10px' }}>

                  {/* Medicine name — searchable from library */}
                  <div className="field-group">
                    <label className="field-label">
                      Name <span style={{ color: 'var(--clr-danger)' }}>*</span>
                    </label>
                    <MedicineCombobox
                      ref={el => { nameRefs.current[item._key] = el }}
                      hasError={!!errs.medicine_name}
                      value={item.medicine_name}
                      onChange={val => updateField(item._key, 'medicine_name', val)}
                    />
                    {errs.medicine_name && <span className="field-error-msg">{errs.medicine_name}</span>}
                  </div>

                  {/* Dosage / Frequency / Duration — one row on desktop */}
                  <div className="med-row">
                    <div className="field-group">
                      <label className="field-label">Dosage</label>
                      <input
                        className="field"
                        placeholder="e.g. 1 tablet"
                        value={item.dosage}
                        onChange={e => updateField(item._key, 'dosage', e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Frequency</label>
                      <input
                        className="field"
                        placeholder="e.g. TDS"
                        value={item.frequency}
                        onChange={e => updateField(item._key, 'frequency', e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Duration</label>
                      <input
                        className="field"
                        placeholder="e.g. 5 days"
                        value={item.duration}
                        onChange={e => updateField(item._key, 'duration', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Instructions — optional, single line */}
                  <div className="field-group">
                    <label className="field-label" style={{ color: 'var(--clr-text-muted)' }}>
                      Instructions <span style={{ fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      className="field"
                      placeholder="e.g. Take with food, avoid dairy"
                      value={item.instructions}
                      onChange={e => updateField(item._key, 'instructions', e.target.value)}
                    />
                  </div>

                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button type="button" className="med-add-btn" onClick={handleAdd}>
        + Add Medicine
      </button>
    </div>
  )
}
