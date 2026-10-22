import { useState, useCallback } from 'react'

/**
 * useState that persists to sessionStorage so filter/date/search state
 * survives navigation within the same app session. Clears on app restart.
 *
 * @param {string} key - Unique key, e.g. 'clinic:opd-date'
 * @param {*} initial  - Default value (or function returning it)
 */
export function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw)
    } catch {}
    return typeof initial === 'function' ? initial() : initial
  })

  const setSessionValue = useCallback((next) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      try { sessionStorage.setItem(key, JSON.stringify(resolved)) } catch {}
      return resolved
    })
  }, [key])

  return [value, setSessionValue]
}
