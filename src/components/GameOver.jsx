import { useState } from 'react'
import { loadLeaderboard, clearLeaderboard } from '../utils/leaderboard'

function GameOver({ result, score, onRestart }) {
  const message = result === 'win' ? 'You Win! 🎉' : 'Game Over 💀'
  const [leaderboard, setLeaderboard] = useState(() => loadLeaderboard())

  function handleClearScores() {
    setLeaderboard(clearLeaderboard())
  }

  return (
    <div className="game-over-overlay">
      <div className="game-over-box">
        <h1 className="game-over-message">{message}</h1>
        {score !== null && score !== undefined && (
          <p className="final-score">Final Score: {score}</p>
        )}
        <button className="game-over-restart" onClick={onRestart}>
          Restart
        </button>
        <div className="leaderboard">
          <h2 className="leaderboard-title">Top Scores</h2>
          {leaderboard.length === 0 ? (
            <p className="leaderboard-empty">No scores yet.</p>
          ) : (
            <ol className="leaderboard-list">
              {leaderboard.map((entry, i) => (
                <li key={i} className="leaderboard-entry">
                  <span className="leaderboard-rank">#{i + 1}</span>
                  <span className="leaderboard-score">{entry.score}</span>
                  <span className="leaderboard-result">{entry.result === 'win' ? '🏆' : '💀'}</span>
                  <span className="leaderboard-date">{entry.date}</span>
                </li>
              ))}
            </ol>
          )}
          <button className="leaderboard-clear-btn" onClick={handleClearScores}>
            Clear scores
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameOver
