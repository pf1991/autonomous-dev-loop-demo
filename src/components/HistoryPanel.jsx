import { useState, useEffect, useCallback } from 'react'
import { loadHistory } from '../utils/sessionHistory.js'

/**
 * HistoryPanel — fixed overlay showing the player's last 20 sessions.
 *
 * Props:
 *   onClose          — callback invoked when the panel is dismissed (✕ button or Escape)
 *   currentHash      — 8-char hex string for the active level, used to mark the current session (string | undefined)
 */
function HistoryPanel({ onClose, currentHash }) {
  const [history, setHistory] = useState(() => loadHistory())
  const [selectedIdx, setSelectedIdx] = useState(null)

  // Refresh history each time the panel opens (mounts)
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function handlePlayAgain() {
    if (selectedIdx === null) return
    const entry = history[selectedIdx]
    window.location.hash = `seed=${entry.hash}`
    window.location.reload()
  }

  function formatDate(playedAt) {
    try {
      return new Date(playedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="history-panel-overlay" role="dialog" aria-modal="true" aria-label="Previous Sessions">
      <div className="history-panel">
        <div className="history-panel-header">
          <h2 className="history-panel-title">Previous Sessions</h2>
          <button
            className="history-panel-close"
            onClick={onClose}
            aria-label="Close history panel"
          >
            ✕
          </button>
        </div>

        {history.length === 0 ? (
          <p className="history-panel-empty">
            No previous sessions yet. Play a level to start your history.
          </p>
        ) : (
          <>
            <div className="history-panel-table-wrapper">
              <table className="history-panel-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Score</th>
                    <th>Wave</th>
                    <th>Difficulty</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, idx) => {
                    const isCurrent = currentHash && entry.hash === currentHash
                    const isSelected = selectedIdx === idx
                    return (
                      <tr
                        key={`${entry.hash}-${entry.playedAt}`}
                        className={`history-panel-row${isSelected ? ' history-panel-row--selected' : ''}${isCurrent ? ' history-panel-row--current' : ''}`}
                        onClick={() => setSelectedIdx(isSelected ? null : idx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedIdx(isSelected ? null : idx)
                        }}
                      >
                        <td className="history-panel-cell history-panel-cell--hash">
                          #{entry.hash}
                          {isCurrent && <span className="history-panel-current-star" aria-label="Current session"> ★</span>}
                        </td>
                        <td className="history-panel-cell history-panel-cell--score">
                          {entry.score.toLocaleString()}
                        </td>
                        <td className="history-panel-cell history-panel-cell--wave">
                          W{entry.maxWave}
                        </td>
                        <td className="history-panel-cell history-panel-cell--difficulty">
                          {entry.difficulty ?? 'normal'}
                        </td>
                        <td className="history-panel-cell history-panel-cell--date">
                          {formatDate(entry.playedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="history-panel-footer">
              <button
                className="history-panel-play-again"
                onClick={handlePlayAgain}
                disabled={selectedIdx === null}
              >
                Play again ↗
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default HistoryPanel
