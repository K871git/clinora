import '../../styles/medicines-page.css'
import { useState, useEffect, useRef, forwardRef } from 'react'
import { searchMedicines } from '../../services/medicineService'

function parseLocalDate(str) {
  if (!str) return null
  const [y, m, d] = str.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function MedBadges({ med }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const qty   = med.quantity ?? null
  const exp   = parseLocalDate(med.expiry_date)

  const isExpired  = exp && exp < today
  const expSoon    = exp && !isExpired && (exp - today) / 86400000 <= 30
  const outOfStock = qty !== null && qty === 0 && !isExpired
  const lowStock   = qty !== null && qty > 0 && qty < 10 && !isExpired

  if (!isExpired && !expSoon && !outOfStock && !lowStock) return null

  const expLabel = exp
    ? exp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
    : ''

  return (
    <span className="mc-badges">
      {isExpired   && <span className="mc-badge mc-badge--danger">Expired</span>}
      {expSoon     && <span className="mc-badge mc-badge--warn">Exp {expLabel}</span>}
      {outOfStock  && <span className="mc-badge mc-badge--danger">Out of stock</span>}
      {lowStock    && <span className="mc-badge mc-badge--warn">{qty} left</span>}
    </span>
  )
}

const MedicineCombobox = forwardRef(function MedicineCombobox(
  { value, onChange, hasError, placeholder },
  fwdRef,
) {
  const [query,      setQuery]      = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open,       setOpen]       = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const debounceRef = useRef(null)

  /* Sync internal query when parent resets the value (e.g. new item) */
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  /* Combine forwarded ref with our internal input tracking */
  function refCallback(el) {
    if (typeof fwdRef === 'function') fwdRef(el)
    else if (fwdRef) fwdRef.current = el
  }

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    onChange(val)

    clearTimeout(debounceRef.current)

    if (val.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      searchMedicines(val, 12)
        .then(({ data }) => {
          setSuggestions(data.data || [])
          setOpen(true)
          setFocusedIdx(-1)
        })
        .catch(() => {})
    }, 250)
  }

  function handleSelect(medicine) {
    setQuery(medicine.name)
    onChange(medicine.name)
    setSuggestions([])
    setOpen(false)
    setFocusedIdx(-1)
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      handleSelect(suggestions[focusedIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setFocusedIdx(-1)
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false)
      setFocusedIdx(-1)
    }, 150)
  }

  return (
    <div className="mc-wrap">
      <input
        ref={refCallback}
        type="text"
        className={`field${hasError ? ' has-error' : ''}`}
        placeholder={placeholder ?? 'e.g. Paracetamol 500mg'}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <ul className="mc-dropdown" role="listbox">
          {suggestions.map((med, idx) => (
            <li
              key={med.id}
              role="option"
              aria-selected={idx === focusedIdx}
              className={`mc-option${idx === focusedIdx ? ' mc-option--focused' : ''}`}
              onMouseDown={() => handleSelect(med)}
            >
              <span className="mc-option-name">{med.name}</span>
              {med.generic_name && (
                <span className="mc-option-generic">{med.generic_name}</span>
              )}
              <MedBadges med={med} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

export default MedicineCombobox
