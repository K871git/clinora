import { useEffect, useRef } from 'react'
import '../../styles/bg-shapes.css'

export default function BackgroundShapes({ pharmacy = false }) {
  const slowRef = useRef(null)
  const midRef  = useRef(null)
  const fastRef = useRef(null)

  useEffect(() => {
    let raf
    const onMove = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rx = e.clientX / window.innerWidth  - 0.5
        const ry = e.clientY / window.innerHeight - 0.5
        if (slowRef.current) slowRef.current.style.transform = `translate(${rx * 8}px,  ${ry * 5}px)`
        if (midRef.current)  midRef.current.style.transform  = `translate(${rx * 16}px, ${ry * 11}px)`
        if (fastRef.current) fastRef.current.style.transform = `translate(${rx * 26}px, ${ry * 18}px)`
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="bg-shapes" aria-hidden="true">

      {/* ── Ambient gradient blobs (no parallax) ─────────────────────────── */}
      <div className="bg-blob-layer">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
        {pharmacy && <div className="bg-blob bg-blob-4" />}
      </div>

      {/* ── SLOW layer — large hero shapes ───────────────────────────────── */}
      <div className="bg-layer" ref={slowRef}>

        {/* Massive dashed ring — bottom right, bleeds off edge */}
        <div style={{ position: 'absolute', bottom: '-22%', right: '-8%' }}>
          <svg className="bg-p" width="580" viewBox="0 0 580 580"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="18 13">
            <circle cx="290" cy="290" r="282" />
          </svg>
        </div>

        {/* Large pill — top right, tilted */}
        <div style={{ position: 'absolute', top: '2%', right: '2%', transform: 'rotate(22deg)' }}>
          <svg className="bg-p" width="360" viewBox="0 0 360 90"
            fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="2" y="2" width="356" height="86" rx="43" />
            <line x1="180" y1="5" x2="180" y2="85" strokeWidth="1.4" strokeOpacity="0.5" />
          </svg>
        </div>

        {/* Large solid ring (partial filled) — top left */}
        <div style={{ position: 'absolute', top: '-12%', left: '-8%' }}>
          <svg className="bg-g" width="440" viewBox="0 0 440 440"
            fill="none" stroke="currentColor" strokeWidth="22" strokeOpacity="0.18">
            <circle cx="220" cy="220" r="200" />
          </svg>
        </div>

        {/* ECG wave — lower left, large */}
        <div style={{ position: 'absolute', bottom: '14%', left: '4%' }}>
          <svg className="bg-g" width="400" viewBox="0 0 400 68"
            fill="none" stroke="currentColor" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="0,34 60,34 80,34 96,6 112,62 128,6 144,34 165,34 400,34" />
          </svg>
        </div>

        {/* Doctor: dashed large diamond — center left */}
        {!pharmacy && (
          <div style={{ position: 'absolute', top: '28%', left: '-4%', transform: 'rotate(12deg)' }}>
            <svg className="bg-p" width="280" viewBox="0 0 280 280"
              fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="10 8">
              <polygon points="140,10 270,140 140,270 10,140" />
            </svg>
          </div>
        )}

        {/* Pharmacy: large hexagon — top left */}
        {pharmacy && (
          <div style={{ position: 'absolute', top: '-8%', left: '-5%', transform: 'rotate(-6deg)' }}>
            <svg className="bg-p" width="300" viewBox="0 0 260 300"
              fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="14 10">
              <polygon points="130,12 242,72 242,222 130,282 18,222 18,72" />
            </svg>
          </div>
        )}

      </div>

      {/* ── MID layer — medium detail shapes ─────────────────────────────── */}
      <div className="bg-layer" ref={midRef}>

        {/* Filled medical cross — right */}
        <div style={{ position: 'absolute', top: '22%', right: '10%' }}>
          <svg className="bg-p" width="80" viewBox="0 0 80 80" fill="currentColor" fillOpacity="0.75">
            <rect x="28" y="4"  width="24" height="72" rx="5" />
            <rect x="4"  y="28" width="72" height="24" rx="5" />
          </svg>
        </div>

        {/* Large pill with fill — left mid */}
        <div style={{ position: 'absolute', top: '40%', left: '1%', transform: 'rotate(-18deg)' }}>
          <svg className="bg-p" width="160" viewBox="0 0 160 48" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="156" height="44" rx="22" />
            <rect x="2" y="2" width="80" height="44" rx="22" fill="currentColor" fillOpacity="0.12" />
            <line x1="80" y1="4" x2="80" y2="44" strokeWidth="1.4" strokeOpacity="0.45" />
          </svg>
        </div>

        {/* Medium dashed ring — upper center-right */}
        <div style={{ position: 'absolute', top: '8%', left: '52%' }}>
          <svg className="bg-g" width="180" viewBox="0 0 180 180"
            fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="10 8">
            <circle cx="90" cy="90" r="82" />
          </svg>
        </div>

        {/* Cell cluster — right bottom */}
        <div style={{ position: 'absolute', bottom: '22%', right: '6%' }}>
          <svg className="bg-g" width="130" viewBox="0 0 130 130"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="35"  cy="35"  r="28" />
            <circle cx="95"  cy="48"  r="20" />
            <circle cx="55"  cy="100" r="24" />
            <circle cx="35"  cy="35"  r="10" fill="currentColor" fillOpacity="0.10" />
            <circle cx="55"  cy="100" r="9"  fill="currentColor" fillOpacity="0.10" />
          </svg>
        </div>

        {/* Pharmacy: Rx bottle — far right */}
        {pharmacy && (
          <div style={{ position: 'absolute', top: '54%', right: '4%' }}>
            <svg className="bg-g" width="62" viewBox="0 0 62 96"
              fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="12" y="22" width="38" height="64" rx="7" />
              <rect x="16" y="10" width="30" height="14" rx="5" />
              <rect x="12" y="22" width="38" height="20" rx="7" fill="currentColor" fillOpacity="0.12" />
              <line x1="12" y1="42" x2="50" y2="42" strokeOpacity="0.4" />
              <line x1="18" y1="52" x2="44" y2="52" strokeOpacity="0.35" />
              <line x1="18" y1="60" x2="38" y2="60" strokeOpacity="0.35" />
            </svg>
          </div>
        )}

        {/* Doctor: stethoscope arc — bottom left area */}
        {!pharmacy && (
          <div style={{ position: 'absolute', bottom: '30%', left: '8%' }}>
            <svg className="bg-g" width="90" viewBox="0 0 90 100"
              fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M20,10 Q10,50 30,70 Q50,90 70,70" />
              <circle cx="70" cy="70" r="12" />
              <circle cx="70" cy="70" r="5" fill="currentColor" fillOpacity="0.3" />
              <circle cx="14" cy="10" r="5" />
              <circle cx="28" cy="10" r="5" />
            </svg>
          </div>
        )}

        {/* Pharmacy: molecule — left upper */}
        {pharmacy && (
          <div style={{ position: 'absolute', top: '18%', left: '8%' }}>
            <svg className="bg-g" width="110" viewBox="0 0 110 100"
              fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="20"  cy="60" r="13" />
              <circle cx="72"  cy="22" r="12" />
              <circle cx="90"  cy="76" r="10" />
              <circle cx="20"  cy="60" r="5"  fill="currentColor" fillOpacity="0.25" />
              <circle cx="72"  cy="22" r="5"  fill="currentColor" fillOpacity="0.25" />
              <line x1="33"  y1="56" x2="60"  y2="30" />
              <line x1="72"  y1="34" x2="80"  y2="66" />
              <line x1="33"  y1="65" x2="80"  y2="74" />
            </svg>
          </div>
        )}

      </div>

      {/* ── FAST layer — small scattered accent shapes ────────────────────── */}
      <div className="bg-layer" ref={fastRef}>

        {/* Small cross — lower left */}
        <div style={{ position: 'absolute', bottom: '36%', left: '14%' }}>
          <svg className="bg-p" width="36" viewBox="0 0 36 36" fill="currentColor">
            <rect x="14" y="2"  width="8" height="32" rx="2.5" />
            <rect x="2"  y="14" width="32" height="8"  rx="2.5" />
          </svg>
        </div>

        {/* Plus — upper left area */}
        <div style={{ position: 'absolute', top: '18%', left: '32%' }}>
          <svg className="bg-g" width="26" viewBox="0 0 26 26"
            fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M13 2v22M2 13h22" />
          </svg>
        </div>

        {/* Plus — right mid */}
        <div style={{ position: 'absolute', top: '58%', right: '24%' }}>
          <svg className="bg-p" width="30" viewBox="0 0 30 30"
            fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M15 2v26M2 15h26" />
          </svg>
        </div>

        {/* Small pill — bottom right */}
        <div style={{ position: 'absolute', bottom: '26%', right: '20%', transform: 'rotate(14deg)' }}>
          <svg className="bg-p" width="88" viewBox="0 0 88 28"
            fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="84" height="24" rx="12" />
            <rect x="2" y="2" width="44" height="24" rx="12" fill="currentColor" fillOpacity="0.14" />
            <line x1="44" y1="4" x2="44" y2="24" strokeWidth="1.2" strokeOpacity="0.4" />
          </svg>
        </div>

        {/* Cross — upper right area */}
        <div style={{ position: 'absolute', top: '12%', right: '32%' }}>
          <svg className="bg-g" width="22" viewBox="0 0 22 22" fill="currentColor">
            <rect x="8" y="1"  width="6" height="20" rx="2" />
            <rect x="1" y="8"  width="20" height="6"  rx="2" />
          </svg>
        </div>

        {/* Small cell circles — top left */}
        <div style={{ position: 'absolute', top: '44%', left: '2%' }}>
          <svg className="bg-g" width="80" viewBox="0 0 80 80"
            fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="22" cy="22" r="18" />
            <circle cx="60" cy="30" r="12" />
            <circle cx="36" cy="65" r="14" />
            <circle cx="22" cy="22" r="7"  fill="currentColor" fillOpacity="0.15" />
          </svg>
        </div>

        {/* Plus — bottom center */}
        <div style={{ position: 'absolute', bottom: '18%', left: '46%' }}>
          <svg className="bg-p" width="20" viewBox="0 0 20 20"
            fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M10 2v16M2 10h16" />
          </svg>
        </div>

        {/* Pharmacy: capsule — upper left tilt */}
        {pharmacy && (
          <div style={{ position: 'absolute', top: '30%', left: '16%', transform: 'rotate(38deg)' }}>
            <svg className="bg-p" width="72" viewBox="0 0 72 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="68" height="20" rx="10" />
              <rect x="2" y="2" width="36" height="20" rx="10" fill="currentColor" fillOpacity="0.14" />
              <line x1="36" y1="3" x2="36" y2="21" strokeWidth="1.2" strokeOpacity="0.4" />
            </svg>
          </div>
        )}

        {/* Pharmacy: molecule accent — bottom center */}
        {pharmacy && (
          <div style={{ position: 'absolute', bottom: '8%', left: '36%' }}>
            <svg className="bg-g" width="96" viewBox="0 0 96 84"
              fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="22"  cy="50" r="11" />
              <circle cx="66"  cy="22" r="10" />
              <circle cx="78"  cy="64" r="9" />
              <circle cx="22"  cy="50" r="4"  fill="currentColor" fillOpacity="0.28" />
              <circle cx="66"  cy="22" r="4"  fill="currentColor" fillOpacity="0.28" />
              <circle cx="78"  cy="64" r="4"  fill="currentColor" fillOpacity="0.28" />
              <line x1="33"  y1="46" x2="56"  y2="30" />
              <line x1="66"  y1="32" x2="72"  y2="55" />
              <line x1="33"  y1="56" x2="69"  y2="64" />
            </svg>
          </div>
        )}

        {/* Pharmacy: small hexagon — bottom right area */}
        {pharmacy && (
          <div style={{ position: 'absolute', bottom: '40%', right: '16%', transform: 'rotate(10deg)' }}>
            <svg className="bg-p" width="54" viewBox="0 0 60 70"
              fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="8 5">
              <polygon points="30,4 56,18 56,50 30,64 4,50 4,18" />
            </svg>
          </div>
        )}

      </div>
    </div>
  )
}
