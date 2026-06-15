import { ENEMY_DISPLAY_INFO } from '../game/wave.js'

/**
 * WavePreviewPanel — shows the upcoming wave's enemy composition during between-waves.
 *
 * Props:
 *   waveNumber — upcoming wave number (number)
 *   preview    — { enemies: [{type, count, hp}], isBoss: bool, tip: string }
 *                as returned by getWavePreview()
 */
function WavePreviewPanel({ waveNumber, preview }) {
  if (!preview) return null

  const { enemies, isBoss, tip } = preview

  return (
    <div className="wave-preview-panel">
      <div className="wave-preview-header">
        WAVE {waveNumber} INCOMING
      </div>
      {isBoss && (
        <div className="wave-preview-boss-badge">⚠ BOSS WAVE</div>
      )}
      <ul className="wave-preview-enemy-list">
        {enemies.map(({ type, count, hp }) => {
          const info = ENEMY_DISPLAY_INFO[type] ?? { label: type, icon: '❓' }
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
    </div>
  )
}

export default WavePreviewPanel
