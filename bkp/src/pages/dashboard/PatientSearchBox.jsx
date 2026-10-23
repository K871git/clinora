import { useState, useRef, useEffect, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchPatients } from '../../services/patientService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/dashboard.css'

const PatientSearchBox = forwardRef(function PatientSearchBox({ onRegister }, inputRef) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const debounceRef = useRef(null)  // timeout handle
  const activeRef = useRef(true)    // false when the last request was cancelled

  const [query, setQuery] = useState('')
  // status: idle | loading | done | error
  const [search, setSearch] = useState({ results: [], status: 'idle' })

  /* Close dropdown when clicking outside — no setState in effect body */
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        clearSearch()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      clearTimeout(debounceRef.current)
      activeRef.current = false
    }
  }, [])

  /* All state updates happen in event handlers or async callbacks — never in an effect body */
  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    activeRef.current = false // cancel any in-flight request

    if (!val.trim()) {
      setSearch({ results: [], status: 'idle' })
      return
    }

    setSearch({ results: [], status: 'loading' })
    activeRef.current = true

    debounceRef.current = setTimeout(() => {
      searchPatients(val.trim())
        .then(({ data }) => {
          if (activeRef.current) setSearch({ results: data.data ?? [], status: 'done' })
        })
        .catch(() => {
          if (activeRef.current) setSearch({ results: [], status: 'error' })
        })
    }, 300)
  }

  function clearSearch() {
    clearTimeout(debounceRef.current)
    activeRef.current = false
    setQuery('')
    setSearch({ results: [], status: 'idle' })
  }

  function handleSelect(patient) {
    clearSearch()
    navigate(`/patients/${patient.id}`)
  }

  function handleRegister() {
    clearSearch()
    onRegister()
  }

  const { results, status } = search
  const hasQuery = query.trim().length > 0
  const showDropdown = hasQuery && status !== 'idle'
  const noResults = status === 'done' && results.length === 0

  return (
    <div ref={containerRef} className="search-wrap">
      {/* Input */}
      <div className="search-input-wrap">
        <span className="search-icon" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          ref={inputRef}
          className="field search-input"
          aria-label="Search patients"
          type="search"
          placeholder="Search by patient name or contact number… (press / to focus)"
          autoComplete="off"
          value={query}
          onChange={handleQueryChange}
        />
        {status === 'loading' && (
          <span className="search-spinner" aria-label="Searching">
            <Spinner size={18} />
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="search-dropdown" role="listbox">
          {status === 'error' && (
            <div className="search-drop-state">Search unavailable — check your connection.</div>
          )}

          {status === 'loading' && (
            <div className="search-drop-state">Searching…</div>
          )}

          {results.map((patient) => (
            <button
              key={patient.id}
              className="search-result-item"
              role="option"
              onClick={() => handleSelect(patient)}
            >
              <div className="search-result-avatar">{(patient.name?.[0] ?? '?').toUpperCase()}</div>
              <div className="search-result-body">
                <div className="search-result-name">{patient.name}</div>
                <div className="search-result-sub">{patient.mobile ?? 'No contact on file'}</div>
              </div>
              <span className="search-result-arrow" aria-hidden="true">→</span>
            </button>
          ))}

          {noResults && (
            <div className="search-drop-empty">
              <div>
                <div className="search-drop-empty-label">
                  No patient found for <strong>"{query.trim()}"</strong>
                </div>
                <div className="search-drop-empty-sub">Not in the system yet?</div>
              </div>
              <button className="btn-link" onClick={handleRegister}>
                Register new patient →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hint below input — visible when the dropdown is closed */}
      {!showDropdown && (
        <p className="search-hint">
          Patient not in the system?{' '}
          <button className="btn-link" onClick={handleRegister}>Register new patient</button>
        </p>
      )}
    </div>
  )
});

export default PatientSearchBox

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M12.5 12.5l3 3" />
    </svg>
  )
}
