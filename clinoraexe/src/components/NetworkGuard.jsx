import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../styles/network-guard.css'

const POLL_INTERVAL   = 5000  // check every 5s while offline
const RETRY_COUNTDOWN = 5     // countdown seconds shown on screen

export default function NetworkGuard({ children }) {
  const [offline, setOffline]       = useState(false)
  const [countdown, setCountdown]   = useState(RETRY_COUNTDOWN)
  const [checking, setChecking]     = useState(false)
  const pollRef    = useRef(null)
  const countRef   = useRef(null)

  // Ping the DB — returns true if reachable
  const ping = useCallback(async () => {
    try {
      await invoke('ping_db')
      return true
    } catch {
      return false
    }
  }, [])

  const goOnline = useCallback(() => {
    setOffline(false)
    setChecking(false)
    clearInterval(pollRef.current)
    clearInterval(countRef.current)
  }, [])

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current)
    clearInterval(countRef.current)

    setCountdown(RETRY_COUNTDOWN)

    // Countdown display
    countRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return RETRY_COUNTDOWN
        return c - 1
      })
    }, 1000)

    // Actual ping loop
    pollRef.current = setInterval(async () => {
      const ok = await ping()
      if (ok) goOnline()
    }, POLL_INTERVAL)
  }, [ping, goOnline])

  const goOffline = useCallback(() => {
    setOffline(true)
    startPolling()
  }, [startPolling])

  // Manual retry
  const handleRetry = useCallback(async () => {
    setChecking(true)
    const ok = await ping()
    if (ok) {
      goOnline()
    } else {
      setChecking(false)
      setCountdown(RETRY_COUNTDOWN)
    }
  }, [ping, goOnline])

  // Listen for DB errors dispatched by safeInvoke
  useEffect(() => {
    const onDbError = () => {
      if (!offline) goOffline()
    }
    window.addEventListener('clinora:db-error', onDbError)
    return () => window.removeEventListener('clinora:db-error', onDbError)
  }, [offline, goOffline])

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(pollRef.current)
    clearInterval(countRef.current)
  }, [])

  if (!offline) return children

  return (
    <>
      {children}
      <div className="ng-overlay">
        <div className="ng-card">
          <div className="ng-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>

          <h2 className="ng-title">Connection Lost</h2>
          <p className="ng-msg">
            Cannot reach the database on the doctor's PC.<br />
            Make sure both PCs are on the same network.
          </p>

          <div className="ng-tips">
            <span>Check that Doctor's PC is turned on</span>
            <span>Both PCs on the same WiFi / LAN</span>
            <span>MySQL is running on Doctor's PC</span>
          </div>

          <button
            className="ng-retry-btn"
            onClick={handleRetry}
            disabled={checking}
          >
            {checking ? (
              <><span className="ng-btn-spinner" /> Checking…</>
            ) : (
              <>Retry Now</>
            )}
          </button>

          <p className="ng-auto">
            Auto-retrying in <strong>{countdown}s</strong>
          </p>
        </div>
      </div>
    </>
  )
}
