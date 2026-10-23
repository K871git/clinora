/**
 * All datetime strings from the Rust/MySQL backend are UTC but arrive
 * without a 'Z' suffix (e.g. "2026-09-17T05:00:00"). Appending 'Z'
 * before constructing a Date object tells JavaScript to treat the value
 * as UTC and convert to the local timezone for display.
 */
function parseUtc(iso) {
  if (!iso) return null
  if (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso)
  return new Date(iso + 'Z')
}

export function fmtDateTime(iso) {
  const d = parseUtc(iso)
  if (!d) return '—'
  return d.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtDate(iso) {
  const d = parseUtc(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function fmtDateShort(iso) {
  const d = parseUtc(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function fmtTime(iso) {
  const d = parseUtc(iso)
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDateParts(iso) {
  const d = parseUtc(iso)
  if (!d) return { dd: '', mm: '', yyyy: '' }
  return {
    dd:   String(d.getDate()).padStart(2, '0'),
    mm:   String(d.getMonth() + 1).padStart(2, '0'),
    yyyy: String(d.getFullYear()),
  }
}

export function ageFromIso(iso) {
  const d = parseUtc(iso)
  if (!d) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export function relativeTime(iso) {
  const d = parseUtc(iso)
  if (!d) return ''
  const ms   = Date.now() - d.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)} days ago`
}

export function isUrgent(iso, thresholdMs = 10 * 60 * 1000) {
  const d = parseUtc(iso)
  if (!d) return false
  return (Date.now() - d.getTime()) > thresholdMs
}
