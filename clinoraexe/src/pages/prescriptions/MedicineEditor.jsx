import '../../styles/medicine-editor.css'
import { useRef } from 'react'
import { newMedicineItem } from './medicineUtils'
import MedicineCombobox from '../../components/ui/MedicineCombobox'

// Known drug class cross-reactions — keyed by allergy name (lowercase)
const CROSS_REACTIONS = {
  penicillin:     ['amoxicillin', 'ampicillin', 'cloxacillin', 'flucloxacillin', 'piperacillin',
                   'cephalexin', 'cefazolin', 'ceftriaxone', 'cefuroxime', 'cefpodoxime',
                   'cefixime', 'cefdinir', 'cefaclor', 'amoxyclav', 'augmentin', 'co-amoxiclav'],
  sulfa:          ['cotrimoxazole', 'sulfamethoxazole', 'bactrim', 'septran', 'dapsone', 'furosemide', 'hydrochlorothiazide'],
  sulfonamide:    ['cotrimoxazole', 'sulfamethoxazole', 'bactrim', 'septran', 'dapsone', 'furosemide', 'hydrochlorothiazide'],
  aspirin:        ['ibuprofen', 'naproxen', 'diclofenac', 'aceclofenac', 'ketorolac',
                   'mefenamic', 'piroxicam', 'etoricoxib', 'celecoxib', 'indomethacin', 'nimesulide'],
  nsaid:          ['ibuprofen', 'naproxen', 'diclofenac', 'aceclofenac', 'ketorolac', 'aspirin',
                   'mefenamic', 'piroxicam', 'etoricoxib', 'celecoxib', 'indomethacin', 'nimesulide'],
  codeine:        ['tramadol', 'morphine', 'tapentadol', 'buprenorphine', 'oxycodone', 'fentanyl'],
  opioid:         ['tramadol', 'morphine', 'codeine', 'tapentadol', 'buprenorphine', 'oxycodone', 'fentanyl'],
  tetracycline:   ['doxycycline', 'minocycline', 'lymecycline'],
  fluoroquinolone:['ciprofloxacin', 'levofloxacin', 'ofloxacin', 'norfloxacin', 'moxifloxacin', 'gatifloxacin'],
  cephalosporin:  ['cephalexin', 'cefazolin', 'ceftriaxone', 'cefuroxime', 'cefpodoxime',
                   'cefixime', 'cefdinir', 'cefaclor', 'cefotaxime', 'cefoperazone'],
  macrolide:      ['azithromycin', 'clarithromycin', 'erythromycin', 'roxithromycin'],
  aminoglycoside: ['gentamicin', 'amikacin', 'tobramycin', 'streptomycin', 'neomycin'],
  statin:         ['atorvastatin', 'rosuvastatin', 'simvastatin', 'lovastatin', 'pravastatin', 'fluvastatin'],
}

function getAllergyWarning(medicineName, allergies) {
  if (!medicineName.trim() || !allergies.length) return null
  const med = medicineName.trim().toLowerCase()

  // 1. Direct match — medicine name contains the allergy keyword or vice versa
  for (const allergy of allergies) {
    const key = allergy.title.trim().toLowerCase()
    if (!key) continue
    if (med.includes(key) || key.includes(med)) {
      return { allergy, type: 'direct' }
    }
  }

  // 2. Cross-reaction — check if any allergy maps to this medicine
  for (const allergy of allergies) {
    const key = allergy.title.trim().toLowerCase()
    const crossList = CROSS_REACTIONS[key] ?? []
    for (const crossMed of crossList) {
      if (med.includes(crossMed) || crossMed.includes(med.split(' ')[0])) {
        return { allergy, type: 'cross', crossMed }
      }
    }
  }

  return null
}

/**
 * Controlled medicine list editor.
 * Props:
 *   items      — array of medicine item objects (each has _key + fields)
 *   onChange   — called with the updated items array on every change
 *   itemErrors — optional array of per-item field error objects
 *   allergies  — patient allergy list from medical history (optional)
 */
export default function MedicineEditor({ items, onChange, itemErrors, allergies = [] }) {
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
            const allergyWarn = getAllergyWarning(item.medicine_name, allergies)
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

                    {/* Allergy / cross-reaction warning */}
                    {allergyWarn && (
                      <div className={`med-allergy-warn med-allergy-warn--${allergyWarn.type}`}>
                        <span className="med-allergy-warn-icon">
                          {allergyWarn.type === 'direct' ? '🚫' : '⚠️'}
                        </span>
                        <span>
                          {allergyWarn.type === 'direct'
                            ? <>Patient is <strong>allergic to {allergyWarn.allergy.title}</strong>{allergyWarn.allergy.severity ? ` (${allergyWarn.allergy.severity})` : ''}. Do not prescribe without review.</>
                            : <>Cross-reaction risk — patient is allergic to <strong>{allergyWarn.allergy.title}</strong>{allergyWarn.allergy.severity ? ` (${allergyWarn.allergy.severity})` : ''}. Verify safety before prescribing.</>
                          }
                        </span>
                      </div>
                    )}
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
