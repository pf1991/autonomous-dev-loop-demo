import { ENEMY_DISPLAY_INFO } from '../game/wave.js'

/**
 * WavePreviewPanel — shows the upcoming wave's enemy composition during between-waves.
 * Rendered as a fixed overlay so it floats above the game without shifting layout.
 *
 * Props:
 *   waveNumber — upcoming wave number (number)
 *   preview    — { enemies: [{type, count, hp}], isBoss: bool, tip: string }
 *                as returned by getWavePreview()
 *   onStart    — callback invoked when the player clicks "Start Wave"
 */
function WavePreviewPanel({ waveNumber, preview, onStart }) {
  if (!preview) return null

  const { enemies, isBoss, tip } = preview

  return (
    <div className="wave-preview-overlay">
      <div className="wave-preview-panel">
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
