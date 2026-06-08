/**
 * NextWave — shown before wave 1 to let the player start the game.
 * Props:
 *   wave            — wave number about to start (number)
 *   enemyCount      — number of enemies in this wave (number)
 *   enemyHp         — HP per enemy (number)
 *   onStart         — callback invoked when Start is clicked
 *   endlessMode     — whether endless mode is active (bool) [only wave 1]
 *   onToggleEndless — callback to toggle endless mode (only shown on wave 1)
 */
function NextWave({ wave, enemyCount = 5, enemyHp = 100, onStart, endlessMode = false, onToggleEndless }) {
  return (
    <div className="next-wave-overlay">
      <div className="next-wave-box">
        <h2 className="next-wave-message">Wave {wave} incoming</h2>
        <p className="next-wave-info">{enemyCount} enemies &middot; {enemyHp} HP each</p>
        {onToggleEndless && (
          <label className="endless-mode-toggle">
            <input
              type="checkbox"
              checked={endlessMode}
              onChange={onToggleEndless}
              className="endless-mode-checkbox"
            />
            <span className="endless-mode-label">Endless Mode</span>
          </label>
        )}
        <button className="next-wave-start" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  )
}

export default NextWave
