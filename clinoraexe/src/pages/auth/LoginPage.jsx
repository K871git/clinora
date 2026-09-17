import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { useAuth } from '../../hooks/useAuth'
import Spinner from '../../components/ui/Spinner'
import PharmacyLoader from '../../components/ui/PharmacyLoader'
import DoctorLoader from '../../components/ui/DoctorLoader'
import { quotes } from '../../data/quotes'
import '../../styles/login.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

function getDayStr() {
  const now   = new Date()
  const day   = now.toLocaleDateString('en-US', { weekday: 'long' })
  const date  = now.getDate()
  const month = now.toLocaleDateString('en-US', { month: 'long' })
  return `${day} · ${date} ${month} ${now.getFullYear()}`
}

function randomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)]
}

/* ── Scene decorations ───────────────────────────────────────────────── */

function SunDeco() {
  return (
    <svg className="login-deco login-deco-sun" width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
      <circle cx="130" cy="130" r="124" fill="#fef08a" opacity="0.18" />
      <circle cx="130" cy="130" r="90"  fill="#fde68a" opacity="0.45" />
      <circle cx="130" cy="130" r="62"  fill="#fcd34d" opacity="0.80" />
    </svg>
  )
}

function CloudsDeco() {
  return (
    <svg className="login-deco login-deco-clouds" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ellipse cx="160" cy="80"  rx="100" ry="40" fill="white" opacity="0.82" />
      <ellipse cx="96"  cy="100" rx="64"  ry="32" fill="white" opacity="0.82" />
      <ellipse cx="224" cy="100" rx="68"  ry="30" fill="white" opacity="0.82" />
      <ellipse cx="820" cy="62"  rx="82"  ry="34" fill="white" opacity="0.72" />
      <ellipse cx="756" cy="78"  rx="54"  ry="26" fill="white" opacity="0.72" />
      <ellipse cx="884" cy="78"  rx="56"  ry="24" fill="white" opacity="0.72" />
      <ellipse cx="520" cy="40"  rx="56"  ry="22" fill="white" opacity="0.55" />
      <ellipse cx="472" cy="54"  rx="36"  ry="18" fill="white" opacity="0.55" />
      <ellipse cx="568" cy="54"  rx="38"  ry="17" fill="white" opacity="0.55" />
    </svg>
  )
}

function StarsDeco() {
  const S = [
    [6,4,0],[19,11,1],[34,3,0],[51,14,1],[67,5,0],[83,10,1],[97,2,0],
    [11,24,1],[27,20,0],[45,28,0],[63,18,1],[79,25,0],[94,14,1],
    [5,42,0],[21,38,1],[40,46,0],[58,35,1],[74,43,0],[90,32,0],
    [13,58,1],[31,54,0],[52,61,1],[69,55,0],[86,50,1],[98,62,0],
    [8,74,0],[27,70,1],[48,77,0],[66,72,1],[84,68,0],[96,78,1],
  ]
  return (
    <svg className="login-deco login-deco-stars" viewBox="0 0 100 85" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {S.map(([x, y, bright], i) => (
        <circle key={i} cx={x} cy={y}
          r={bright ? 0.28 : 0.14}
          fill={bright ? '#fffde8' : 'white'}
          opacity={bright ? 0.85 : 0.5}
          className={bright ? 'star-bright' : undefined}
          style={bright ? { animationDelay: `${((i * 0.47) % 3).toFixed(2)}s` } : undefined}
        />
      ))}
    </svg>
  )
}

