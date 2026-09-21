import { useState, useEffect, useRef } from 'react'
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
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'long' })
  const date = now.getDate()
  const month = now.toLocaleDateString('en-US', { month: 'long' })
  return `${day} · ${date} ${month} ${now.getFullYear()}`
}

function randomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)]
}

/* ── Scene decorations ───────────────────────────────────────────────── */

function SunDeco() {
  const RAYS = Array.from({ length: 12 }, (_, i) => i)
  return (
    <svg className="login-deco login-deco-sun" width="280" height="280" viewBox="0 0 280 280" aria-hidden="true">
      <defs>
        <radialGradient id="drsun" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fffde0" stopOpacity="1"/>
          <stop offset="42%"  stopColor="#fde68a" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#fcd34d" stopOpacity="0.88"/>
        </radialGradient>
      </defs>
      {/* Atmosphere halos */}
      <circle cx="140" cy="140" r="136" fill="#fef08a" opacity="0.13"/>
      <circle cx="140" cy="140" r="106" fill="#fde68a" opacity="0.28"/>
      {/* Spinning rays */}
      <g className="dr-sun-rays" style={{ transformOrigin: '140px 140px' }}>
        {RAYS.map(i => (
          <rect key={i} x="137" y="10" width="6" height="28" rx="3"
            fill={`rgba(255,215,55,${i % 2 === 0 ? 0.44 : 0.26})`}
            transform={`rotate(${(360 / 12) * i} 140 140)`}/>
        ))}
      </g>
      {/* Sun body */}
      <circle cx="140" cy="140" r="70" fill="url(#drsun)"/>
      {/* Inner hot-spot */}
      <circle cx="132" cy="132" r="22" fill="#fffde7" opacity="0.42"/>
    </svg>
  )
}

function CloudsDeco() {
  return (
    <svg className="login-deco login-deco-clouds" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="cl-sh1" cx="50%" cy="90%" r="50%">
          <stop offset="0%" stopColor="rgba(140,160,200,0.28)"/>
          <stop offset="100%" stopColor="rgba(140,160,200,0)"/>
        </radialGradient>
        <radialGradient id="cl-sh2" cx="50%" cy="90%" r="50%">
          <stop offset="0%" stopColor="rgba(140,160,200,0.22)"/>
          <stop offset="100%" stopColor="rgba(140,160,200,0)"/>
        </radialGradient>
        <radialGradient id="cl-sh3" cx="50%" cy="90%" r="50%">
          <stop offset="0%" stopColor="rgba(140,160,200,0.16)"/>
          <stop offset="100%" stopColor="rgba(140,160,200,0)"/>
        </radialGradient>
      </defs>
      {/* Each <g> gets its own slow drift animation */}
      <g className="cloud-grp-1">
        {/* Volume shadow base */}
        <ellipse cx="160" cy="118" rx="108" ry="16" fill="url(#cl-sh1)"/>
        <ellipse cx="160" cy="80" rx="100" ry="40" fill="white" opacity="0.82" />
        <ellipse cx="96" cy="100" rx="64" ry="32" fill="white" opacity="0.82" />
        <ellipse cx="224" cy="100" rx="68" ry="30" fill="white" opacity="0.82" />
      </g>
      <g className="cloud-grp-2">
        {/* Volume shadow base */}
        <ellipse cx="820" cy="98" rx="88" ry="13" fill="url(#cl-sh2)"/>
        <ellipse cx="820" cy="62" rx="82" ry="34" fill="white" opacity="0.72" />
        <ellipse cx="756" cy="78" rx="54" ry="26" fill="white" opacity="0.72" />
        <ellipse cx="884" cy="78" rx="56" ry="24" fill="white" opacity="0.72" />
      </g>
      <g className="cloud-grp-3">
        {/* Volume shadow base */}
        <ellipse cx="520" cy="67" rx="62" ry="10" fill="url(#cl-sh3)"/>
        <ellipse cx="520" cy="40" rx="56" ry="22" fill="white" opacity="0.55" />
        <ellipse cx="472" cy="54" rx="36" ry="18" fill="white" opacity="0.55" />
        <ellipse cx="568" cy="54" rx="38" ry="17" fill="white" opacity="0.55" />
      </g>
    </svg>
  )
}

