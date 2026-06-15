import { useState } from 'react'
import { loadLeaderboard, clearLeaderboard } from '../utils/leaderboard'

/**
 * GameOver — shown when the game ends (lives reach 0).
 *
 * Props:
 *   score           — final score (number | null)
 *   onRestart       — callback to restart the game
 *   wavesReached    — highest wave number reached this run (number)
 *   prestigeStars   — current prestige star count (0–5)
 *   onPrestige      — callback invoked when player clicks "Prestige" button
 */
function GameOver({ score, onRestart, wavesReached = 0, prestigeStars = 0, onPrestige }) {
  const [leaderboard, setLeaderboard] = useState(() => loadLeaderboard())

  function handleClearScores() {
    setLeaderboard(clearLeaderboard())
  }

  // Prestige is available when: wave 20+ reached and star cap not hit
  const prestigeAvailable = wavesReached >= 20 && prestigeStars < 5

  return (
    <div className="game-over-overlay">
      <div className="game-over-box">
        <h1 className="game-over-message">Game Over 💀</h1>
        <p className="game-over-waves">You survived {wavesReached} {wavesReached === 1 ? 'wave' : 'waves'}</p>
        {score !== null && score !== undefined && (
          <p className="final-score">Final Score: {score}</p>
        )}
        {prestigeAvailable && (
          <div className="prestige-offer">
            <p className="prestige-offer-text">
              You survived wave {wavesReached}!
            </p>
            <button className="prestige-btn" onClick={onPrestige}>
              ⭐ Prestige — Earn a Star
            </button>
            <p className="prestige-offer-hint">
              Saves a prestige star and unlocks bonuses on your next run.
            </p>
          </div>
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
