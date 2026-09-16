import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/games.css'

const COLS = 10, ROWS = 20, CELL = 28
const W = COLS * CELL, H = ROWS * CELL
const PW = 4 * CELL, PH = 4 * CELL  // preview canvas

const PIECES = [
  { shape: [[1,1,1,1]],               color: '#06b6d4' }, // I
  { shape: [[1,1],[1,1]],             color: '#eab308' }, // O
  { shape: [[0,1,0],[1,1,1]],         color: '#a855f7' }, // T
  { shape: [[0,1,1],[1,1,0]],         color: '#22c55e' }, // S
  { shape: [[1,1,0],[0,1,1]],         color: '#ef4444' }, // Z
  { shape: [[1,0,0],[1,1,1]],         color: '#3b82f6' }, // J
  { shape: [[0,0,1],[1,1,1]],         color: '#f97316' }, // L
]

const LINE_PTS  = [0, 100, 300, 500, 800]
const BASE_SPEED = { easy: 750, medium: 450, hard: 220 }

function rotate(s) { return s[0].map((_,ci) => s.map(r => r[ci]).reverse()) }
function emptyGrid() { return Array.from({length:ROWS}, () => Array(COLS).fill(null)) }
function randPiece() {
  const p = PIECES[Math.floor(Math.random()*PIECES.length)]
  return { shape: p.shape, color: p.color, x: Math.floor(COLS/2)-Math.floor(p.shape[0].length/2), y: 0 }
}
function fits(grid, piece, dx=0, dy=0, shape=null) {
  const s = shape || piece.shape
  for (let r=0; r<s.length; r++) {
    for (let c=0; c<s[r].length; c++) {
      if (!s[r][c]) continue
      const nx = piece.x+c+dx, ny = piece.y+r+dy
      if (nx<0||nx>=COLS||ny>=ROWS) return false
      if (ny>=0 && grid[ny][nx]) return false
    }
  }
  return true
}
function merge(grid, piece) {
  const g = grid.map(r=>[...r])
  piece.shape.forEach((row,r) => row.forEach((v,c) => { if(v) g[piece.y+r][piece.x+c] = piece.color }))
  return g
}
function clearLines(grid) {
  const kept = grid.filter(row => row.some(c=>!c))
  const n = ROWS - kept.length
  return { grid: [...Array.from({length:n},()=>Array(COLS).fill(null)), ...kept], cleared: n }
}

function initState(diff) {
  return { grid: emptyGrid(), cur: randPiece(), next: randPiece(), score:0, lines:0, level:1, diff }
}

