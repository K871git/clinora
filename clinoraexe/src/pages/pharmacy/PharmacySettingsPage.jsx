import { useState, useEffect } from 'react'
import { getSettings, updateClinicName } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function PharmacySettingsPage() {
  const [pageStatus, setPageStatus] = useState('loading')
  const [name,       setName]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)
  const [saved,      setSaved]      = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then(({ data }) => {
        if (!cancelled) {
          setName(data.clinic.name ?? '')
          setPageStatus('done')
        }
      })
      .catch(() => { if (!cancelled) setPageStatus('error') })
    return () => { cancelled = true }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Clinic name is required.'); return }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateClinicName(name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      const msg = err.response?.data?.errors?.name?.[0]
        ?? err.response?.data?.message
        ?? 'Could not save — try again.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (pageStatus === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spinner size={26} />
      </div>
    )
  }

  if (pageStatus === 'error') {
    return (
      <div className="card state-panel">
        Could not load settings — check your connection.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="card stg-card">
        <div className="stg-card-head">
          <div className="stg-card-title">Clinic Name</div>
          <p className="stg-card-desc">
            This name appears on pharmacy invoices and receipts.
          </p>
        </div>

        {error && (
          <div className="stg-alert stg-alert--error">{error}</div>
        )}

        <form onSubmit={handleSave}>
          <div className="stg-card-body">
            <div className="stg-field">
              <label className="stg-label">
                Clinic / Pharmacy Name
                <span className="stg-required" aria-hidden="true"> *</span>
              </label>
              <input
                className="stg-input"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setSaved(false); setError(null) }}
                placeholder="e.g. City Care Pharmacy"
                maxLength={150}
                disabled={saving}
              />
            </div>
          </div>

          <div className="stg-card-foot">
            {saved && (
              <span className="stg-saved-msg">
                <IconCheck />
                Saved
              </span>
            )}
            <button
              type="submit"
              className="stg-save-btn"
              disabled={saving || !name.trim()}
            >
              {saving ? <Spinner size={13} color="#fff" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
