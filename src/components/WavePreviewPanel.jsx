import { useState, useEffect } from 'react'
import { ENEMY_DISPLAY_INFO } from '../game/wave.js'

/**
 * WavePreviewPanel — shows the upcoming wave's enemy composition during between-waves.
 * Rendered as a fixed overlay so it floats above the game without shifting layout.
 *
 * Props:
 *   visible    — true while the between-waves phase is active; false triggers exit animation
 *   waveNumber — upcoming wave number (number)
 *   preview    — { enemies: [{type, count, hp}], isBoss: bool, tip: string }
 *                as returned by getWavePreview()
 *   onStart    — callback invoked when the player clicks "Start Wave"
 */
function WavePreviewPanel({ visible, waveNumber, preview, onStart }) {
  // 'entering' | 'visible' | 'exiting' | 'hidden'
  const [phase, setPhase] = useState(visible ? 'visible' : 'hidden')

  useEffect(() => {
    if (visible) {
      setPhase('visible')
    } else {
      // Only animate out if we were previously shown
      setPhase(prev => (prev === 'hidden' ? 'hidden' : 'exiting'))
    }
  }, [visible])

  function handleAnimationEnd() {
    if (phase === 'exiting') {
      setPhase('hidden')
    }
  }

  if (phase === 'hidden' || !preview) return null

  const { enemies, isBoss, tip } = preview

  return (
    <div className="wave-preview-overlay">
      <div
        className={`wave-preview-panel${phase === 'exiting' ? ' wave-preview-panel--exit' : ''}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="wave-preview-header">
          WAVE {waveNumber} INCOMING
        </div>
        {isBoss && (
          <div className="wave-preview-boss-badge">&#9888; BOSS WAVE</div>
        )}
        <ul className="wave-preview-enemy-list">
          {enemies.map(({ type, count, hp }) => {
            const info = ENEMY_DISPLAY_INFO[type] ?? { label: type, icon: '?' }
            return (
              <li key={type} className="wave-preview-enemy-row">
                <span className="wave-preview-enemy-icon">{info.icon}</span>
                <span className="wave-preview-enemy-label">
                  {info.label} ×{count}
                </span>
                <span className="wave-preview-enemy-hp">HP: {hp}</span>
              </li>
            )
          })}
        </ul>
        {tip && (
          <div className="wave-preview-tip">
            Tip: {tip}
          </div>
        )}
        <button className="wave-preview-start-btn" onClick={onStart}>
          Start Wave
        </button>
      </div>
    </div>
  )
}

export default WavePreviewPanel
