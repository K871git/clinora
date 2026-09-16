import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/games.css'

const COLS = 20, ROWS = 20, CELL = 22
const W = COLS * CELL, H = ROWS * CELL

const DIRS = {
  ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
  w: {x:0,y:-1}, s: {x:0,y:1}, a: {x:-1,y:0}, d: {x:1,y:0},
}
const BASE_SPEED = { easy: 185, medium: 105, hard: 58 }

function randFood(snake) {
  let p
  do { p = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) } }
  while (snake.some(s => s.x===p.x && s.y===p.y))
  return p
}

function initState() {
  const snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}]
  return { snake, food: randFood(snake), dir:{x:1,y:0}, nextDir:{x:1,y:0}, score:0, level:1, eaten:0 }
}

export default function SnakeGame() {
  const canvasRef   = useRef(null)
  const G           = useRef(initState())
  const navigate    = useNavigate()

  const [diff,    setDiff]    = useState('medium')
  const [status,  setStatus]  = useState('idle')
  const [score,   setScore]   = useState(0)
  const [level,   setLevel]   = useState(1)
  const [hiScore, setHiScore] = useState(() => parseInt(localStorage.getItem('clinora-snake-hi')||'0'))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const g = G.current

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // subtle grid
    ctx.fillStyle = '#1e293b'
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        ctx.fillRect(x*CELL+CELL/2-1, y*CELL+CELL/2-1, 2, 2)

    // food — pulsing red circle
    ctx.fillStyle = '#ef4444'
    ctx.shadowColor = '#ef4444'
    ctx.shadowBlur  = 8
    ctx.beginPath()
    ctx.arc(g.food.x*CELL+CELL/2, g.food.y*CELL+CELL/2, CELL/2-2, 0, Math.PI*2)
    ctx.fill()
    ctx.shadowBlur = 0

    // snake
    g.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#22c55e' : `rgba(34,197,94,${Math.max(0.35, 0.9 - i*0.03)})`
      const pad = i === 0 ? 1 : 2
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2, 4)
      else ctx.rect(seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2)
      ctx.fill()
    })
  }, [])

  const tick = useCallback(() => {
    const g = G.current
    g.dir = g.nextDir
    const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y }

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        g.snake.some(s => s.x===head.x && s.y===head.y)) {
      setStatus('dead')
      return false
    }

    const ate = head.x===g.food.x && head.y===g.food.y
    if (ate) {
      g.snake = [head, ...g.snake]
      g.food  = randFood(g.snake)
      g.eaten++
      g.score += 10 * g.level
      if (g.eaten % 5 === 0) g.level = Math.min(g.level + 1, 10)
      setScore(g.score)
      setLevel(g.level)
      const hi = parseInt(localStorage.getItem('clinora-snake-hi')||'0')
      if (g.score > hi) {
        localStorage.setItem('clinora-snake-hi', String(g.score))
        setHiScore(g.score)
      }
    } else {
      g.snake = [head, ...g.snake.slice(0,-1)]
    }
    draw()
    return true
  }, [draw])

  // game loop
  useEffect(() => {
    if (status !== 'running') return
    const speed = Math.max(BASE_SPEED[diff] - (G.current.level - 1) * 10, 38)
    const id = setInterval(() => { if (!tick()) clearInterval(id) }, speed)
    return () => clearInterval(id)
  }, [status, diff, tick, level])

  // keyboard
  useEffect(() => {
    function onKey(e) {
      const d = DIRS[e.key] || DIRS[e.key.toLowerCase()]
      if (d) {
        e.preventDefault()
        const cur = G.current.dir
        if (d.x !== -cur.x || d.y !== -cur.y) G.current.nextDir = d
      }
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        setStatus(s => s === 'running' ? 'paused' : s === 'paused' ? 'running' : s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { draw() }, [draw, status])

  function startGame() {
    G.current = initState()
    setScore(0); setLevel(1); setStatus('running')
    requestAnimationFrame(draw)
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="game-back-btn" onClick={() => navigate(-1)}>← Games</button>
        <h2 className="game-title">Snake</h2>
      </div>

      <div className="game-stats">
        <div className="game-stat"><span>Score</span><strong>{score}</strong></div>
        <div className="game-stat"><span>Level</span><strong>{level}</strong></div>
        <div className="game-stat"><span>Best</span><strong>{hiScore}</strong></div>
      </div>

      {status === 'idle' && (
        <div className="game-difficulty-row">
          {['easy','medium','hard'].map(d => (
            <button key={d} className={`diff-btn${diff===d?' diff-btn--active':''}`}
              onClick={() => setDiff(d)}>
              {d[0].toUpperCase()+d.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="game-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />

        {status === 'idle' && (
          <div className="game-overlay">
            <div className="game-overlay-content">
              <div className="game-overlay-emoji">🐍</div>
              <h3>Snake</h3>
              <p>Eat food, grow longer, don't crash!</p>
              <button className="game-play-btn" onClick={startGame}>Play</button>
            </div>
          </div>
        )}
        {status === 'paused' && (
          <div className="game-overlay">
            <div className="game-overlay-content">
              <h3>Paused</h3>
              <button className="game-play-btn" onClick={() => setStatus('running')}>Resume</button>
              <button className="game-play-btn game-play-btn--ghost" onClick={startGame}>Restart</button>
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
              <button className="game-play-btn" onClick={startGame}>Play Again</button>
              <button className="game-play-btn game-play-btn--ghost" onClick={() => setStatus('idle')}>Menu</button>
            </div>
          </div>
        )}
      </div>

      <div className="game-controls-hint">
        <span>Arrow keys / WASD — move</span>
        <span>Space / Esc — pause</span>
      </div>
    </div>
  )
}
