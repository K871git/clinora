import { invoke } from '@tauri-apps/api/core'

const DB_KEYWORDS = [
  'lost connection', 'server has gone away', 'pool timed out',
  'pooltimeout', 'error communicating with database',
  "can't connect to mysql", 'connection refused',
  'broken pipe', 'connection reset', 'network error',
  'no route to host', 'timed out', 'io error',
  'connection closed', 'eof', 'unable to connect',
]

function isDbError(msg) {
  const lower = msg.toLowerCase()
  return DB_KEYWORDS.some(k => lower.includes(k))
}

/**
 * Wraps invoke() to detect auth expiry and DB connection errors globally.
 * Dispatches custom window events so AppLayout / AuthContext can react.
 */
export async function safeInvoke(command, args) {
  try {
    return await invoke(command, args)
  } catch (err) {
    const msg = typeof err === 'string' ? err : (err?.message ?? '')
    if (msg.includes('Not authenticated')) {
      window.dispatchEvent(new CustomEvent('clinora:auth-expired'))
    } else if (isDbError(msg)) {
      window.dispatchEvent(new CustomEvent('clinora:db-error', { detail: msg }))
    }
    throw err
  }
}
