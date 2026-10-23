import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../styles/setup-wizard.css'

const STEPS = { ROLE: 'role', CREDENTIALS: 'credentials', DONE: 'done' }

export default function SetupWizard() {
  const [step, setStep] = useState(STEPS.ROLE)
  const [role, setRole] = useState(null) // 'doctor' | 'pharmacist'
  const [form, setForm] = useState({ host: '127.0.0.1', port: '3306', username: 'root', password: '', database: 'clinoradb' })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | 'ok' | 'error'
  const [testMsg, setTestMsg] = useState('')
  const [saving, setSaving] = useState(false)

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setTestResult(null)
  }

  function buildUrl() {
    const { host, port, username, password, database } = form
    const user = encodeURIComponent(username)
    const pass = encodeURIComponent(password)
    return `mysql://${user}:${pass}@${host}:${port}/${database}`
  }

  function pickRole(r) {
    setRole(r)
    setForm(f => ({ ...f, host: r === 'doctor' ? '127.0.0.1' : '' }))
    setTestResult(null)
    setStep(STEPS.CREDENTIALS)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setTestMsg('')
    try {
      await invoke('test_db_connection', { dbUrl: buildUrl() })
      setTestResult('ok')
      setTestMsg('Connection successful!')
    } catch (err) {
      setTestResult('error')
      setTestMsg(typeof err === 'string' ? err : 'Connection failed.')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await invoke('save_setup_config', { dbUrl: buildUrl(), role })
      setStep(STEPS.DONE)
      setTimeout(() => invoke('restart_app'), 1500)
    } catch (err) {
      setTestResult('error')
      setTestMsg(typeof err === 'string' ? err : 'Failed to save config.')
    } finally {
      setSaving(false)
    }
  }

  const portNum = parseInt(form.port, 10)
  const portValid = form.port && !isNaN(portNum) && portNum >= 1 && portNum <= 65535
  const canTest = form.host.trim() && portValid && form.username.trim() && form.password.trim() && form.database.trim()

  return (
    <div className="sw-overlay">
      <div className="sw-card">
        <div className="sw-logo">
          <img src="/logos/logo1.png" alt="Clinora" />
        </div>
        <h1 className="sw-title">Clinora Setup</h1>

        {step === STEPS.ROLE && (
          <>
            <p className="sw-subtitle">Select the role of this PC</p>
            <div className="sw-roles">
              <button className="sw-role-btn" onClick={() => pickRole('doctor')}>
                <span className="sw-role-icon">🏥</span>
                <span className="sw-role-name">Doctor's PC</span>
                <span className="sw-role-desc">Main PC — runs MySQL database</span>
              </button>
              <button className="sw-role-btn" onClick={() => pickRole('pharmacist')}>
                <span className="sw-role-icon">💊</span>
                <span className="sw-role-name">Pharmacist's PC</span>
                <span className="sw-role-desc">Connects to Doctor's PC over LAN</span>
              </button>
            </div>
          </>
        )}

        {step === STEPS.CREDENTIALS && (
          <>
            <p className="sw-subtitle">
              {role === 'doctor' ? 'Enter your MySQL credentials' : "Enter Doctor's PC MySQL credentials"}
            </p>

            {role === 'pharmacist' && (
              <div className="sw-info-box">
                <strong>How to find Doctor's PC IP:</strong><br />
                On Doctor's PC → open Command Prompt → type <code>ipconfig</code> → look for IPv4 Address (e.g. 192.168.1.5)
              </div>
            )}

            <div className="sw-form">
              <div className="sw-row">
                <div className="sw-field sw-field--wide">
                  <label>
                    {role === 'doctor' ? 'Host' : "Doctor's PC IP Address"}
                  </label>
                  <input
                    value={form.host}
                    onChange={e => set('host', e.target.value)}
                    placeholder={role === 'doctor' ? '127.0.0.1' : '192.168.1.5'}
                    readOnly={role === 'doctor'}
                    className={role === 'doctor' ? 'sw-input sw-input--readonly' : 'sw-input'}
                  />
                </div>
                <div className="sw-field sw-field--narrow">
                  <label>Port</label>
                  <input
                    value={form.port}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 5)
                      set('port', v)
                    }}
                    className="sw-input"
                    placeholder="3306"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="sw-field">
                <label>MySQL Username</label>
                <input
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  className="sw-input"
                  placeholder="root"
                  autoComplete="off"
                />
              </div>

              <div className="sw-field">
                <label>MySQL Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className="sw-input"
                  placeholder="Enter MySQL password"
                  autoComplete="new-password"
                />
              </div>

              <div className="sw-field">
                <label>Database Name</label>
                <input
                  value={form.database}
                  onChange={e => set('database', e.target.value)}
                  className="sw-input sw-input--readonly"
                  readOnly
                />
              </div>

              {testResult && (
                <div className={`sw-result sw-result--${testResult}`}>
                  {testResult === 'ok' ? '✓' : '✗'} {testMsg}
                </div>
              )}

              {role === 'pharmacist' && testResult !== 'ok' && (
                <div className="sw-info-box sw-info-box--warn">
                  <strong>Before connecting:</strong> On Doctor's PC, MySQL must allow remote connections. Ask your IT person or run Clinora's Doctor setup first.
                </div>
              )}

              <div className="sw-actions">
                <button className="sw-btn sw-btn--ghost" onClick={() => { setStep(STEPS.ROLE); setTestResult(null) }}>
                  ← Back
                </button>
                <button
                  className="sw-btn sw-btn--secondary"
                  onClick={handleTest}
                  disabled={!canTest || testing}
                >
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
                <button
                  className="sw-btn sw-btn--primary"
                  onClick={handleSave}
                  disabled={testResult !== 'ok' || saving}
                >
                  {saving ? 'Saving…' : 'Save & Continue →'}
                </button>
              </div>
            </div>
          </>
        )}

        {step === STEPS.DONE && (
          <div className="sw-done">
            <div className="sw-done-icon">✓</div>
            <p>Setup complete! Restarting Clinora…</p>
          </div>
        )}
      </div>
    </div>
  )
}