function BirdsDeco() {
  return (
    <>
      {/* Each wing is wrapped in <g> so transform-origin can be pinned to the center join in SVG units */}
      <svg className="login-bird login-bird-1" width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
        <g className="bird-wing-l" style={{ transformOrigin: '10px 5px' }}>
          <path strokeWidth="1.2" stroke="rgba(30,58,138,0.32)" fill="none" d="M0,7 Q5,0 10,5" />
        </g>
        <g className="bird-wing-r" style={{ transformOrigin: '10px 5px' }}>
          <path strokeWidth="1.2" stroke="rgba(30,58,138,0.32)" fill="none" d="M10,5 Q15,0 20,7" />
        </g>
      </svg>
      <svg className="login-bird login-bird-2" width="15" height="8" viewBox="0 0 15 8" aria-hidden="true">
        <g className="bird-wing-l" style={{ transformOrigin: '7.5px 3.5px' }}>
          <path strokeWidth="1.1" stroke="rgba(30,58,138,0.32)" fill="none" d="M0,5.5 Q3.75,0 7.5,3.5" />
        </g>
        <g className="bird-wing-r" style={{ transformOrigin: '7.5px 3.5px' }}>
          <path strokeWidth="1.1" stroke="rgba(30,58,138,0.32)" fill="none" d="M7.5,3.5 Q11.25,0 15,5.5" />
        </g>
      </svg>
      <svg className="login-bird login-bird-3" width="11" height="6" viewBox="0 0 11 6" aria-hidden="true">
        <g className="bird-wing-l" style={{ transformOrigin: '5.5px 2.5px' }}>
          <path strokeWidth="1.0" stroke="rgba(30,58,138,0.32)" fill="none" d="M0,4 Q2.75,0 5.5,2.5" />
        </g>
        <g className="bird-wing-r" style={{ transformOrigin: '5.5px 2.5px' }}>
          <path strokeWidth="1.0" stroke="rgba(30,58,138,0.32)" fill="none" d="M5.5,2.5 Q8.25,0 11,4" />
        </g>
      </svg>
      <svg className="login-bird login-bird-4" width="9" height="5" viewBox="0 0 9 5" aria-hidden="true">
        <g className="bird-wing-l" style={{ transformOrigin: '4.5px 2px' }}>
          <path strokeWidth="0.9" stroke="rgba(30,58,138,0.32)" fill="none" d="M0,3.5 Q2.25,0 4.5,2" />
        </g>
        <g className="bird-wing-r" style={{ transformOrigin: '4.5px 2px' }}>
          <path strokeWidth="0.9" stroke="rgba(30,58,138,0.32)" fill="none" d="M4.5,2 Q6.75,0 9,3.5" />
        </g>
      </svg>
    </>
  )
}

function MoonDeco() {
  return (
    <svg className="login-deco login-deco-moon" width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
      <defs>
        <mask id="moon-mask">
          <rect width="110" height="110" fill="white" />
          <circle cx="72" cy="38" r="36" fill="black" />
        </mask>
      </defs>
      <circle cx="52" cy="52" r="50" fill="#a5b4fc" opacity="0.06" />
      <circle cx="52" cy="52" r="32" fill="#e0e7ff" mask="url(#moon-mask)" opacity="0.92" />
    </svg>
  )
}

/* ── Pharmacy decorations (streamlined — 2 pills, 2 crosses) ─────────── */

function PillsDeco() {
  return (
    <>
      <svg className="login-deco login-pill login-pill-1" width="56" height="22" viewBox="0 0 56 22" aria-hidden="true">
        <rect x="0" y="0" width="56" height="22" rx="11" fill="rgba(20,184,166,0.28)" />
        <path d="M28,0 L45,0 Q56,0 56,11 Q56,22 45,22 L28,22 Z" fill="rgba(20,184,166,0.18)" />
        <line x1="28" y1="2" x2="28" y2="20" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
      </svg>
      <svg className="login-deco login-pill login-pill-2" width="44" height="18" viewBox="0 0 44 18" aria-hidden="true">
        <rect x="0" y="0" width="44" height="18" rx="9" fill="rgba(16,185,129,0.24)" />
        <path d="M22,0 L35,0 Q44,0 44,9 Q44,18 35,18 L22,18 Z" fill="rgba(16,185,129,0.14)" />
        <line x1="22" y1="1.5" x2="22" y2="16.5" stroke="rgba(255,255,255,0.38)" strokeWidth="0.7" />
      </svg>
    </>
  )
}

function CrossesDeco() {
  return (
    <>
      <svg className="login-deco login-cross-deco login-cross-1" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="12" y="0" width="8" height="32" rx="3" fill="rgba(20,184,166,0.35)" />
        <rect x="0" y="12" width="32" height="8" rx="3" fill="rgba(20,184,166,0.35)" />
      </svg>
      <svg className="login-deco login-cross-deco login-cross-2" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="8" y="0" width="6" height="22" rx="2.5" fill="rgba(16,185,129,0.3)" />
        <rect x="0" y="8" width="22" height="6" rx="2.5" fill="rgba(16,185,129,0.3)" />
      </svg>
    </>
  )
}

/* ── Brand panel illustrations ───────────────────────────────────────── */

