import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../styles/license-gate.css'

export default function LicenseGate({ children }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'unlicensed' | 'licensed'
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    invoke('get_license_status')
      .then(res => setStatus(res.licensed ? 'licensed' : 'unlicensed'))
      .catch(() => setStatus('unlicensed'))
  }, [])

  async function handleActivate(e) {
    e.preventDefault()
    if (!key.trim()) return
    setError('')
    setLoading(true)
    try {
      await invoke('activate_license', { key: key.trim() })
      setSuccess(true)
      setTimeout(() => setStatus('licensed'), 1500)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Invalid license key.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'checking') {
    return (
      <div className="lg-overlay">
        <div className="lg-spinner" />
      </div>
    )
  }

  if (status === 'licensed') return children

  return (
    <div className="lg-overlay">
      <div className="lg-card">
        <div className="lg-logo">
          <img src="/logos/logo1.png" alt="Clinora" />
        </div>
        <h1 className="lg-title">Clinora</h1>
        <p className="lg-subtitle">Enter your license key to activate</p>

        {success ? (
          <div className="lg-success">
            <span className="lg-success-icon">✓</span>
            Activated successfully! Starting…
          </div>
        ) : (
          <form onSubmit={handleActivate} className="lg-form">
            <input
              className={`lg-input${error ? ' lg-input--error' : ''}`}
              type="text"
              placeholder="Paste your license key here"
              value={key}
              onChange={e => { setKey(e.target.value); setError('') }}
              spellCheck={false}
              autoComplete="off"
              disabled={loading}
            />
            {error && <p className="lg-error">{error}</p>}
            <button
              className="lg-btn"
              type="submit"
              disabled={loading || !key.trim()}
            >
              {loading ? 'Activating…' : 'Activate'}
            </button>
          </form>
        )}

        <p className="lg-footer">
          Need a license key? Contact your Clinora provider.
        </p>
      </div>
    </div>
  )
}