function StarsDeco() {
  // [x, y, r, opacity, dur_s, delay_s] — viewBox 0 0 100 85
  const stars = [
    // Bright feature stars
    [10,8,0.42,0.92,3.5,1.2],[45,5,0.40,0.90,4.2,2.8],[78,12,0.44,0.95,3.8,0.4],
    [23,18,0.38,0.88,5.0,3.5],[62,22,0.40,0.92,4.5,1.8],[88,7,0.42,0.90,3.2,0.8],
    [5,35,0.38,0.88,4.8,2.2],[93,28,0.40,0.92,5.2,4.0],[36,48,0.42,0.95,3.6,0.6],
    [71,42,0.38,0.90,4.0,3.2],[16,62,0.40,0.88,5.5,1.5],[55,58,0.44,0.92,3.4,4.5],
    [84,55,0.38,0.90,4.8,2.0],[98,72,0.40,0.88,3.8,0.2],
    // Medium
    [18,4,0.28,0.76,6.2,2.5],[33,14,0.24,0.72,4.5,1.8],[58,9,0.26,0.74,7.0,3.0],
    [76,18,0.28,0.76,5.8,0.6],[92,14,0.24,0.72,4.2,4.2],[8,25,0.26,0.74,6.5,1.2],
    [41,28,0.28,0.76,5.2,3.8],[70,30,0.24,0.72,3.9,2.2],[97,38,0.26,0.74,7.3,0.9],
    [28,42,0.28,0.76,4.6,4.5],[48,50,0.24,0.72,6.0,1.5],[78,48,0.26,0.74,5.4,3.2],
    [14,68,0.28,0.76,4.8,2.0],[38,65,0.24,0.72,6.8,1.0],[65,62,0.26,0.74,5.0,3.6],
    [88,78,0.28,0.76,3.7,0.4],[2,75,0.24,0.72,7.0,4.8],[52,78,0.26,0.74,4.3,2.6],
    // Small
    [6,14,0.16,0.58,5.5,1.5],[26,8,0.14,0.55,6.2,3.2],[50,16,0.16,0.58,4.8,2.8],
    [68,4,0.14,0.55,7.5,0.6],[85,22,0.16,0.58,5.0,4.1],[3,52,0.14,0.55,6.8,1.8],
    [20,55,0.16,0.58,4.2,3.5],[35,60,0.14,0.55,7.2,0.2],[72,65,0.16,0.58,4.5,4.8],
    [80,72,0.14,0.55,6.5,1.2],[96,62,0.16,0.58,5.2,3.8],[12,78,0.14,0.55,7.8,0.8],
    [32,82,0.16,0.58,4.0,2.2],[60,80,0.14,0.55,6.2,4.5],[75,82,0.16,0.58,5.5,1.0],
    [90,68,0.14,0.55,7.0,3.2],[44,72,0.16,0.58,4.8,0.4],[18,38,0.14,0.55,6.5,2.8],
    [62,38,0.16,0.58,5.0,4.2],[8,44,0.14,0.55,7.2,1.8],[30,48,0.16,0.58,4.5,3.5],
    [82,35,0.14,0.55,6.8,0.5],[95,50,0.16,0.58,5.5,2.2],[46,35,0.14,0.55,7.5,4.8],
    [60,48,0.16,0.58,4.2,1.2],[55,70,0.14,0.55,6.0,3.8],[72,55,0.16,0.58,5.8,0.8],
  ]
  return (
    <svg className="login-deco login-deco-stars" viewBox="0 0 100 85"
      preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="dr-sglo" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="0.18"/>
        </filter>
      </defs>
      {/* Subtle halos only on the brightest stars */}
      <g filter="url(#dr-sglo)" opacity="0.28">
        {stars.filter(s => s[2] >= 0.40).map(([x,y,r],i) => (
          <circle key={`h${i}`} cx={x} cy={y} r={r+0.18} fill="#ddeeff"/>
        ))}
      </g>
      {/* All stars with individual twinkling */}
      {stars.map(([x,y,r,op,dur,del],i) => (
        <circle key={i} cx={x} cy={y} r={r}
          fill={i%3===0 ? '#fffde8' : i%5===0 ? '#e8f0ff' : 'white'}>
          <animate attributeName="opacity"
            values={`${op};${+(op*0.05).toFixed(2)};${op}`}
            dur={`${dur}s`} begin={`-${del}s`} repeatCount="indefinite"
            calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        </circle>
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

/* ── Doctor floral horizon ───────────────────────────────────────────── */

const SunflowerPlant = () => {
  const A = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  return (
    <>
      <rect x="-1.5" y="-44" width="3" height="44" rx="1.5" fill="rgba(21,128,61,0.88)" />
      <ellipse cx="-6" cy="-20" rx="6.5" ry="2.5" transform="rotate(-22,-6,-20)" fill="rgba(21,128,61,0.66)" />
      <ellipse cx="6" cy="-31" rx="6.5" ry="2.5" transform="rotate(22,6,-31)" fill="rgba(21,128,61,0.66)" />
      <g transform="translate(0,-44)">
        {A.map((a, i) => (
          <g key={i} transform={`rotate(${a})`}>
            <ellipse cx="0" cy="-9" rx="2.8" ry="5.5" fill="rgba(251,191,36,0.92)" />
          </g>
        ))}
        <circle cx="0" cy="0" r="5.5" fill="rgba(120,53,15,0.95)" />
        <circle cx="0" cy="0" r="3.5" fill="rgba(92,40,10,0.55)" />
      </g>
    </>
  )
}

const DaisyPlant = () => {
  const A = [0, 40, 80, 120, 160, 200, 240, 280, 320]
  return (
    <>
      <rect x="-1" y="-30" width="2" height="30" rx="1" fill="rgba(21,128,61,0.82)" />
      <g transform="translate(0,-30)">
        {A.map((a, i) => (
          <g key={i} transform={`rotate(${a})`}>
            <ellipse cx="0" cy="-8" rx="2.2" ry="5" fill="rgba(255,255,255,0.90)" />
          </g>
        ))}
        <circle cx="0" cy="0" r="3.5" fill="rgba(250,204,21,0.95)" />
      </g>
    </>
  )
}

const WildStem = () => (
  <>
    <line x1="0" y1="0" x2="-2" y2="-28" stroke="rgba(21,128,61,0.72)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="-2" y1="-28" x2="-7" y2="-36" stroke="rgba(21,128,61,0.70)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="-2" y1="-28" x2="3" y2="-34" stroke="rgba(21,128,61,0.66)" strokeWidth="1.1" strokeLinecap="round" />
    <circle cx="-7" cy="-37" r="2.5" fill="rgba(251,191,36,0.82)" />
    <circle cx="3" cy="-35" r="2.0" fill="rgba(255,255,255,0.80)" />
    <circle cx="-2" cy="-30" r="1.4" fill="rgba(251,191,36,0.62)" />
  </>
)

const MoonflowerPlant = () => (
  <>
    <rect x="-1" y="-44" width="2" height="44" rx="1" fill="rgba(30,41,59,0.82)" />
    <g transform="translate(0,-44)">
      <path d="M-2,0 C-5,-8 -10,-16 -11,-22 L11,-22 C10,-16 5,-8 2,0 Z" fill="rgba(226,232,240,0.90)" />
      <ellipse cx="0" cy="-22" rx="10" ry="3" fill="rgba(241,245,249,0.75)" />
      <ellipse cx="0" cy="-13" rx="4" ry="6" fill="rgba(241,245,249,0.40)" />
    </g>
  </>
)

const EveningPrimrose = () => (
  <>
    <rect x="-1" y="-36" width="2" height="36" rx="1" fill="rgba(30,41,59,0.78)" />
    <g transform="translate(0,-36)">
      <ellipse cx="0" cy="-8" rx="4" ry="7.5" fill="rgba(253,224,71,0.75)" />
      <ellipse cx="0" cy="8" rx="4" ry="7.5" fill="rgba(253,224,71,0.75)" />
      <ellipse cx="-8" cy="0" rx="7.5" ry="4" fill="rgba(253,224,71,0.75)" />
      <ellipse cx="8" cy="0" rx="7.5" ry="4" fill="rgba(253,224,71,0.75)" />
      <circle cx="0" cy="0" r="3.5" fill="rgba(180,130,18,0.88)" />
    </g>
  </>
)

const ClosedDaisy = () => {
  const A = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <>
      <line x1="0" y1="0" x2="1" y2="-30" stroke="rgba(30,41,59,0.78)" strokeWidth="1.8" strokeLinecap="round" />
      <g transform="translate(1,-30)">
        {A.map((a, i) => (
          <g key={i} transform={`rotate(${a})`}>
            <ellipse cx="0" cy="5" rx="1.8" ry="4" fill="rgba(71,85,105,0.72)" />
          </g>
        ))}
        <circle cx="0" cy="0" r="2.8" fill="rgba(51,65,85,0.88)" />
      </g>
    </>
  )
}

function DoctorHorizonDeco() {
  const SF = (dur, del) => ({ className: 'dr-sunflower', style: { animationDuration: dur, animationDelay: del } })
  const DY = (dur, del) => ({ className: 'dr-daisy', style: { animationDuration: dur, animationDelay: del } })
  const WS = (dur, del) => ({ className: 'dr-wildflower', style: { animationDuration: dur, animationDelay: del } })
  const MF = (dur, del) => ({ className: 'dr-moonflower', style: { animationDuration: dur, animationDelay: del } })
  const EP = (dur, del) => ({ className: 'dr-primrose', style: { animationDuration: dur, animationDelay: del } })
  const CD = (dur, del) => ({ className: 'dr-closeddaisy', style: { animationDuration: dur, animationDelay: del } })

  return (
    <>
      <svg className="login-horizon login-horizon--day" viewBox="0 0 1440 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <path d="M0,130 L0,88 C200,38 400,78 600,52 C800,26 1000,66 1200,44 C1300,33 1370,50 1440,46 L1440,130 Z" fill="rgba(134,239,172,0.18)" />
        <path d="M0,130 L0,108 C180,88 360,104 540,96 C720,88 900,104 1080,96 C1260,88 1360,100 1440,98 L1440,130 Z" fill="rgba(74,222,128,0.26)" />
        <path d="M0,130 L0,120 L1440,120 L1440,130 Z" fill="rgba(34,197,94,0.30)" />
        {/* Front row */}
        <g transform="translate(64,120)  scale(0.86)"><g {...SF('4.2s', '0.0s')}><SunflowerPlant /></g></g>
        <g transform="translate(79,120)  scale(1.02)"><g {...SF('4.8s', '0.9s')}><SunflowerPlant /></g></g>
        <g transform="translate(120,120) scale(0.62)"><g {...DY('3.1s', '0.4s')}><DaisyPlant /></g></g>
        <g transform="translate(132,120) scale(0.68)"><g {...DY('3.6s', '1.2s')}><DaisyPlant /></g></g>
        <g transform="translate(144,120) scale(0.58)"><g {...DY('2.9s', '2.2s')}><DaisyPlant /></g></g>
        <g transform="translate(240,120) scale(0.50)"><g {...WS('2.8s', '1.5s')}><WildStem /></g></g>
        <g transform="translate(256,120) scale(0.56)"><g {...WS('3.2s', '0.3s')}><WildStem /></g></g>
        <g transform="translate(296,120) scale(0.70)"><g {...DY('3.3s', '0.8s')}><DaisyPlant /></g></g>
        <g transform="translate(310,120) scale(0.64)"><g {...DY('3.8s', '2.5s')}><DaisyPlant /></g></g>
        <g transform="translate(418,120) scale(0.98)"><g {...SF('4.5s', '0.5s')}><SunflowerPlant /></g></g>
        <g transform="translate(435,120) scale(0.80)"><g {...SF('5.1s', '1.8s')}><SunflowerPlant /></g></g>
        <g transform="translate(474,120) scale(0.62)"><g {...DY('3.0s', '0.6s')}><DaisyPlant /></g></g>
        <g transform="translate(486,120) scale(0.68)"><g {...DY('3.4s', '1.9s')}><DaisyPlant /></g></g>
        <g transform="translate(498,120) scale(0.52)"><g {...WS('2.9s', '3.1s')}><WildStem /></g></g>
        <g transform="translate(596,120) scale(0.72)"><g {...DY('3.5s', '0.2s')}><DaisyPlant /></g></g>
        <g transform="translate(610,120) scale(0.66)"><g {...DY('3.0s', '1.4s')}><DaisyPlant /></g></g>
        <g transform="translate(624,120) scale(0.58)"><g {...WS('2.7s', '2.8s')}><WildStem /></g></g>
        <g transform="translate(714,120) scale(1.08)"><g {...SF('4.0s', '0.0s')}><SunflowerPlant /></g></g>
        <g transform="translate(730,120) scale(0.92)"><g {...SF('4.6s', '1.3s')}><SunflowerPlant /></g></g>
        <g transform="translate(746,120) scale(0.76)"><g {...SF('5.2s', '2.6s')}><SunflowerPlant /></g></g>
        <g transform="translate(774,120) scale(0.64)"><g {...DY('3.2s', '0.7s')}><DaisyPlant /></g></g>
        <g transform="translate(788,120) scale(0.70)"><g {...DY('3.7s', '1.8s')}><DaisyPlant /></g></g>
        <g transform="translate(886,120) scale(0.54)"><g {...WS('3.0s', '4.0s')}><WildStem /></g></g>
        <g transform="translate(902,120) scale(0.60)"><g {...DY('3.3s', '0.5s')}><DaisyPlant /></g></g>
        <g transform="translate(916,120) scale(0.68)"><g {...DY('3.6s', '1.6s')}><DaisyPlant /></g></g>
        <g transform="translate(930,120) scale(0.62)"><g {...WS('2.8s', '2.2s')}><WildStem /></g></g>
        <g transform="translate(1046,120) scale(0.90)"><g {...SF('4.4s', '0.8s')}><SunflowerPlant /></g></g>
        <g transform="translate(1062,120) scale(1.04)"><g {...SF('4.9s', '2.0s')}><SunflowerPlant /></g></g>
        <g transform="translate(1098,120) scale(0.58)"><g {...DY('3.1s', '0.3s')}><DaisyPlant /></g></g>
        <g transform="translate(1110,120) scale(0.66)"><g {...DY('3.5s', '1.5s')}><DaisyPlant /></g></g>
        <g transform="translate(1208,120) scale(0.64)"><g {...DY('3.2s', '2.8s')}><DaisyPlant /></g></g>
        <g transform="translate(1222,120) scale(0.70)"><g {...DY('3.8s', '0.6s')}><DaisyPlant /></g></g>
        <g transform="translate(1236,120) scale(0.56)"><g {...WS('2.9s', '1.4s')}><WildStem /></g></g>
        <g transform="translate(1254,120) scale(0.62)"><g {...DY('3.4s', '3.6s')}><DaisyPlant /></g></g>
        <g transform="translate(1350,120) scale(0.84)"><g {...SF('4.3s', '1.2s')}><SunflowerPlant /></g></g>
        <g transform="translate(1366,120) scale(0.94)"><g {...SF('5.0s', '0.4s')}><SunflowerPlant /></g></g>
        <g transform="translate(1398,120) scale(0.60)"><g {...DY('3.0s', '2.0s')}><DaisyPlant /></g></g>
        <g transform="translate(1412,120) scale(0.54)"><g {...WS('2.8s', '5.0s')}><WildStem /></g></g>
      </svg>

      <svg className="login-horizon login-horizon--night" viewBox="0 0 1440 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <radialGradient id="nmt-moon-glow" cx="73%" cy="0%" r="55%">
            <stop offset="0%" stopColor="rgba(180,205,255,0.14)"/>
            <stop offset="100%" stopColor="rgba(80,110,220,0)"/>
          </radialGradient>
          <radialGradient id="nmt-valley-mist" cx="50%" cy="100%" r="70%">
            <stop offset="0%" stopColor="rgba(90,115,230,0.16)"/>
            <stop offset="100%" stopColor="rgba(60,80,180,0)"/>
          </radialGradient>
          <radialGradient id="nmt-peak-halo" cx="66%" cy="22%" r="30%">
            <stop offset="0%" stopColor="rgba(200,218,255,0.12)"/>
            <stop offset="100%" stopColor="rgba(140,160,240,0)"/>
          </radialGradient>
          <linearGradient id="nmt-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(4,7,20,0)"/>
            <stop offset="100%" stopColor="rgba(2,4,12,1)"/>
          </linearGradient>
        </defs>

        {/* Atmospheric moon-glow wash over far sky */}
        <rect width="1440" height="130" fill="url(#nmt-moon-glow)"/>

        {/* Layer 1 — Distant mountains (faintest deep-indigo silhouette) */}
        <path d="M0,130 L0,86
          C55,82 110,74 160,64 C200,56 240,48 280,42
          C310,38 345,46 380,40 C420,32 465,24 515,20
          C555,16 590,20 625,26 C658,22 698,16 748,12
          C792,8 832,14 872,20 C912,14 954,8 1005,16
          C1048,24 1086,34 1124,30 C1164,26 1204,20 1252,26
          C1296,32 1340,40 1390,46 C1412,49 1428,51 1440,50
          L1440,130 Z"
          fill="rgba(24,32,92,0.58)"/>

        {/* Moonlit ridge line — brightest peaks catch the high moon */}
        <path d="M515,20 C555,16 590,20 625,26 C658,22 698,16 748,12 C792,8 832,14 872,20 C912,14 954,8 1005,16"
          stroke="rgba(195,212,255,0.28)" strokeWidth="1.8" fill="none" strokeLinecap="round"/>

        {/* Radial peak halo at center-right moon zone */}
        <rect width="1440" height="130" fill="url(#nmt-peak-halo)"/>

        {/* Layer 2 — Mid mountains (deeper navy) */}
        <path d="M0,130 L0,100
          C48,97 96,90 145,84 C188,79 228,76 276,82
          C326,88 366,77 416,68 C458,60 500,56 542,62
          C582,68 622,64 664,58 C706,52 752,60 800,66
          C844,60 884,54 932,60 C974,66 1014,72 1062,68
          C1104,64 1146,56 1204,62 C1256,68 1308,76 1362,78
          C1394,80 1420,78 1440,76
          L1440,130 Z"
          fill="rgba(11,16,56,0.88)"/>

        {/* Mid-ridge moonlit accents */}
        <path d="M416,68 C458,60 500,56 542,62 C582,68 622,62 664,56"
          stroke="rgba(185,205,255,0.18)" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <path d="M884,54 C932,50 974,56 1014,62"
          stroke="rgba(185,205,255,0.15)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>

        {/* Valley mist — glows softly between the ridges */}
        <rect width="1440" height="130" fill="url(#nmt-valley-mist)" opacity="0.75"/>

        {/* Layer 3 — Foreground mountains (near-black, deepest shadow) */}
        <path d="M0,130 L0,112
          C38,110 80,106 118,102 C156,99 196,97 238,101
          C280,105 320,101 362,97 C402,93 444,89 490,87
          C530,86 570,90 618,94 C652,96 690,94 730,90
          C770,86 812,87 860,93 C902,97 942,99 990,101
          C1038,103 1090,100 1148,97 C1200,94 1260,98 1322,103
          C1360,105 1402,107 1440,105
          L1440,130 Z"
          fill="rgba(5,8,22,0.98)"/>

        {/* Pine tree silhouettes growing on the near ridge */}
        <g fill="rgba(3,5,14,1.0)">
          {[
            [92,102,7,14],[104,100,8,15],[116,101,6,12],[128,102,7,13],
            [182,97,8,15],[194,95,9,17],[206,96,7,13],[218,97,6,11],
            [364,97,8,15],[376,95,10,18],[388,96,7,13],[400,97,6,11],
            [454,87,9,17],[466,85,11,19],[478,86,8,16],[490,87,7,13],
            [622,94,8,15],[634,92,9,17],[646,93,7,13],
            [782,90,8,15],[794,88,10,17],[806,89,7,12],
            [934,99,7,13],[946,97,8,15],[958,98,6,12],
            [1086,98,8,15],[1098,96,9,16],[1110,97,7,13],
            [1226,99,6,12],[1238,97,7,14],[1250,98,8,15],[1262,99,6,11],
            [1368,103,7,14],[1380,102,8,15],[1392,103,6,11],
          ].map(([x,by,w,h],i) => (
            <polygon key={`pine${i}`} points={`${x},${by-h} ${x-w},${by} ${x+w},${by}`}/>
          ))}
        </g>

        {/* Ground fill gradient */}
        <rect x="0" y="118" width="1440" height="12" fill="url(#nmt-ground)"/>

        {/* Night plants — moonflowers + evening primrose + closed daisies */}
        <g transform="translate(64,120)  scale(0.86)"><g {...MF('5.5s', '0.0s')}><MoonflowerPlant /></g></g>
        <g transform="translate(79,120)  scale(1.02)"><g {...MF('6.0s', '0.9s')}><MoonflowerPlant /></g></g>
        <g transform="translate(144,120) scale(0.58)"><g {...EP('5.2s', '2.2s')}><EveningPrimrose /></g></g>
        <g transform="translate(162,120) scale(0.52)"><g {...CD('4.8s', '1.1s')}><ClosedDaisy /></g></g>
        <g transform="translate(176,120) scale(0.60)"><g {...CD('5.2s', '3.0s')}><ClosedDaisy /></g></g>
        <g transform="translate(220,120) scale(0.50)"><g {...CD('4.5s', '0.5s')}><ClosedDaisy /></g></g>
        <g transform="translate(234,120) scale(0.56)"><g {...CD('5.6s', '2.4s')}><ClosedDaisy /></g></g>
        <g transform="translate(256,120) scale(0.56)"><g {...EP('5.5s', '0.3s')}><EveningPrimrose /></g></g>
        <g transform="translate(310,120) scale(0.54)"><g {...CD('4.9s', '1.8s')}><ClosedDaisy /></g></g>
        <g transform="translate(324,120) scale(0.60)"><g {...CD('5.3s', '4.2s')}><ClosedDaisy /></g></g>
        <g transform="translate(338,120) scale(0.50)"><g {...CD('4.6s', '0.8s')}><ClosedDaisy /></g></g>
        <g transform="translate(380,120) scale(0.64)"><g {...EP('5.0s', '2.8s')}><EveningPrimrose /></g></g>
        <g transform="translate(418,120) scale(0.98)"><g {...MF('5.8s', '0.5s')}><MoonflowerPlant /></g></g>
        <g transform="translate(435,120) scale(0.80)"><g {...MF('6.4s', '1.8s')}><MoonflowerPlant /></g></g>
        <g transform="translate(486,120) scale(0.68)"><g {...EP('5.0s', '1.9s')}><EveningPrimrose /></g></g>
        <g transform="translate(510,120) scale(0.54)"><g {...CD('4.7s', '0.6s')}><ClosedDaisy /></g></g>
        <g transform="translate(524,120) scale(0.60)"><g {...CD('5.4s', '3.5s')}><ClosedDaisy /></g></g>
        <g transform="translate(562,120) scale(0.52)"><g {...CD('4.4s', '1.6s')}><ClosedDaisy /></g></g>
        <g transform="translate(576,120) scale(0.58)"><g {...CD('5.8s', '4.8s')}><ClosedDaisy /></g></g>
        <g transform="translate(610,120) scale(0.66)"><g {...EP('5.3s', '1.4s')}><EveningPrimrose /></g></g>
        <g transform="translate(654,120) scale(0.54)"><g {...CD('4.6s', '2.2s')}><ClosedDaisy /></g></g>
        <g transform="translate(668,120) scale(0.60)"><g {...CD('5.1s', '0.3s')}><ClosedDaisy /></g></g>
        <g transform="translate(682,120) scale(0.50)"><g {...EP('5.6s', '3.8s')}><EveningPrimrose /></g></g>
        <g transform="translate(714,120) scale(1.08)"><g {...MF('5.2s', '0.0s')}><MoonflowerPlant /></g></g>
        <g transform="translate(730,120) scale(0.92)"><g {...MF('5.8s', '1.3s')}><MoonflowerPlant /></g></g>
        <g transform="translate(746,120) scale(0.76)"><g {...MF('6.5s', '2.6s')}><MoonflowerPlant /></g></g>
        <g transform="translate(788,120) scale(0.54)"><g {...CD('4.8s', '1.0s')}><ClosedDaisy /></g></g>
        <g transform="translate(802,120) scale(0.60)"><g {...CD('5.2s', '3.2s')}><ClosedDaisy /></g></g>
        <g transform="translate(840,120) scale(0.56)"><g {...EP('5.4s', '0.7s')}><EveningPrimrose /></g></g>
        <g transform="translate(856,120) scale(0.50)"><g {...CD('4.5s', '2.8s')}><ClosedDaisy /></g></g>
        <g transform="translate(870,120) scale(0.58)"><g {...CD('5.7s', '4.5s')}><ClosedDaisy /></g></g>
        <g transform="translate(916,120) scale(0.68)"><g {...EP('5.1s', '1.6s')}><EveningPrimrose /></g></g>
        <g transform="translate(960,120) scale(0.54)"><g {...CD('4.9s', '0.4s')}><ClosedDaisy /></g></g>
        <g transform="translate(974,120) scale(0.60)"><g {...CD('5.3s', '2.6s')}><ClosedDaisy /></g></g>
        <g transform="translate(988,120) scale(0.52)"><g {...CD('4.6s', '5.0s')}><ClosedDaisy /></g></g>
        <g transform="translate(1022,120) scale(0.58)"><g {...EP('5.5s', '1.2s')}><EveningPrimrose /></g></g>
        <g transform="translate(1046,120) scale(0.90)"><g {...MF('5.6s', '0.8s')}><MoonflowerPlant /></g></g>
        <g transform="translate(1062,120) scale(1.04)"><g {...MF('6.2s', '2.0s')}><MoonflowerPlant /></g></g>
        <g transform="translate(1110,120) scale(0.66)"><g {...EP('5.2s', '1.5s')}><EveningPrimrose /></g></g>
        <g transform="translate(1134,120) scale(0.52)"><g {...CD('4.7s', '3.1s')}><ClosedDaisy /></g></g>
        <g transform="translate(1148,120) scale(0.58)"><g {...CD('5.0s', '0.6s')}><ClosedDaisy /></g></g>
        <g transform="translate(1186,120) scale(0.54)"><g {...CD('4.8s', '2.4s')}><ClosedDaisy /></g></g>
        <g transform="translate(1200,120) scale(0.60)"><g {...EP('5.4s', '4.0s')}><EveningPrimrose /></g></g>
        <g transform="translate(1222,120) scale(0.70)"><g {...EP('5.5s', '0.6s')}><EveningPrimrose /></g></g>
        <g transform="translate(1266,120) scale(0.54)"><g {...CD('4.5s', '1.9s')}><ClosedDaisy /></g></g>
        <g transform="translate(1280,120) scale(0.60)"><g {...CD('5.6s', '3.4s')}><ClosedDaisy /></g></g>
        <g transform="translate(1294,120) scale(0.52)"><g {...CD('4.9s', '0.2s')}><ClosedDaisy /></g></g>
        <g transform="translate(1318,120) scale(0.58)"><g {...EP('5.1s', '2.0s')}><EveningPrimrose /></g></g>
        <g transform="translate(1350,120) scale(0.84)"><g {...MF('5.4s', '1.2s')}><MoonflowerPlant /></g></g>
        <g transform="translate(1366,120) scale(0.94)"><g {...MF('6.0s', '0.4s')}><MoonflowerPlant /></g></g>
        <g transform="translate(1398,120) scale(0.56)"><g {...CD('4.8s', '3.6s')}><ClosedDaisy /></g></g>
        <g transform="translate(1412,120) scale(0.62)"><g {...EP('5.2s', '1.0s')}><EveningPrimrose /></g></g>
      </svg>
    </>
  )
}

function DoctorPetalDeco() {
  const petals = [
    { l: '5%', b: '22%', s: 8, dur: '12s', del: '0.0s' },
    { l: '18%', b: '18%', s: 6, dur: '15s', del: '2.5s' },
    { l: '31%', b: '25%', s: 10, dur: '10s', del: '1.0s' },
    { l: '42%', b: '20%', s: 7, dur: '14s', del: '4.2s' },
    { l: '55%', b: '28%', s: 9, dur: '11s', del: '1.8s' },
    { l: '66%', b: '22%', s: 6, dur: '16s', del: '3.5s' },
    { l: '78%', b: '26%', s: 8, dur: '9s', del: '0.8s' },
    { l: '88%', b: '20%', s: 7, dur: '13s', del: '2.0s' },
    { l: '46%', b: '30%', s: 10, dur: '8s', del: '5.5s' },
    { l: '24%', b: '32%', s: 6, dur: '17s', del: '7.0s' },
    { l: '70%', b: '31%', s: 8, dur: '11s', del: '0.3s' },
    { l: '11%', b: '27%', s: 5, dur: '14s', del: '9.0s' },
  ]
  return (
    <div className="login-dr-petals" aria-hidden="true">
      {petals.map((p, i) => (
        <span key={i} className="dr-petal" style={{
          left: p.l, bottom: p.b,
          width: p.s + 'px', height: (p.s * 1.4) + 'px',
          animationDuration: p.dur, animationDelay: p.del,
        }} />
      ))}
    </div>
  )
}

function NorthernLightsDeco() {
  return (
    <div className="login-aurora" aria-hidden="true">
      <svg className="login-aurora-svg" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMin slice">
        <defs>
          <linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#05081c" stopOpacity="0.72"/>
            <stop offset="55%"  stopColor="#060e20" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#060e1a" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id="moon" cx="0.82" cy="0.10" r="0.30" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#ddeeff" stopOpacity="0.52"/>
            <stop offset="28%"  stopColor="#aaccff" stopOpacity="0.18"/>
            <stop offset="68%"  stopColor="#6688cc" stopOpacity="0.04"/>
            <stop offset="100%" stopColor="#4060a0" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="nebl" cx="0.08" cy="0.06" r="0.28" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#1a2268" stopOpacity="0.26"/>
            <stop offset="100%" stopColor="#1a2268" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="shg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="white" stopOpacity="0"/>
            <stop offset="50%"  stopColor="white" stopOpacity="0.52"/>
            <stop offset="100%" stopColor="white" stopOpacity="0.92"/>
          </linearGradient>
          <filter id="sglo" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.5"/>
          </filter>
        </defs>

        <rect width="1440" height="300" fill="url(#nsky)"/>
        <rect width="1440" height="300" fill="url(#nebl)"/>
        <rect width="1440" height="300" fill="url(#moon)"/>

        {/* Bright star halos */}
        <g filter="url(#sglo)" opacity="0.45">
          {[[1180,38,2.2],[318,22,1.9],[680,14,2.0],[852,56,2.3],[1355,26,1.8],[44,19,2.1],[540,46,2.0],[1052,20,1.9]].map(([cx,cy,r],i) => (
            <circle key={i} cx={cx} cy={cy} r={r+2.2} fill="white"/>
          ))}
        </g>

        {/* Stars — each with its own twinkling SVG animate */}
        {[
          [1180,38,2.2,0.95,4.2,1.3],[318,22,1.9,0.90,3.8,2.3],[680,14,2.0,0.92,5.1,0.5],
          [852,56,2.3,0.95,3.5,3.1],[1355,26,1.8,0.88,4.8,1.8],[44,19,2.1,0.93,5.5,2.8],
          [540,46,2.0,0.90,4.0,0.8],[1052,20,1.9,0.88,6.2,3.5],
          [95,48,1.4,0.75,6.2,2.5],[210,16,1.3,0.70,4.5,1.8],[382,72,1.5,0.78,7.1,3.0],
          [490,36,1.2,0.72,5.8,0.6],[572,90,1.4,0.76,4.2,4.2],[742,44,1.3,0.74,6.5,1.2],
          [882,18,1.5,0.78,5.2,3.8],[962,76,1.2,0.70,3.9,2.2],[1142,84,1.3,0.72,4.6,4.5],
          [1262,56,1.5,0.78,6.0,1.5],[1392,68,1.2,0.70,5.4,3.2],[148,92,1.3,0.74,4.8,2.0],
          [432,14,1.4,0.76,6.8,1.0],[612,60,1.2,0.72,5.0,3.6],[792,90,1.5,0.78,3.7,0.4],
          [1012,22,1.3,0.74,7.0,4.8],[1322,14,1.4,0.76,4.3,2.6],
          [30,66,0.8,0.62,5.5,1.5],[76,8,0.9,0.65,6.2,3.2],[170,56,0.8,0.60,4.8,2.8],
          [256,42,0.9,0.62,7.5,0.6],[342,90,0.8,0.60,5.0,4.1],[422,24,0.8,0.60,6.8,1.8],
          [512,66,0.9,0.62,4.2,3.5],[592,12,0.8,0.60,7.2,0.2],[662,82,0.8,0.60,5.8,2.5],
          [732,56,0.9,0.62,4.5,4.8],[812,32,0.8,0.60,6.5,1.2],[896,94,0.8,0.60,5.2,3.8],
          [972,50,0.9,0.62,7.8,0.8],[1032,74,0.8,0.60,4.0,2.2],[1096,20,0.8,0.60,6.2,4.5],
          [1162,66,0.9,0.62,5.5,1.0],[1226,34,0.8,0.60,7.0,3.2],[1296,82,0.8,0.60,4.8,0.4],
          [1366,46,0.9,0.62,6.5,2.8],[1416,22,0.8,0.60,5.0,4.2],[18,42,0.8,0.60,7.2,1.8],
          [112,76,0.9,0.62,4.5,3.5],[192,30,0.8,0.60,6.8,0.5],[276,70,0.8,0.60,5.5,2.2],
          [356,16,0.9,0.62,7.5,4.8],[446,84,0.8,0.60,4.2,1.2],[526,40,0.8,0.60,6.0,3.8],
          [616,74,0.9,0.62,5.8,0.8],[696,26,0.8,0.60,7.2,4.0],[776,64,0.8,0.60,4.8,1.6],
          [856,10,0.9,0.62,6.5,3.2],[936,56,0.8,0.60,5.2,0.2],[1008,88,0.8,0.60,7.0,4.5],
          [1078,44,0.9,0.62,4.5,1.8],[1156,30,0.8,0.60,6.2,3.0],[1212,74,0.8,0.60,5.8,0.6],
          [1282,20,0.9,0.62,7.5,2.4],[1342,60,0.8,0.60,4.2,4.0],[1408,88,0.8,0.60,6.0,1.5],
          [56,32,0.5,0.42,8.0,2.0],[132,86,0.5,0.40,6.5,0.5],[222,54,0.5,0.42,7.2,3.8],
          [306,12,0.5,0.40,5.8,1.2],[396,60,0.5,0.42,8.5,4.5],[476,50,0.5,0.40,6.2,2.8],
          [546,28,0.5,0.42,7.8,0.8],[626,94,0.5,0.40,5.5,3.5],[706,40,0.5,0.42,8.2,1.5],
          [786,80,0.5,0.40,6.8,4.2],[866,18,0.5,0.42,7.5,0.2],[946,68,0.5,0.40,5.2,3.0],
          [1026,32,0.5,0.42,8.8,1.8],[1092,90,0.5,0.40,6.5,4.8],[1172,54,0.5,0.42,7.2,2.5],
          [1236,10,0.5,0.40,5.8,0.8],[1308,44,0.5,0.42,8.0,3.5],[1376,74,0.5,0.40,6.2,1.2],
        ].map(([cx,cy,r,op,dur,del],i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="white">
            <animate attributeName="opacity"
              values={`${op};${+(op*0.05).toFixed(2)};${op}`}
              dur={`${dur}s`} begin={`-${del}s`} repeatCount="indefinite"
              calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
          </circle>
        ))}

        {/* Shooting star — sweeps diagonally every 25s */}
        <g>
          <animateTransform attributeName="transform" type="translate"
            values="0,0; 1570,560" dur="25s" repeatCount="indefinite" calcMode="linear"/>
          <animate attributeName="opacity"
            values="0;0;0.88;0.88;0;0"
            keyTimes="0;0.14;0.19;0.25;0.30;1"
            dur="25s" repeatCount="indefinite"/>
          <line x1="-130" y1="-48" x2="0" y2="0" stroke="url(#shg)" strokeWidth="1.8"/>
        </g>
      </svg>
    </div>
  )
}

/* ── Pharmacy botanical horizon ─────────────────────────────────────── */

const GrassTuft = () => (
  <>
    <path d="M0,0 C-1,-14 -2,-30 0,-44 C2,-30 1,-14 0,0 Z" />
    <path d="M0,0 C-3,-10 -5,-23 -4,-35 C-2,-22 0,-11 0,0 Z" />
    <path d="M0,0 C3,-10 5,-23 4,-35 C2,-22 0,-11 0,0 Z" />
    <path d="M0,0 C-2,-7 -4,-16 -5,-24 C-3,-14 -1,-6 0,0 Z" />
    <path d="M0,0 C2,-7 4,-16 5,-24 C3,-14 1,-6 0,0 Z" />
  </>
)

const LavSprig = () => (
  <>
    <rect x="-1" y="-50" width="2" height="50" rx="1" />
    <ellipse cx="-6" cy="-34" rx="5" ry="2.4" />
    <ellipse cx="6" cy="-28" rx="5" ry="2.4" />
    <ellipse cx="-5" cy="-20" rx="4.5" ry="2.1" />
    <ellipse cx="5" cy="-15" rx="4.5" ry="2.1" />
    <ellipse cx="-4" cy="-9" rx="4" ry="1.9" />
    <ellipse cx="4" cy="-5" rx="4" ry="1.9" />
    <ellipse cx="0" cy="-55" rx="3.5" ry="6.5" />
  </>
)

const ChamomileFlower = () => {
  const A = [0,30,60,90,120,150,180,210,240,270,300,330]
  return (
    <>
      <rect x="-1" y="-34" width="2" height="34" rx="1" fill="rgba(22,101,52,0.82)"/>
      <ellipse cx="-5" cy="-15" rx="5" ry="2" transform="rotate(-20,-5,-15)" fill="rgba(22,101,52,0.58)"/>
      <ellipse cx="5" cy="-23" rx="5" ry="2" transform="rotate(20,5,-23)" fill="rgba(22,101,52,0.58)"/>
      <g transform="translate(0,-34)">
        {A.map((a, i) => (
          <g key={i} transform={`rotate(${a})`}>
            <ellipse cx="0" cy="-8" rx="2.2" ry="5.5" fill="rgba(255,255,255,0.93)"/>
          </g>
        ))}
        <circle cx="0" cy="0" r="4.5" fill="rgba(253,224,71,0.96)"/>
        <circle cx="0" cy="0" r="2.6" fill="rgba(245,158,11,0.70)"/>
      </g>
    </>
  )
}

const RosemarySprig = () => (
  <>
    <rect x="-1" y="-46" width="2" height="46" rx="1"/>
    {[-42,-36,-30,-24,-18,-12,-6].map((y, i) => (
      <g key={i}>
        <ellipse cx="-5.5" cy={y} rx="6" ry="1.6" transform={`rotate(${i%2===0?-28:28},-5.5,${y})`}/>
        <ellipse cx="5.5" cy={y-5} rx="6" ry="1.6" transform={`rotate(${i%2===0?28:-28},5.5,${y-5})`}/>
      </g>
    ))}
  </>
)

/* ── Pharmacy morning sun ────────────────────────────────────────────── */

function PharmacySunDeco() {
  const RAYS = Array.from({ length: 14 }, (_, i) => i)
  return (
    <svg className="login-ph-sun" width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <radialGradient id="phsb" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff9e0" stopOpacity="1"/>
          <stop offset="45%"  stopColor="#fde68a" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.85"/>
        </radialGradient>
        <radialGradient id="phsh" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fef3c7" stopOpacity="0.38"/>
          <stop offset="55%"  stopColor="#fde68a" stopOpacity="0.14"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="phso" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fffbeb" stopOpacity="0.16"/>
          <stop offset="100%" stopColor="#fcd34d" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="118" fill="url(#phso)"/>
      <circle cx="120" cy="120" r="88"  fill="url(#phsh)"/>
      <g className="ph-sun-rays" style={{ transformOrigin: '120px 120px' }}>
        {RAYS.map(i => (
          <rect key={i} x="117" y="8" width="6" height="26" rx="3"
            fill={`rgba(255,210,55,${i % 2 === 0 ? 0.40 : 0.26})`}
            transform={`rotate(${(360 / 14) * i} 120 120)`}/>
        ))}
      </g>
      <circle cx="120" cy="120" r="62" fill="url(#phsb)"/>
      <circle cx="112" cy="112" r="20" fill="#fffde7" opacity="0.42"/>
    </svg>
  )
}

/* ── Pharmacy butterflies ────────────────────────────────────────────── */

function PharmacyButterflyDeco() {
  const Wings = ({ c1, c2, c3 }) => (
    <>
      <path d="M0,0 C-10,-16 -28,-17 -21,-5 C-16,4 -7,6 0,0 Z" fill={c1}/>
      <path d="M0,0 C10,-16 28,-17 21,-5 C16,4 7,6 0,0 Z" fill={c1}/>
      <path d="M0,0 C-13,5 -22,17 -14,18 C-7,19 -3,12 0,0 Z" fill={c2}/>
      <path d="M0,0 C13,5 22,17 14,18 C7,19 3,12 0,0 Z" fill={c2}/>
      <circle cx="-15" cy="-4" r="2.8" fill={c3} opacity="0.52"/>
      <circle cx="15" cy="-4" r="2.8" fill={c3} opacity="0.52"/>
      <ellipse cx="0" cy="5" rx="1.8" ry="9" fill="rgba(55,30,8,0.58)"/>
      <line x1="0" y1="-3" x2="-7" y2="-15" stroke="rgba(55,30,8,0.48)" strokeWidth="0.8"/>
      <line x1="0" y1="-3" x2="7" y2="-15" stroke="rgba(55,30,8,0.48)" strokeWidth="0.8"/>
      <circle cx="-7" cy="-15" r="1.3" fill="rgba(55,30,8,0.42)"/>
      <circle cx="7" cy="-15" r="1.3" fill="rgba(55,30,8,0.42)"/>
    </>
  )
  return (
    <>
      <svg className="login-ph-butterfly login-ph-butterfly-1"
        width="46" height="40" viewBox="-23 -20 46 34" aria-hidden="true">
        <g className="ph-bfly-wings ph-bfly-wings-1">
          <Wings c1="rgba(255,214,70,0.88)" c2="rgba(240,162,22,0.74)" c3="rgba(180,85,10,0.58)"/>
        </g>
      </svg>
      <svg className="login-ph-butterfly login-ph-butterfly-2"
        width="34" height="29" viewBox="-17 -15 34 27" aria-hidden="true">
        <g className="ph-bfly-wings ph-bfly-wings-2">
          <Wings c1="rgba(120,210,148,0.86)" c2="rgba(62,180,100,0.72)" c3="rgba(16,110,52,0.52)"/>
        </g>
      </svg>
      <svg className="login-ph-butterfly login-ph-butterfly-3"
        width="25" height="21" viewBox="-12 -11 25 23" aria-hidden="true">
        <g className="ph-bfly-wings ph-bfly-wings-3">
          <Wings c1="rgba(196,155,255,0.84)" c2="rgba(158,105,240,0.70)" c3="rgba(98,55,180,0.48)"/>
        </g>
      </svg>
    </>
  )
}

/* Outer <g> = position+scale. Inner <g className> = wind animation rotating from base */
function PharmacyHorizonDeco() {
  const G = (dur, del) => ({ className: 'ph-grass', style: { animationDuration: dur, animationDelay: del } })
  const L = (dur, del) => ({ className: 'ph-lav',   style: { animationDuration: dur, animationDelay: del } })
  const C = (dur, del) => ({ className: 'ph-lav',   style: { animationDuration: dur, animationDelay: del } })
  const R = (dur, del) => ({ className: 'ph-grass', style: { animationDuration: dur, animationDelay: del } })

  const scene = (c1, c2, c3) => (
    <>
      {/* Far hill */}
      <path d="M0,184 C300,162 600,174 900,161 C1150,151 1320,167 1440,157 L1440,220 L0,220 Z" fill={c1} />

      {/* Mid hill */}
      <path d="M0,194 C200,178 480,187 740,178 C980,170 1220,184 1440,175 L1440,220 L0,220 Z" fill={c2} />
      <g fill={c2}>
        <g transform="translate(116,193) scale(0.48)"><g {...G('3.1s', '1.1s')}><GrassTuft /></g></g>
        <g transform="translate(128,192) scale(0.60)"><g {...G('3.4s', '0.0s')}><GrassTuft /></g></g>
        <g transform="translate(140,193) scale(0.52)"><g {...G('3.9s', '0.5s')}><GrassTuft /></g></g>

        <g transform="translate(368,189) scale(0.70)"><g {...L('4.8s', '0.3s')}><LavSprig /></g></g>
        <g transform="translate(380,190) scale(0.78)"><g {...L('5.3s', '1.0s')}><LavSprig /></g></g>
        <g transform="translate(392,189) scale(0.66)"><g {...L('4.5s', '1.8s')}><LavSprig /></g></g>

        <g transform="translate(836,182) scale(0.56)"><g {...G('3.7s', '2.2s')}><GrassTuft /></g></g>
        <g transform="translate(848,183) scale(0.50)"><g {...G('3.2s', '0.8s')}><GrassTuft /></g></g>
        <g transform="translate(860,183) scale(0.46)"><g {...G('4.0s', '1.6s')}><GrassTuft /></g></g>

        <g transform="translate(1072,179) scale(0.66)"><g {...L('5.1s', '0.6s')}><LavSprig /></g></g>
        <g transform="translate(1084,180) scale(0.74)"><g {...L('4.6s', '1.4s')}><LavSprig /></g></g>
        <g transform="translate(1096,179) scale(0.62)"><g {...L('5.5s', '2.5s')}><LavSprig /></g></g>

        <g transform="translate(1328,182) scale(0.54)"><g {...G('3.5s', '3.2s')}><GrassTuft /></g></g>
        <g transform="translate(1340,183) scale(0.48)"><g {...G('3.8s', '0.4s')}><GrassTuft /></g></g>

        {/* Chamomile clusters on mid hill */}
        <g transform="translate(220,191) scale(0.62)"><g {...C('4.8s', '0.6s')}><ChamomileFlower /></g></g>
        <g transform="translate(234,190) scale(0.70)"><g {...C('5.3s', '1.8s')}><ChamomileFlower /></g></g>
        <g transform="translate(248,191) scale(0.58)"><g {...C('4.5s', '3.0s')}><ChamomileFlower /></g></g>

        <g transform="translate(570,185) scale(0.66)"><g {...C('5.0s', '0.2s')}><ChamomileFlower /></g></g>
        <g transform="translate(584,184) scale(0.74)"><g {...C('5.5s', '2.2s')}><ChamomileFlower /></g></g>

        <g transform="translate(960,181) scale(0.68)"><g {...C('4.7s', '1.0s')}><ChamomileFlower /></g></g>
        <g transform="translate(974,180) scale(0.76)"><g {...C('5.2s', '3.5s')}><ChamomileFlower /></g></g>

        {/* Rosemary on mid hill */}
        <g transform="translate(458,188) scale(0.64)"><g {...R('5.1s', '0.8s')}><RosemarySprig /></g></g>
        <g transform="translate(472,187) scale(0.72)"><g {...R('4.6s', '2.0s')}><RosemarySprig /></g></g>
        <g transform="translate(1180,182) scale(0.60)"><g {...R('5.4s', '1.4s')}><RosemarySprig /></g></g>
        <g transform="translate(1194,181) scale(0.68)"><g {...R('4.8s', '3.8s')}><RosemarySprig /></g></g>
      </g>

      {/* Front hill */}
      <path d="M0,202 C180,188 420,197 680,188 C920,180 1160,194 1440,185 L1440,220 L0,220 Z" fill={c3} />
      <g fill={c3}>
        <g transform="translate(66,201)  scale(0.70)"><g {...G('2.9s', '1.7s')}><GrassTuft /></g></g>
        <g transform="translate(78,200)  scale(0.86)"><g {...G('3.0s', '0.2s')}><GrassTuft /></g></g>
        <g transform="translate(92,201)  scale(0.76)"><g {...G('3.5s', '0.9s')}><GrassTuft /></g></g>
        <g transform="translate(104,201) scale(0.64)"><g {...G('3.8s', '2.8s')}><GrassTuft /></g></g>

        <g transform="translate(282,197) scale(0.88)"><g {...L('4.5s', '0.1s')}><LavSprig /></g></g>
        <g transform="translate(295,197) scale(1.00)"><g {...L('5.0s', '0.7s')}><LavSprig /></g></g>
        <g transform="translate(308,196) scale(1.08)"><g {...L('4.8s', '1.5s')}><LavSprig /></g></g>
        <g transform="translate(321,197) scale(0.92)"><g {...L('5.4s', '2.4s')}><LavSprig /></g></g>

        <g transform="translate(530,193) scale(0.74)"><g {...G('2.8s', '2.2s')}><GrassTuft /></g></g>
        <g transform="translate(542,192) scale(0.90)"><g {...G('3.3s', '1.2s')}><GrassTuft /></g></g>
        <g transform="translate(556,193) scale(0.80)"><g {...G('3.7s', '0.4s')}><GrassTuft /></g></g>
        <g transform="translate(568,193) scale(0.68)"><g {...G('4.1s', '3.5s')}><GrassTuft /></g></g>

        <g transform="translate(762,186) scale(0.94)"><g {...L('4.9s', '0.5s')}><LavSprig /></g></g>
        <g transform="translate(775,186) scale(1.06)"><g {...L('5.2s', '1.3s')}><LavSprig /></g></g>
        <g transform="translate(788,185) scale(1.12)"><g {...L('4.6s', '2.1s')}><LavSprig /></g></g>
        <g transform="translate(801,186) scale(0.98)"><g {...L('5.6s', '3.0s')}><LavSprig /></g></g>

        <g transform="translate(1006,191) scale(0.72)"><g {...G('4.2s', '2.6s')}><GrassTuft /></g></g>
        <g transform="translate(1018,190) scale(0.88)"><g {...G('3.6s', '0.8s')}><GrassTuft /></g></g>
        <g transform="translate(1032,191) scale(0.78)"><g {...G('3.1s', '1.6s')}><GrassTuft /></g></g>

        <g transform="translate(1228,190) scale(0.90)"><g {...L('4.7s', '0.9s')}><LavSprig /></g></g>
        <g transform="translate(1241,190) scale(1.00)"><g {...L('5.1s', '1.8s')}><LavSprig /></g></g>
        <g transform="translate(1254,189) scale(1.06)"><g {...L('4.4s', '3.2s')}><LavSprig /></g></g>
        <g transform="translate(1267,190) scale(0.86)"><g {...L('5.8s', '4.5s')}><LavSprig /></g></g>

        <g transform="translate(1396,190) scale(0.78)"><g {...G('3.4s', '5.0s')}><GrassTuft /></g></g>
        <g transform="translate(1408,191) scale(0.70)"><g {...G('2.9s', '2.4s')}><GrassTuft /></g></g>

        {/* Chamomile + rosemary on front hill */}
        <g transform="translate(164,200) scale(0.76)"><g {...C('4.9s', '0.4s')}><ChamomileFlower /></g></g>
        <g transform="translate(178,199) scale(0.84)"><g {...C('5.4s', '2.0s')}><ChamomileFlower /></g></g>
        <g transform="translate(192,200) scale(0.70)"><g {...C('4.6s', '4.0s')}><ChamomileFlower /></g></g>

        <g transform="translate(436,195) scale(0.80)"><g {...R('5.2s', '0.9s')}><RosemarySprig /></g></g>
        <g transform="translate(450,194) scale(0.92)"><g {...R('4.7s', '2.5s')}><RosemarySprig /></g></g>
        <g transform="translate(464,195) scale(0.84)"><g {...R('5.6s', '1.6s')}><RosemarySprig /></g></g>

        <g transform="translate(650,190) scale(0.78)"><g {...C('5.0s', '0.1s')}><ChamomileFlower /></g></g>
        <g transform="translate(664,189) scale(0.88)"><g {...C('5.5s', '2.8s')}><ChamomileFlower /></g></g>

        <g transform="translate(878,188) scale(0.82)"><g {...R('4.8s', '1.2s')}><RosemarySprig /></g></g>
        <g transform="translate(892,187) scale(0.94)"><g {...R('5.3s', '3.4s')}><RosemarySprig /></g></g>

        <g transform="translate(1110,190) scale(0.74)"><g {...C('4.5s', '0.5s')}><ChamomileFlower /></g></g>
        <g transform="translate(1124,189) scale(0.82)"><g {...C('5.1s', '2.2s')}><ChamomileFlower /></g></g>

        <g transform="translate(1320,190) scale(0.78)"><g {...R('5.0s', '1.8s')}><RosemarySprig /></g></g>
        <g transform="translate(1334,189) scale(0.86)"><g {...R('4.6s', '3.6s')}><RosemarySprig /></g></g>
      </g>
    </>
  )

  return (
    <>
      <svg className="login-ph-horizon--day" viewBox="0 0 1440 220"
        preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {scene('rgba(34,197,94,0.22)', 'rgba(22,163,74,0.52)', 'rgba(15,130,58,0.72)')}
      </svg>
      <svg className="login-ph-horizon--night" viewBox="0 0 1440 220"
        preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {scene('rgba(2,38,26,0.76)', 'rgba(2,30,20,0.88)', 'rgba(1,18,12,0.96)')}
      </svg>
    </>
  )
}

/* Golden pollen / spores drifting upward — gives the scene life */
function PharmacyPollenDeco() {
  const dots = [
    { l: '8%', b: '24%', s: 3.2, dur: '8.5s', del: '0.0s' },
    { l: '16%', b: '20%', s: 2.5, dur: '11.0s', del: '1.8s' },
    { l: '27%', b: '27%', s: 2.0, dur: '9.2s', del: '3.5s' },
    { l: '37%', b: '22%', s: 3.5, dur: '7.8s', del: '5.2s' },
    { l: '50%', b: '29%', s: 2.8, dur: '12.5s', del: '2.1s' },
    { l: '60%', b: '21%', s: 2.2, dur: '10.0s', del: '4.0s' },
    { l: '71%', b: '26%', s: 3.0, dur: '8.0s', del: '0.7s' },
    { l: '82%', b: '23%', s: 2.6, dur: '13.0s', del: '2.9s' },
    { l: '91%', b: '27%', s: 2.0, dur: '9.8s', del: '1.4s' },
    { l: '43%', b: '32%', s: 4.0, dur: '6.5s', del: '3.8s' },
    { l: '22%', b: '31%', s: 2.5, dur: '14.0s', del: '6.0s' },
    { l: '67%', b: '31%', s: 3.0, dur: '11.5s', del: '0.3s' },
  ]
  return (
    <div className="login-ph-pollen" aria-hidden="true">
      {dots.map((d, i) => (
        <span key={i} className="ph-pollen-dot" style={{
          left: d.l, bottom: d.b,
          width: d.s + 'px', height: d.s + 'px',
          animationDuration: d.dur, animationDelay: d.del
        }} />
      ))}
    </div>
  )
}

/* Leaves drifting on the wind — 5 leaves, varied sizes/colors/directions */
function PharmacyLeavesDeco() {
  const leaf = (color, stemColor) => (
    <>
      <path d="M9,19 C3,13 1,5 4,1 C6,-3 12,-3 15,1 C18,5 15,13 9,19 Z" fill={color} />
      <line x1="9" y1="19" x2="9" y2="1" stroke={stemColor} strokeWidth="0.9" />
    </>
  )
  return (
    <>
      <svg className="login-ph-leaf login-ph-leaf-1" width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
        {leaf('rgba(5,150,105,0.60)', 'rgba(3,100,72,0.40)')}
      </svg>
      <svg className="login-ph-leaf login-ph-leaf-2" width="13" height="16" viewBox="0 0 18 22" aria-hidden="true">
        {leaf('rgba(16,185,129,0.52)', 'rgba(4,120,87,0.34)')}
      </svg>
      <svg className="login-ph-leaf login-ph-leaf-3" width="11" height="14" viewBox="0 0 18 22" aria-hidden="true">
        {leaf('rgba(20,184,166,0.50)', 'rgba(10,150,135,0.32)')}
      </svg>
      <svg className="login-ph-leaf login-ph-leaf-4" width="16" height="20" viewBox="0 0 18 22" aria-hidden="true">
        {leaf('rgba(5,150,105,0.55)', 'rgba(3,100,72,0.36)')}
      </svg>
      <svg className="login-ph-leaf login-ph-leaf-5" width="15" height="18" viewBox="0 0 18 22" aria-hidden="true">
        {leaf('rgba(52,211,153,0.48)', 'rgba(16,150,100,0.30)')}
      </svg>
    </>
  )
}

/* Healing wisps — Oogway's sacred tree energy rising from the botanical garden */
function PharmacyWispsDeco() {
  const wisps = [
    { l: '6%', b: '22%', s: 28, blur: 13, color: 'rgba(255,230,140,0.20)', dur: '14s', del: '0.0s' },
    { l: '20%', b: '18%', s: 18, blur: 9, color: 'rgba(52,211,153,0.18)', dur: '10s', del: '2.5s' },
    { l: '33%', b: '25%', s: 36, blur: 15, color: 'rgba(200,240,255,0.14)', dur: '18s', del: '1.0s' },
    { l: '50%', b: '20%', s: 22, blur: 10, color: 'rgba(255,220,100,0.16)', dur: '12s', del: '4.0s' },
    { l: '65%', b: '24%', s: 30, blur: 12, color: 'rgba(16,185,129,0.18)', dur: '15s', del: '0.5s' },
    { l: '82%', b: '18%', s: 16, blur: 8, color: 'rgba(52,211,153,0.20)', dur: '9s', del: '3.0s' },
    { l: '46%', b: '30%', s: 44, blur: 18, color: 'rgba(220,255,230,0.12)', dur: '22s', del: '7.0s' },
    { l: '14%', b: '30%', s: 20, blur: 9, color: 'rgba(255,240,180,0.16)', dur: '11s', del: '5.0s' },
    { l: '74%', b: '28%', s: 24, blur: 11, color: 'rgba(180,255,220,0.14)', dur: '16s', del: '2.0s' },
  ]
  return (
    <div className="login-ph-wisps" aria-hidden="true">
      {wisps.map((w, i) => (
        <span key={i} className="ph-wisp" style={{
          left: w.l, bottom: w.b,
          width: w.s + 'px', height: w.s + 'px',
          filter: `blur(${w.blur}px)`,
          background: w.color,
          animationDuration: w.dur,
          animationDelay: w.del
        }} />
      ))}
    </div>
  )
}

/* ── Night mountain mist — atmospheric fog wisps over the ridgeline ─── */

function NightMistDeco() {
  const wisps = [
    { l: '4%',  b: '18%', w: 200, h: 28, blur: 26, dur: '18s', del: '0.0s' },
    { l: '20%', b: '15%', w: 155, h: 22, blur: 20, dur: '14s', del: '3.5s' },
    { l: '38%', b: '19%', w: 240, h: 32, blur: 30, dur: '22s', del: '1.2s' },
    { l: '60%', b: '16%', w: 170, h: 25, blur: 22, dur: '16s', del: '5.0s' },
    { l: '78%', b: '18%', w: 130, h: 20, blur: 18, dur: '12s', del: '2.4s' },
    { l: '50%', b: '22%', w: 280, h: 38, blur: 34, dur: '26s', del: '7.5s' },
    { l: '12%', b: '22%', w: 120, h: 18, blur: 16, dur: '11s', del: '4.8s' },
    { l: '68%', b: '21%', w: 190, h: 26, blur: 24, dur: '19s', del: '0.8s' },
    { l: '86%', b: '16%', w: 110, h: 17, blur: 15, dur: '10s', del: '6.2s' },
  ]
  return (
    <div className="login-night-mist" aria-hidden="true">
      {wisps.map((w, i) => (
        <span key={i} className="night-mist-wisp" style={{
          left: w.l, bottom: w.b,
          width: w.w + 'px', height: w.h + 'px',
          filter: `blur(${w.blur}px)`,
          animationDuration: w.dur,
          animationDelay: w.del,
        }} />
      ))}
    </div>
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
      {/* EKG line draws in on loop */}
      <path d="M43 110 L50 110 L53 100 L57 120 L61 100 L65 110 L72 110 L78 110"
        stroke="rgba(255,255,255,0.92)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <animate attributeName="stroke-dasharray" from="0 130" to="130 0" dur="2s" begin="0s" repeatCount="indefinite" />
      </path>
      {/* Glow ring pulses at the heartbeat spike (fires ~44% into each 2s cycle) */}
      <circle cx="60" cy="110" r="16" stroke="rgba(180,210,255,0.85)" fill="none" strokeWidth="1.2"
        className="hb-ring" />
    </svg>
  )
}

function IlloPharmacy() {
  return (
    <svg width="120" height="130" viewBox="0 0 120 130" fill="none" aria-hidden="true">
      {/* Pharmacy cross */}
      <rect x="48" y="6" width="24" height="58" rx="12"
        fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.60)" strokeWidth="2.5" />
      <rect x="18" y="24" width="84" height="24" rx="12"
        fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.60)" strokeWidth="2.5" />
      <rect x="48" y="24" width="24" height="24" fill="rgba(255,255,255,0.20)" />
      {/* Pulse ring at cross center — like hb-ring on doctor */}
      <circle cx="60" cy="36" r="20" stroke="rgba(180,255,220,0.82)" fill="none" strokeWidth="1.4"
        className="ph-ring" />
      {/* Dispensing particle — drops from cross bottom to capsule */}
      <circle cx="60" r="2.2" fill="rgba(255,255,255,0.82)">
        <animate attributeName="cy" values="66;82" dur="1.8s" begin="-0.9s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animate attributeName="opacity" values="0;0.88;0.88;0"
          keyTimes="0;0.15;0.78;1" dur="1.8s" begin="-0.9s" repeatCount="indefinite"/>
      </circle>
      {/* Pill capsule */}
      <rect x="14" y="84" width="92" height="36" rx="18"
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.90)" strokeWidth="2.5" />
      <path d="M32,84 L60,84 L60,120 L32,120 Q14,120 14,102 Q14,84 32,84 Z"
        fill="rgba(255,255,255,0.28)" />
      <line x1="60" y1="84" x2="60" y2="120" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      {/* Pills — staggered pulse like pills being counted */}
      <circle cx="80" cy="102" r="3" fill="rgba(255,255,255,0.42)">
        <animate attributeName="opacity" values="0.38;0.94;0.38" dur="2.0s" begin="0s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="r" values="3;4.2;3" dur="2.0s" begin="0s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </circle>
      <circle cx="91" cy="102" r="3" fill="rgba(255,255,255,0.42)">
        <animate attributeName="opacity" values="0.38;0.94;0.38" dur="2.0s" begin="0.44s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="r" values="3;4.2;3" dur="2.0s" begin="0.44s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </circle>
      <circle cx="102" cy="102" r="3" fill="rgba(255,255,255,0.42)">
        <animate attributeName="opacity" values="0.38;0.94;0.38" dur="2.0s" begin="0.88s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
        <animate attributeName="r" values="3;4.2;3" dur="2.0s" begin="0.88s"
          repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1"/>
      </circle>
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

/* ── Time-of-day icon ────────────────────────────────────────────────── */

function TimeIcon({ hour }) {
  if (hour >= 21 || hour < 5) return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="login-time-icon">
      <path d="M11.5 9.5A6 6 0 1 1 4.5 2.5a4.5 4.5 0 0 0 7 7z" fill="currentColor" opacity="0.75" />
    </svg>
  )
  if (hour < 12) return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="login-time-icon">
      <circle cx="7" cy="8" r="2.8" fill="currentColor" opacity="0.82" />
      <line x1="7" y1="1" x2="7" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      <line x1="2.5" y1="3.6" x2="3.8" y2="4.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <line x1="11.5" y1="3.6" x2="10.2" y2="4.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <line x1="0.5" y1="8" x2="2.3" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <line x1="11.7" y1="8" x2="13.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <path d="M1 12.5 Q7 6.5 13 12.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.38" />
    </svg>
  )
  if (hour < 17) return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="login-time-icon">
      <circle cx="7" cy="7" r="2.8" fill="currentColor" opacity="0.88" />
      <line x1="7" y1="0.5" x2="7" y2="2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
      <line x1="7" y1="11.7" x2="7" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
      <line x1="0.5" y1="7" x2="2.3" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
      <line x1="11.7" y1="7" x2="13.5" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
      <line x1="2.2" y1="2.2" x2="3.5" y2="3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.52" />
      <line x1="10.5" y1="10.5" x2="11.8" y2="11.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.52" />
      <line x1="11.8" y1="2.2" x2="10.5" y2="3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.52" />
      <line x1="2.2" y1="11.8" x2="3.5" y2="10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.52" />
    </svg>
  )
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="login-time-icon">
      <path d="M2 9.5 Q7 3 12 9.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65" />
      <circle cx="7" cy="9.5" r="2.4" fill="currentColor" opacity="0.82" />
      <line x1="7" y1="1.2" x2="7" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.48" />
      <line x1="1.5" y1="5.2" x2="3" y2="6.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="12.5" y1="5.2" x2="11" y2="6.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="0" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="0.9" opacity="0.32" />
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

const ROLE_NAMES = { doctor: 'Doctor', pharmacy: 'Pharmacist' }

export default function LoginPage() {
  const { login, token, user, loading } = useAuth()
  const navigate = useNavigate()

  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mounted, setMounted] = useState(false)
  const [role, setRole] = useState('doctor')
  const [greeting] = useState(() => getGreeting())
  const [hour] = useState(() => new Date().getHours())
  const [dayStr] = useState(() => getDayStr())
  const [quote, setQuote] = useState(randomQuote)
  const [clinicName, setClinicName] = useState('Clinora')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [welcomeUser, setWelcomeUser] = useState(null)
  const [mountComplete, setMountComplete] = useState(false)
  const [displayedRole, setDisplayedRole] = useState('')
  const [quoteKey, setQuoteKey] = useState(0)
  const [dots, setDots] = useState([])
  const nextDotId = useRef(0)
  const cardRef = useRef(null)

  const [sessionExpired] = useState(() => {
    const flag = sessionStorage.getItem('session_expired')
    if (flag) sessionStorage.removeItem('session_expired')
    return flag
  })

  useEffect(() => {
    let t2
    const t = setTimeout(() => {
      setMounted(true)
      t2 = setTimeout(() => setMountComplete(true), 750)
    }, 200)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [])

  function handleCardMouseMove(e) {
    if (!mountComplete || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    cardRef.current.style.transform = `perspective(1200px) rotateX(${-dy * 3}deg) rotateY(${dx * 5}deg)`
    cardRef.current.style.transition = 'transform 0.08s linear'
  }

  function handleCardMouseLeave() {
    if (!cardRef.current) return
    cardRef.current.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)'
    cardRef.current.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1)'
  }

  useEffect(() => {
    invoke('get_public_clinic_name').then(n => setClinicName(n)).catch(() => { })
  }, [])

  useEffect(() => {
    if (showPassword) return
    setDots(prev => {
      const active = prev.filter(d => !d.exiting)
      const diff = password.length - active.length
      if (diff > 0) {
        const added = Array.from({ length: diff }, () => ({ id: nextDotId.current++, exiting: false }))
        return [...prev, ...added]
      }
      if (diff < 0) {
        const toExit = new Set(active.slice(diff).map(d => d.id))
        return prev.map(d => toExit.has(d.id) ? { ...d, exiting: true } : d)
      }
      return prev
    })
  }, [password, showPassword])

  useEffect(() => {
    setQuote(randomQuote())
    setQuoteKey(k => k + 1)
    setError('')
    const target = ROLE_NAMES[role]
    let i = 0
    setDisplayedRole('')
    const iv = setInterval(() => {
      i++
      setDisplayedRole(target.slice(0, i))
      if (i >= target.length) clearInterval(iv)
    }, 60)
    return () => clearInterval(iv)
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

  const canSubmit = email.trim() && password && !submitting
  const isPharmacy = role === 'pharmacy'

  return (
    <div className={`login-scene${mounted ? ' login-scene--mounted' : ''}`} data-theme={isDark ? 'dark' : 'light'} data-role={role}>

      {/* Theme toggle */}
      <button className="login-theme-toggle" onClick={() => setIsDark(d => !d)}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      {/* Doctor scene */}
      <SunDeco />
      <div className="login-dr-sun-wash" aria-hidden="true" />
      <div className="login-dr-horizon-glow" aria-hidden="true" />
      <CloudsDeco />
      <BirdsDeco />
      <StarsDeco />
      <MoonDeco />
      <NorthernLightsDeco />

      {/* Pharmacy day — morning sun + sun-ray wash */}
      <PharmacySunDeco />
      <div className="login-ph-sun-wash" aria-hidden="true" />

      {/* Pharmacy botanical horizon + healing wisps + pollen + drifting leaves + butterflies */}
      <PharmacyHorizonDeco />
      <PharmacyWispsDeco />
      <PharmacyPollenDeco />
      <PharmacyLeavesDeco />
      <PharmacyButterflyDeco />

      {/* Doctor floral/mountain horizon + petal drift + night mountain mist */}
      <DoctorHorizonDeco />
      <DoctorPetalDeco />
      <NightMistDeco />

      {/* Card */}
      <div className="login-card" ref={cardRef} onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>

        {/* Left brand panel */}
        <div className={`login-brand${isPharmacy ? ' login-brand--pharmacy' : ''}`}>
          <div className="login-brand-morph" aria-hidden="true" />
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

          <div key={quoteKey} className="login-brand-quote">
            <p className="login-brand-quote-text">"{quote.text}"</p>
            {quote.author && <span className="login-brand-quote-author">— {quote.author}</span>}
          </div>
        </div>

        {/* Right — greeting */}
        <div className="login-welcome">
          <p className="login-welcome-greeting">
            <TimeIcon hour={hour} />
            {greeting}
          </p>
          <h2 className={`login-welcome-role login-welcome-role--${role}`}>
            {displayedRole}
            {displayedRole.length < ROLE_NAMES[role].length && (
              <span className="login-cursor" aria-hidden="true">|</span>
            )}
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

          <div className="login-float-group">
            <svg className="login-field-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <input id="email" className="login-float-field" type="email" autoComplete="email"
              placeholder=" " required value={email}
              onChange={e => setEmail(e.target.value)} disabled={submitting} />
            <label htmlFor="email" className="login-float-label">Email address</label>
          </div>

          <div className="login-float-group">
            <svg className="login-field-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <input
              id="password"
              className={`login-float-field login-float-field--eye${!showPassword ? ' login-float-field--masked' : ''}`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder=" "
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={submitting}
            />
            {!showPassword && dots.length > 0 && (
              <div className="login-pwd-dots" aria-hidden="true">
                {dots.map(d => (
                  <span
                    key={d.id}
                    className={`login-pwd-dot${d.exiting ? ' login-pwd-dot--out' : ''}`}
                    onAnimationEnd={d.exiting ? () => setDots(p => p.filter(x => x.id !== d.id)) : undefined}
                  />
                ))}
              </div>
            )}
            <label htmlFor="password" className="login-float-label">Password</label>
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

          {error && (
            <div role="alert" className="form-alert danger">
              <p className="form-alert-body">{error}</p>
            </div>
          )}

          <button type="submit" className={`login-submit-btn login-submit-btn--${role}${submitting ? ' login-submit-btn--loading' : ''}`} disabled={!canSubmit}>
            {submitting ? <Spinner size={20} /> : 'Sign in'}
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
