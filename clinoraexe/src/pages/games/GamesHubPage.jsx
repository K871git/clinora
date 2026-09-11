import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/games.css'

const GAMES = [
  {
    key: 'snake',
    emoji: '🐍',
    name: 'Snake',
    desc: 'Eat food, grow longer, avoid the walls and yourself.',
    hi: 'clinora-snake-hi',
  },
  {
    key: 'tetris',
    emoji: '🧱',
    name: 'Tetris',
    desc: 'Stack falling blocks, clear lines, beat your high score.',
    hi: 'clinora-tetris-hi',
  },
  {
    key: 'flappy',
    emoji: '🐦',
    name: 'Flappy Bird',
    desc: 'Tap to fly, dodge the pipes, see how far you can go.',
    hi: 'clinora-flappy-hi',
  },
]

export default function GamesHubPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const base = user?.role === 'pharmacy' ? '/pharmacy/games' : '/games'

  return (
    <div className="games-hub">
      <h1 className="games-hub-title">Game Room</h1>
      <p className="games-hub-sub">Take a quick break — refresh your mind between patients.</p>
      <div className="games-grid">
        {GAMES.map(g => {
          const hi = parseInt(localStorage.getItem(g.hi) || '0')
          return (
            <button
              key={g.key}
              className="game-card"
              onClick={() => navigate(`${base}/${g.key}`)}
            >
              <div className="game-card-emoji">{g.emoji}</div>
              <div className="game-card-name">{g.name}</div>
              <div className="game-card-desc">{g.desc}</div>
              <div className="game-card-hi">Best: <strong>{hi || '—'}</strong></div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