function IlloDoctor() {
  return (
    <svg width="120" height="130" viewBox="0 0 120 130" fill="none" aria-hidden="true">
      <circle cx="28" cy="22" r="8" fill="rgba(255,255,255,0.90)" />
      <circle cx="92" cy="22" r="8" fill="rgba(255,255,255,0.90)" />
      <path d="M28 30 C28 52 28 62 60 64 C92 62 92 52 92 30"
        stroke="rgba(255,255,255,0.80)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M60 64 L60 92"
        stroke="rgba(255,255,255,0.80)" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="60" cy="110" r="20"
        stroke="rgba(255,255,255,0.90)" strokeWidth="3"
        fill="rgba(255,255,255,0.10)" />
      <circle cx="60" cy="110" r="10" fill="rgba(255,255,255,0.22)" />
      <path d="M43 110 L50 110 L53 100 L57 120 L61 100 L65 110 L72 110 L78 110"
        stroke="rgba(255,255,255,0.92)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <animate attributeName="stroke-dasharray" from="0 130" to="130 0" dur="2s" begin="0s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

function IlloPharmacy() {
  return (
    <svg width="120" height="130" viewBox="0 0 120 130" fill="none" aria-hidden="true">
      <rect x="48" y="6" width="24" height="58" rx="12"
        fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.60)" strokeWidth="2.5" />
      <rect x="18" y="24" width="84" height="24" rx="12"
        fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.60)" strokeWidth="2.5" />
      <rect x="48" y="24" width="24" height="24" fill="rgba(255,255,255,0.20)" />
      <rect x="14" y="84" width="92" height="36" rx="18"
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.90)" strokeWidth="2.5" />
      <path d="M32,84 L60,84 L60,120 L32,120 Q14,120 14,102 Q14,84 32,84 Z"
        fill="rgba(255,255,255,0.28)" />
      <line x1="60" y1="84" x2="60" y2="120" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      <circle cx="80" cy="99" r="3" fill="rgba(255,255,255,0.38)" />
      <circle cx="90" cy="99" r="3" fill="rgba(255,255,255,0.38)" />
      <circle cx="100" cy="99" r="3" fill="rgba(255,255,255,0.38)" />
    </svg>
  )
}

/* ── Eye icons ───────────────────────────────────────────────────────── */

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/* ── Role icons ──────────────────────────────────────────────────────── */

function IconDoctor() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="5.5" r="3" />
      <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

