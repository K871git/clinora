import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/games.css'

const W = 380, H = 540
const BIRD_X   = 78
const GRAVITY  = 0.40
const FLAP_VEL = -7.6
const BIRD_R   = 16
const GROUND   = H - 48

const DIFF = {
  easy:   { gap: 170, speed: 2.2, interval: 100 },
  medium: { gap: 140, speed: 3.2, interval: 88  },
  hard:   { gap: 108, speed: 4.6, interval: 72  },
}

function initState(diff) {
  return {
    birdY: H / 2,
    birdV: 0,
    pipes: [],
    score: 0,
    frame: 0,
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
    sky.addColorStop(0, '#075985')
    sky.addColorStop(0.6, '#0ea5e9')
    sky.addColorStop(1, '#7dd3fc')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Distant background hills
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath()
    ctx.ellipse(80, GROUND, 120, 55, 0, 0, Math.PI)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(260, GROUND, 100, 45, 0, 0, Math.PI)
    ctx.fill()

    // Pipes
    const pw = 54
    g.pipes.forEach(p => {
      const topH = p.topH
      const botY  = topH + dcfg.gap
      const botH  = GROUND - botY

      const tg = ctx.createLinearGradient(p.x, 0, p.x+pw, 0)
      tg.addColorStop(0, '#15803d'); tg.addColorStop(0.4, '#22c55e'); tg.addColorStop(1, '#14532d')
      ctx.fillStyle = tg
      drawRoundRect(ctx, p.x, 0, pw, topH-6, 5); ctx.fill()
      ctx.fillStyle = '#15803d'
      drawRoundRect(ctx, p.x-5, topH-20, pw+10, 20, 5); ctx.fill()

      const bg = ctx.createLinearGradient(p.x, 0, p.x+pw, 0)
      bg.addColorStop(0, '#15803d'); bg.addColorStop(0.4, '#22c55e'); bg.addColorStop(1, '#14532d')
      ctx.fillStyle = bg
      drawRoundRect(ctx, p.x, botY+18, pw, botH, 5); ctx.fill()
      ctx.fillStyle = '#15803d'
      drawRoundRect(ctx, p.x-5, botY, pw+10, 20, 5); ctx.fill()
    })

    // Ground
    ctx.fillStyle = '#78350f'
    ctx.fillRect(0, GROUND, W, H - GROUND)
    ctx.fillStyle = '#84cc16'
    ctx.fillRect(0, GROUND, W, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, GROUND, W, 2)

    // Bird
    const bx = BIRD_X, by = g.birdY
    const angle = Math.min(Math.max(g.birdV * 3, -28), 65)
    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate((angle * Math.PI) / 180)

    // Body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(2, 2, BIRD_R, BIRD_R-2, 0, 0, Math.PI*2)
    ctx.fill()

    // Body
    const bodyGrd = ctx.createRadialGradient(-3, -3, 2, 0, 0, BIRD_R)
    bodyGrd.addColorStop(0, '#fde68a')
    bodyGrd.addColorStop(1, '#f59e0b')
    ctx.fillStyle = bodyGrd
    ctx.beginPath()
    ctx.ellipse(0, 0, BIRD_R, BIRD_R-2, 0, 0, Math.PI*2)
    ctx.fill()

    // Wing
    ctx.fillStyle = '#d97706'
    ctx.beginPath()
    ctx.ellipse(-2, 4, 9, 5, -0.3, 0, Math.PI*2)
    ctx.fill()

    // White of eye
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(6, -5, 5.5, 0, Math.PI*2); ctx.fill()
    // Pupil
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.arc(7.5, -5, 2.8, 0, Math.PI*2); ctx.fill()
    // Eye shine
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(8.5, -6.5, 1, 0, Math.PI*2); ctx.fill()

    // Beak
    ctx.fillStyle = '#ea580c'
    ctx.beginPath()
    ctx.moveTo(BIRD_R-2, -3)
    ctx.lineTo(BIRD_R+8, 0)
    ctx.lineTo(BIRD_R-2, 4)
    ctx.closePath()
    ctx.fill()

    ctx.restore()

    // Score overlay
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(W/2-32, 16, 64, 34, 10); ctx.fill()
    } else {
      ctx.fillRect(W/2-32, 16, 64, 34)
    }
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(g.score, W/2, 40)
    ctx.textAlign = 'left'
  }, [])

  const step = useCallback(() => {
    const g   = G.current
    const cfg = DIFF[g.diff]

    g.birdV += GRAVITY
    g.birdY += g.birdV
    g.frame++

    if (g.frame % cfg.interval === 0) {
      const minTop = 60, maxTop = GROUND - cfg.gap - 60
      const topH   = Math.floor(Math.random()*(maxTop-minTop)+minTop)
      g.pipes.push({ x: W+10, topH, scored: false })
    }

    g.pipes.forEach(p => { p.x -= cfg.speed })
    g.pipes = g.pipes.filter(p => p.x > -80)

    const pw = 54
    g.pipes.forEach(p => {
      if (!p.scored && p.x + pw < BIRD_X) {
        p.scored = true
        g.score++
        setScore(g.score)
        const hi = parseInt(localStorage.getItem('clinora-flappy-hi')||'0')
        if (g.score > hi) { localStorage.setItem('clinora-flappy-hi', String(g.score)); setHiScore(g.score) }
      }
    })

    if (g.birdY + BIRD_R > GROUND || g.birdY - BIRD_R < 0) {
      setStatus('dead'); return false
    }

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

      <div className="fg-layout">
        {/* Canvas */}
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

        {/* Side panel */}
        <div className="gs-panel">
          <div className="gs-stat">
            <span className="gs-label">Score</span>
            <span className="gs-val gs-val--cyan">{score}</span>
          </div>
          <div className="gs-stat">
            <span className="gs-label">Best</span>
            <span className="gs-val gs-val--yellow">{hiScore}</span>
          </div>

          {status === 'idle' && (
            <div className="gs-diff">
              <span className="gs-label" style={{paddingLeft:2}}>Difficulty</span>
              {['easy','medium','hard'].map(d => (
                <button
                  key={d}
                  className={`diff-btn gs-diff-btn${diff===d?' diff-btn--active':''}`}
                  onClick={() => setDiff(d)}
                >
                  {d[0].toUpperCase()+d.slice(1)}
                </button>
              ))}
            </div>
          )}

          <div className="gs-controls">
            <span className="gs-controls-title">Controls</span>
            Click / Space — flap<br/>
            Dodge the green pipes!
          </div>
        </div>
      </div>
    </div>
  )
}
