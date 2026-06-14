import { getDifficultyConfig, DIFFICULTY_MODES } from '../game/difficulty'

/**
 * DifficultySelector — full-screen overlay shown before wave 1 (and after restart)
 * to let the player choose a difficulty mode.
 *
 * Props:
 *   onSelect        — callback(mode: string) invoked when the player picks a difficulty
 *   availableModes  — optional array of mode strings to show (defaults to DIFFICULTY_MODES)
 */
function DifficultySelector({ onSelect, availableModes }) {
  const modes = availableModes ?? DIFFICULTY_MODES
  return (
    <div className="difficulty-overlay">
      <div className="difficulty-box">
        <h2 className="difficulty-title">Choose Your Difficulty</h2>
        <div className="difficulty-grid">
          {modes.map(mode => {
            const cfg = getDifficultyConfig(mode)
            return (
              <button
                key={mode}
                className={`difficulty-btn difficulty-btn--${mode}`}
                style={{ borderColor: cfg.color }}
                onClick={() => onSelect(mode)}
              >
                <span className="difficulty-btn-label" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                <span className="difficulty-btn-flavour">{cfg.flavour}</span>
                <span className="difficulty-btn-stats">
                  <span>Gold: {cfg.startingGold}</span>
                  <span>Lives: {cfg.startingLives}</span>
                  <span>Score ×{cfg.scoreMultiplier}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default DifficultySelector