function IconPharmacy() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="5" />
      <line x1="9" y1="4" x2="9" y2="14" />
      <line x1="2" y1="9" x2="9" y2="9" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function LoginPage() {
  const { login, token, user, loading } = useAuth()
  const navigate = useNavigate()

  const [isDark, setIsDark]           = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mounted, setMounted]         = useState(false)
  const [role, setRole]               = useState('doctor')
  const [greeting]                    = useState(() => getGreeting())
  const [dayStr]                      = useState(() => getDayStr())
  const [quote, setQuote]             = useState(randomQuote)
  const [clinicName, setClinicName]   = useState('Clinora')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [welcomeUser, setWelcomeUser] = useState(null)

  const [sessionExpired] = useState(() => {
    const flag = sessionStorage.getItem('session_expired')
    if (flag) sessionStorage.removeItem('session_expired')
    return flag
  })

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    invoke('get_public_clinic_name').then(n => setClinicName(n)).catch(() => {})
  }, [])

  useEffect(() => {
    setQuote(randomQuote())
    setError('')
  }, [role])

  if (!loading && user) {
    return <Navigate to={user.role === 'pharmacy' ? '/pharmacy' : '/'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const loggedInUser = await login(email, password, role)
      setWelcomeUser(loggedInUser)
      setSubmitting(false)
      setTimeout(() => navigate(loggedInUser.role === 'pharmacy' ? '/pharmacy' : '/', { replace: true }), 1800)
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || 'Something went wrong. Please try again.')
      setError(msg)
      setSubmitting(false)
    }
  }

  const canSubmit  = email.trim() && password && !submitting
  const isPharmacy = role === 'pharmacy'

  return (
    <div className={`login-scene${mounted ? ' login-scene--mounted' : ''}`} data-theme={isDark ? 'dark' : 'light'} data-role={role}>

      {/* Theme toggle */}
      <button className="login-theme-toggle" onClick={() => setIsDark(d => !d)}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      {/* Doctor scene */}
      <SunDeco />
      <CloudsDeco />
      <BirdsDeco />
      <StarsDeco />
      <MoonDeco />

      {/* Pharmacy scene */}
      <PillsDeco />
      <CrossesDeco />

      {/* Card */}
      <div className="login-card">

        {/* Left brand panel */}
        <div className={`login-brand${isPharmacy ? ' login-brand--pharmacy' : ''}`}>
          <div className="login-logo-wrap">
            <img src="/logos/clinoraLogo.png" alt="Clinora" className="login-logo-img" />
          </div>
          <div className="login-brand-text">
            <h1 className="login-title">Clinora</h1>
            <p className="login-subtitle">Medical Records &amp; Prescriptions</p>
          </div>

          <div className="login-brand-illo">
            <div className={`login-illo${!isPharmacy ? ' login-illo--visible' : ''}`}>
              <IlloDoctor />
            </div>
            <div className={`login-illo${isPharmacy ? ' login-illo--visible' : ''}`}>
              <IlloPharmacy />
            </div>
          </div>

          <div key={role + quote.text} className="login-brand-quote">
            <p className="login-brand-quote-text">"{quote.text}"</p>
            {quote.author && <span className="login-brand-quote-author">— {quote.author}</span>}
          </div>
        </div>

        {/* Right — greeting */}
        <div className="login-welcome">
          <p className="login-welcome-greeting">{greeting}</p>
          <h2 key={role} className={`login-welcome-role login-welcome-role--${role}`}>
            {isPharmacy ? 'Pharmacist' : 'Doctor'}
          </h2>
          <p className="login-day">{dayStr}</p>
        </div>

        {/* Right — form */}
        <form onSubmit={handleSubmit} noValidate className="login-form">

          {sessionExpired && (
            <div role="alert" className="form-alert warning">
              <p className="form-alert-body">
                {sessionExpired === 'inactivity'
                  ? 'Session expired after 2 hours of inactivity. Please sign in again.'
                  : 'Your session has ended. Please sign in again.'}
              </p>
            </div>
          )}

          <div className="login-role-bar">
            <button type="button"
              className={`login-role-btn login-role-btn--doctor${!isPharmacy ? ' login-role-btn--active' : ''}`}
              onClick={() => setRole('doctor')}>
              <IconDoctor /> Doctor
            </button>
            <button type="button"
              className={`login-role-btn login-role-btn--pharmacy${isPharmacy ? ' login-role-btn--active' : ''}`}
              onClick={() => setRole('pharmacy')}>
              <IconPharmacy /> Pharmacy
            </button>
          </div>

          <div className="field-group">
            <label htmlFor="email" className="field-label">Email</label>
            <div className="login-field-wrap">
              <svg className="login-field-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
              </svg>
              <input id="email" className="field login-field-padded" type="email" autoComplete="email"
                placeholder={isPharmacy ? 'pharmacy@clinic.com' : 'doctor@clinic.com'}
                required value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="password" className="field-label">Password</label>
            <div className="login-field-wrap" style={{ position: 'relative' }}>
              <svg className="login-field-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
              <input
                id="password"
                className="field login-field-padded"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={submitting}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
                className="login-eye-btn"
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="form-alert danger">
              <p className="form-alert-body">{error}</p>
            </div>
          )}

          <button type="submit" className={`login-submit-btn login-submit-btn--${role}`} disabled={!canSubmit}>
            {submitting && <Spinner size={16} />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

      </div>

      <p className="login-footer">
        <span className="login-footer-clinic">{clinicName}</span>
        {' '}· Offline Medical Records ·{' '}
        <a className="login-footer-link" href="https://k871git.github.io/thaelon" target="_blank" rel="noopener noreferrer">Thaelon</a>
      </p>

      {welcomeUser && welcomeUser.role === 'pharmacy' && (
        <PharmacyLoader
          message={`Welcome, ${welcomeUser.name.split(' ')[0]}`}
          sub="Rx Dispensary · Clinora"
          isDark={isDark}
        />
      )}
      {welcomeUser && welcomeUser.role !== 'pharmacy' && (
        <DoctorLoader
          message={`Welcome, Dr. ${welcomeUser.name.split(' ')[0]}`}
          sub="Clinora — Medical Records"
          isDark={isDark}
        />
      )}
    </div>
  )
}
