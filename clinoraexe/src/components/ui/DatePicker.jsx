import { useState, useRef, useEffect } from 'react'
import '../../styles/datepicker.css'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

function formatDisplay(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

function buildCellStr(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

export default function DatePicker({
  value = '',
  onChange,
  minDate = '',
  maxDate = '2099-12-31',
  placeholder = 'Select date',
  disabled = false,
}) {
  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const initYear  = isValid ? parseInt(value.slice(0,4)) : new Date().getFullYear()
  const initMonth = isValid ? parseInt(value.slice(5,7)) - 1 : new Date().getMonth()

  const [open,      setOpen]      = useState(false)
  const [viewYear,  setViewYear]  = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    if (open && isValid) {
      setViewYear(parseInt(value.slice(0,4)))
      setViewMonth(parseInt(value.slice(5,7)) - 1)
    }
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day) {
    const str = buildCellStr(viewYear, viewMonth, day)
    if (minDate && str < minDate) return
    if (maxDate && str > maxDate) return
    onChange(str)
    setOpen(false)
  }

  const today = todayStr()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const canPrev = !minDate || buildCellStr(viewYear, viewMonth, 1) > minDate.slice(0, 7) + '-01'
  const canNext = !maxDate || buildCellStr(viewYear, viewMonth, daysInMonth) < maxDate

  const years = Array.from({ length: 100 }, (_, i) => 2000 + i)

  return (
    <div className="dp-wrap" ref={ref}>
      <button
        type="button"
        className={`dp-trigger${open ? ' dp-trigger--open' : ''}${disabled ? ' dp-trigger--disabled' : ''}`}
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
      >
        <svg className="dp-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={value ? 'dp-val' : 'dp-ph'}>{value ? formatDisplay(value) : placeholder}</span>
        <svg className="dp-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="dp-popup">
          <div className="dp-nav">
            <button type="button" className="dp-nav-btn" onClick={prevMonth} disabled={!canPrev}>‹</button>
            <div className="dp-mv">
              <span className="dp-mn">{MONTH_NAMES[viewMonth]}</span>
              <select
                className="dp-yr"
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" className="dp-nav-btn" onClick={nextMonth} disabled={!canNext}>›</button>
          </div>

          <div className="dp-dow-row">
            {DOW.map(d => <span key={d} className="dp-dow">{d}</span>)}
          </div>

          <div className="dp-grid">
            {cells.map((day, i) => {
              if (day === null) return <span key={i} className="dp-cell dp-cell--blank" />
              const str    = buildCellStr(viewYear, viewMonth, day)
              const isSel  = str === value
              const isTod  = str === today
              const isDis  = (minDate && str < minDate) || (maxDate && str > maxDate)
              return (
                <button
                  key={i}
                  type="button"
                  className={`dp-cell dp-cell--day${isSel ? ' dp-cell--sel' : ''}${isTod && !isSel ? ' dp-cell--today' : ''}${isDis ? ' dp-cell--dis' : ''}`}
                  disabled={isDis}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {value && (
            <button type="button" className="dp-clear" onClick={() => { onChange(''); setOpen(false) }}>
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
