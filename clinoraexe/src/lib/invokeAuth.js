import { invoke } from '@tauri-apps/api/core'

/**
 * Wraps invoke() to detect "Not authenticated" errors globally.
 * Dispatches a 'clinora:auth-expired' window event so AuthContext
 * can log the user out immediately without touching every service file.
 */
export async function safeInvoke(command, args) {
  try {
    return await invoke(command, args)
  } catch (err) {
    const msg = typeof err === 'string' ? err : (err?.message ?? '')
    if (msg.includes('Not authenticated')) {
      window.dispatchEvent(new CustomEvent('clinora:auth-expired'))
    }
    throw err
  }
}
