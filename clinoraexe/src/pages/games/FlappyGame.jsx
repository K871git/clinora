import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/games.css'

const W = 320, H = 480
const BIRD_X   = 65
const GRAVITY  = 0.38
const FLAP_VEL = -7.2
const BIRD_R   = 14

const DIFF = {
  easy:   { gap: 165, speed: 2.2, interval: 100 },
  medium: { gap: 135, speed: 3.2, interval: 88  },
  hard:   { gap: 105, speed: 4.6, interval: 72  },
}

function initState(diff) {
  return {
    birdY:  H / 2,
    birdV:  0,
    pipes:  [],
    score:  0,
    frame:  0,
    diff,
  }
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r, y)
  ctx.lineTo(x+w-r, y)
  ctx.quadraticCurveTo(x+w, y, x+w, y+r)
  ctx.lineTo(x+w, y+h-r)
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h)
  ctx.lineTo(x+r, y+h)
  ctx.quadraticCurveTo(x, y+h, x, y+h-r)
  ctx.lineTo(x, y+r)
  ctx.quadraticCurveTo(x, y, x+r, y)
  ctx.closePath()
}

export default function FlappyGame() {
  const canvasRef = useRef(null)
  const G         = useRef(null)
  const rafRef    = useRef(null)
  const navigate  = useNavigate()

  const [diff,    setDiff]    = useState('medium')
  const [status,  setStatus]  = useState('idle')
  const [score,   setScore]   = useState(0)
  const [hiScore, setHiScore] = useState(() => parseInt(localStorage.getItem('clinora-flappy-hi')||'0'))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !G.current) return
    const ctx  = canvas.getContext('2d')
    const g    = G.current
    const dcfg = DIFF[g.diff]

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#0ea5e9')
    sky.addColorStop(1, '#7dd3fc')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Ground
    ctx.fillStyle = '#92400e'
    ctx.fillRect(0, H-40, W, 40)
    ctx.fillStyle = '#a3e635'
    ctx.fillRect(0, H-40, W, 8)

    // Pipes
    const pw = 52
    g.pipes.forEach(p => {
      const topH   = p.topH
      const botY   = topH + dcfg.gap
      const botH   = H - 40 - botY

      // top pipe
      const tg = ctx.createLinearGradient(p.x, 0, p.x+pw, 0)
      tg.addColorStop(0, '#16a34a'); tg.addColorStop(0.5, '#22c55e'); tg.addColorStop(1, '#15803d')
      ctx.fillStyle = tg
      drawRoundRect(ctx, p.x, 0, pw, topH-4, 4); ctx.fill()
      ctx.fillStyle = '#15803d'
      drawRoundRect(ctx, p.x-4, topH-18, pw+8, 18, 4); ctx.fill()

      // bottom pipe
      const bg = ctx.createLinearGradient(p.x, 0, p.x+pw, 0)
      bg.addColorStop(0, '#16a34a'); bg.addColorStop(0.5, '#22c55e'); bg.addColorStop(1, '#15803d')
      ctx.fillStyle = bg
      drawRoundRect(ctx, p.x, botY+14, pw, botH, 4); ctx.fill()
      ctx.fillStyle = '#15803d'
      drawRoundRect(ctx, p.x-4, botY, pw+8, 18, 4); ctx.fill()
    })

    // Bird
    const bx = BIRD_X, by = g.birdY
    const angle = Math.min(Math.max(g.birdV * 3, -30), 60)
    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate((angle * Math.PI) / 180)

    // Body
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.ellipse(0, 0, BIRD_R, BIRD_R-2, 0, 0, Math.PI*2)
    ctx.fill()

    // Wing
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.ellipse(-2, 3, 8, 5, -0.3, 0, Math.PI*2)
    ctx.fill()

    // Eye
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(6, -4, 5, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.arc(7, -4, 2.5, 0, Math.PI*2); ctx.fill()

    // Beak
    ctx.fillStyle = '#f97316'
    ctx.beginPath()
    ctx.moveTo(BIRD_R-2, -2)
    ctx.lineTo(BIRD_R+7, 0)
    ctx.lineTo(BIRD_R-2, 3)
    ctx.closePath()
    ctx.fill()

    ctx.restore()

    // Score overlay
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.roundRect?.(W/2-28, 14, 56, 32, 8); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 22px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(g.score, W/2, 37)
  }, [])

  const step = useCallback(() => {
    const g   = G.current
    const cfg = DIFF[g.diff]

    g.birdV += GRAVITY
    g.birdY += g.birdV
    g.frame++

    // spawn pipes
    if (g.frame % cfg.interval === 0) {
      const minTop = 60, maxTop = H - 40 - cfg.gap - 60
      const topH   = Math.floor(Math.random()*(maxTop-minTop)+minTop)
      g.pipes.push({ x: W+10, topH, scored: false })
    }

    // move pipes
    g.pipes.forEach(p => { p.x -= cfg.speed })
    g.pipes = g.pipes.filter(p => p.x > -70)

    // score
    const pw = 52
    g.pipes.forEach(p => {
      if (!p.scored && p.x + pw < BIRD_X) {
        p.scored = true
        g.score++
        setScore(g.score)
        const hi = parseInt(localStorage.getItem('clinora-flappy-hi')||'0')
        if (g.score > hi) { localStorage.setItem('clinora-flappy-hi', String(g.score)); setHiScore(g.score) }
      }
    })

    // collision — ground / ceiling
    if (g.birdY + BIRD_R > H - 40 || g.birdY - BIRD_R < 0) {
      setStatus('dead'); return false
    }

    // collision — pipes
    const gap = cfg.gap
    for (const p of g.pipes) {
      if (BIRD_X + BIRD_R - 6 > p.x && BIRD_X - BIRD_R + 6 < p.x + pw) {
        if (g.birdY - BIRD_R + 4 < p.topH || g.birdY + BIRD_R - 4 > p.topH + gap) {
          setStatus('dead'); return false
        }
      }
    }

    draw()
    return true
  }, [draw])

  const loop = useCallback(() => {
    if (!step()) return
    rafRef.current = requestAnimationFrame(loop)
  }, [step])

  useEffect(() => {
    if (status === 'running') {
      rafRef.current = requestAnimationFrame(loop)
    } else {
      cancelAnimationFrame(rafRef.current)
      draw()
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [status, loop, draw])

  // tap/click to flap
  useEffect(() => {
    function flap(e) {
      if (e.key && e.key !== ' ') return
      e.preventDefault()
      if (status === 'running' && G.current) G.current.birdV = FLAP_VEL
      if (status === 'idle') startGame()
    }
    window.addEventListener('keydown', flap)
    return () => window.removeEventListener('keydown', flap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function handleCanvasClick() {
    if (status === 'running' && G.current) G.current.birdV = FLAP_VEL
    if (status === 'idle') startGame()
  }

  function startGame() {
    G.current = initState(diff)
    setScore(0)
    setStatus('running')
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="game-back-btn" onClick={() => navigate(-1)}>← Games</button>
        <h2 className="game-title">Flappy Bird</h2>
      </div>

      <div className="game-stats">
        <div className="game-stat"><span>Score</span><strong>{score}</strong></div>
        <div className="game-stat"><span>Best</span><strong>{hiScore}</strong></div>
      </div>

      {status === 'idle' && (
        <div className="game-difficulty-row">
          {['easy','medium','hard'].map(d => (
            <button key={d} className={`diff-btn${diff===d?' diff-btn--active':''}`}
              onClick={() => setDiff(d)}>{d[0].toUpperCase()+d.slice(1)}</button>
          ))}
        </div>
      )}

      <div className="game-canvas-wrap" onClick={handleCanvasClick} style={{cursor:'pointer'}}>
        <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />

        {status === 'idle' && (
          <div className="game-overlay">
            <div className="game-overlay-content">
              <div className="game-overlay-emoji">🐦</div>
              <h3>Flappy Bird</h3>
              <p>Tap or press Space to fly!</p>
              <button className="game-play-btn" onClick={e => {e.stopPropagation(); startGame()}}>Play</button>
            </div>
          </div>
        )}
        {status === 'dead' && (
          <div className="game-overlay">
            <div className="game-overlay-content">
              <div className="game-overlay-emoji">💀</div>
              <h3>Game Over</h3>
              <p>Score: <strong style={{color:'#fff'}}>{score}</strong></p>
              {score > 0 && score >= hiScore && <p className="game-new-best">🏆 New Best!</p>}
              <button className="game-play-btn" onClick={e => {e.stopPropagation(); startGame()}}>Play Again</button>
              <button className="game-play-btn game-play-btn--ghost"
                onClick={e => {e.stopPropagation(); cancelAnimationFrame(rafRef.current); setStatus('idle')}}>
                Menu
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="game-controls-hint">
        <span>Click / Space — flap</span>
        <span>Dodge the green pipes</span>
      </div>
    </div>
  )
}
