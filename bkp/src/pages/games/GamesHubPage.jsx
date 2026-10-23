import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/games.css'

const GAMES = [
  {
    key:    'snake',
    emoji:  '🐍',
    name:   'Snake',
    desc:   'Guide your hungry snake across the grid. Every meal makes you longer — and one wrong turn ends it all.',
    genres: ['Classic', 'Reflex'],
    hi:     'clinora-snake-hi',
  },
  {
    key:    'tetris',
    emoji:  '🧱',
    name:   'Tetris',
    desc:   'Rotate, drop, stack. Clear lines before the pile reaches the top — one perfect row at a time.',
    genres: ['Strategy', 'Puzzle'],
    hi:     'clinora-tetris-hi',
  },
  {
    key:    'flappy',
    emoji:  '🐦',
    name:   'Flappy Bird',
    desc:   'One tap to fly, gravity to fight. Time every flap perfectly and squeeze past each pipe.',
    genres: ['Casual', 'Rhythm'],
    hi:     'clinora-flappy-hi',
  },
]

export default function GamesHubPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const base = user?.role === 'pharmacy' ? '/pharmacy/games' : '/games'

  return (
    <div className="ghr-page">

      {/* Header */}
      <div className="ghr-header">
        <div>
          <h1 className="ghr-title">
            <span className="ghr-title-icon">🎮</span>
            Game Room
          </h1>
          <p className="ghr-sub">Take a breather between patients — your mind deserves a break too.</p>
        </div>
        {user?.role === 'doctor' && <span className="ghr-lounge-badge">Doctor's Lounge</span>}
      </div>

      {/* Game cards */}
      <div className="ghr-grid">
        {GAMES.map(g => {
          const hi = parseInt(localStorage.getItem(g.hi) || '0')
          return (
            <button
              key={g.key}
              className={`ghr-card ghr-card--${g.key}`}
              onClick={() => navigate(`${base}/${g.key}`)}
            >
              {/* Color band at top */}
              <div className="ghr-band">
                <span className="ghr-emoji">{g.emoji}</span>
              </div>

              {/* Card body */}
              <div className="ghr-body">
                <div className="ghr-name">{g.name}</div>
                <p className="ghr-desc">{g.desc}</p>
                <div className="ghr-genres">
                  {g.genres.map(t => (
                    <span key={t} className="ghr-genre">{t}</span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="ghr-footer">
                <div className="ghr-score">
                  {hi > 0
                    ? <><span>🏆</span> Best: <strong>{hi.toLocaleString()}</strong></>
                    : <span className="ghr-unplayed">Not played yet</span>
                  }
                </div>
                <span className="ghr-play-cta">Play Now →</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer tip */}
      <p className="ghr-tip">Press <kbd>Esc</kbd> inside any game to pause &amp; return here.</p>
    </div>
  )
}