export default function TetrisGame() {
  const canvasRef  = useRef(null)
  const prevRef    = useRef(null)
  const G          = useRef(null)
  const navigate   = useNavigate()

  const [diff,    setDiff]    = useState('medium')
  const [status,  setStatus]  = useState('idle')
  const [score,   setScore]   = useState(0)
  const [lines,   setLines]   = useState(0)
  const [level,   setLevel]   = useState(1)
  const [hiScore, setHiScore] = useState(() => parseInt(localStorage.getItem('clinora-tetris-hi')||'0'))

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !G.current) return
    const ctx = canvas.getContext('2d')
    const { grid, cur } = G.current

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // Grid lines
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    for (let x=0; x<=COLS; x++) { ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,H); ctx.stroke() }
    for (let y=0; y<=ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(W,y*CELL); ctx.stroke() }

    // Ghost piece
    let ghostY = cur.y
    while (fits(grid, cur, 0, ghostY-cur.y+1)) ghostY++
    ctx.globalAlpha = 0.2
    cur.shape.forEach((row,r) => row.forEach((v,c) => {
      if (!v) return
      ctx.fillStyle = cur.color
      ctx.fillRect((cur.x+c)*CELL+1, (ghostY+r)*CELL+1, CELL-2, CELL-2)
    }))
    ctx.globalAlpha = 1

    // Placed cells
    grid.forEach((row,r) => row.forEach((color,c) => {
      if (!color) return
      drawCell(ctx, c*CELL, r*CELL, color)
    }))

    // Current piece
    cur.shape.forEach((row,r) => row.forEach((v,c) => {
      if (!v) return
      drawCell(ctx, (cur.x+c)*CELL, (cur.y+r)*CELL, cur.color)
    }))
  }, [])

  const drawPreview = useCallback(() => {
    const canvas = prevRef.current
    if (!canvas || !G.current) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, PW, PH)
    const { next } = G.current
    const ox = Math.floor((4-next.shape[0].length)/2)*CELL
    const oy = Math.floor((4-next.shape.length)/2)*CELL
    next.shape.forEach((row,r) => row.forEach((v,c) => {
      if (!v) return
      drawCell(ctx, ox+c*CELL, oy+r*CELL, next.color)
    }))
  }, [])

  function drawCell(ctx, x, y, color) {
    ctx.fillStyle = color
    ctx.fillRect(x+1, y+1, CELL-2, CELL-2)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(x+1, y+1, CELL-2, 4)
    ctx.fillRect(x+1, y+1, 4, CELL-2)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(x+1, y+CELL-4, CELL-2, 3)
    ctx.fillRect(x+CELL-4, y+1, 3, CELL-2)
  }

  const lock = useCallback(() => {
    const g = G.current
    const merged = merge(g.grid, g.cur)
    const { grid: newGrid, cleared } = clearLines(merged)
    const newScore = g.score + LINE_PTS[cleared] * g.level + (cleared ? 0 : 0)
    const newLines = g.lines + cleared
    const newLevel = Math.floor(newLines/10)+1
    const next2    = randPiece()
    const newCur   = { ...g.next, x: Math.floor(COLS/2)-Math.floor(g.next.shape[0].length/2), y: 0 }

    if (!fits(newGrid, newCur)) {
      // game over
      g.score = newScore
      const hi = parseInt(localStorage.getItem('clinora-tetris-hi')||'0')
      if (newScore > hi) { localStorage.setItem('clinora-tetris-hi', String(newScore)); setHiScore(newScore) }
      setStatus('dead')
      return
    }

    g.grid  = newGrid
    g.cur   = newCur
    g.next  = next2
    g.score = newScore
    g.lines = newLines
    g.level = newLevel
    setScore(newScore)
    setLines(newLines)
    setLevel(newLevel)
    drawBoard()
    drawPreview()
  }, [drawBoard, drawPreview])

  const drop = useCallback(() => {
    const g = G.current
    if (fits(g.grid, g.cur, 0, 1)) {
      g.cur.y++
      drawBoard()
    } else {
      lock()
    }
  }, [drawBoard, lock])

  // game loop
  useEffect(() => {
    if (status !== 'running' || !G.current) return
    const speed = Math.max(BASE_SPEED[G.current.diff] - (G.current.level-1)*35, 60)
    const id = setInterval(drop, speed)
    return () => clearInterval(id)
  }, [status, drop, level])

  // keyboard
  useEffect(() => {
    function onKey(e) {
      if (!G.current || status !== 'running') {
        if ((e.key===' '||e.key==='Escape') && status==='paused') { e.preventDefault(); setStatus('running') }
        return
      }
      const g = G.current
      if (e.key==='ArrowLeft')  { e.preventDefault(); if(fits(g.grid,g.cur,-1,0)){g.cur.x--;drawBoard()} }
      if (e.key==='ArrowRight') { e.preventDefault(); if(fits(g.grid,g.cur,1,0)){g.cur.x++;drawBoard()} }
      if (e.key==='ArrowDown')  { e.preventDefault(); drop() }
      if (e.key===' ') {
        e.preventDefault()
        // hard drop
        while (fits(g.grid,g.cur,0,1)) { g.cur.y++; g.score+=2 }
        lock()
      }
      if (e.key==='ArrowUp') {
        e.preventDefault()
        const rot = rotate(g.cur.shape)
        if (fits(g.grid,g.cur,0,0,rot)) { g.cur.shape=rot; drawBoard() }
        else if (fits(g.grid,g.cur,1,0,rot)) { g.cur.x++; g.cur.shape=rot; drawBoard() }
        else if (fits(g.grid,g.cur,-1,0,rot)) { g.cur.x--; g.cur.shape=rot; drawBoard() }
      }
      if (e.key==='Escape') { e.preventDefault(); setStatus('paused') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, drop, drawBoard, lock])

  useEffect(() => { drawBoard(); drawPreview() }, [drawBoard, drawPreview, status])

  function startGame() {
    G.current = initState(diff)
    setScore(0); setLines(0); setLevel(1); setStatus('running')
    requestAnimationFrame(() => { drawBoard(); drawPreview() })
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="game-back-btn" onClick={() => navigate(-1)}>← Games</button>
        <h2 className="game-title">Tetris</h2>
      </div>

      {status === 'idle' && (
        <div className="game-difficulty-row">
          {['easy','medium','hard'].map(d => (
            <button key={d} className={`diff-btn${diff===d?' diff-btn--active':''}`}
              onClick={() => setDiff(d)}>{d[0].toUpperCase()+d.slice(1)}</button>
          ))}
        </div>
      )}

      <div className="tetris-wrap">
        <div className="game-canvas-wrap">
          <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />
          {status === 'idle' && (
            <div className="game-overlay">
              <div className="game-overlay-content">
                <div className="game-overlay-emoji">🧱</div>
                <h3>Tetris</h3>
                <p>Stack blocks, clear lines!</p>
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

        <div className="tetris-side">
          <div className="tetris-side-box">
            <span className="tetris-side-label">Score</span>
            <span className="tetris-side-val">{score}</span>
          </div>
          <div className="tetris-side-box">
            <span className="tetris-side-label">Lines</span>
            <span className="tetris-side-val">{lines}</span>
          </div>
          <div className="tetris-side-box">
            <span className="tetris-side-label">Level</span>
            <span className="tetris-side-val">{level}</span>
          </div>
          <div className="tetris-side-box">
            <span className="tetris-side-label">Best</span>
            <span className="tetris-side-val">{hiScore}</span>
          </div>
          <div className="tetris-side-box">
            <span className="tetris-side-label">Next</span>
            <canvas ref={prevRef} width={PW} height={PH} style={{width:'100%',display:'block',marginTop:4}} />
          </div>
        </div>
      </div>

      <div className="game-controls-hint">
        <span>← → move</span>
        <span>↑ rotate</span>
        <span>↓ soft drop</span>
        <span>Space hard drop</span>
        <span>Esc pause</span>
      </div>
    </div>
  )
}
