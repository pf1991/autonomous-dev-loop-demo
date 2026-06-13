/**
 * HUD — Heads-up display showing live game stats, a speed toggle button,
 * and a persistent Restart button.
 * Props:
 *   lives                — current player lives (number)
 *   gold                 — current gold (number)
 *   wave                 — current wave number (number)
 *   speed                — current speed multiplier (1, 2, or 5)
 *   onSpeedToggle        — callback invoked when the speed button is clicked
 *   onRestart            — callback invoked when the Restart button is clicked
 *   showNextWave         — whether to show the "Next Wave" early-call button (bool)
 *   earlyWaveDisabled    — whether the early-call button is already used this wave (bool)
 *   onNextWaveEarly      — callback invoked when the player calls next wave early
 *   endlessMode          — whether endless mode is active (bool)
 *   comboCount           — current combo kill count (number, ≥ 0; 0 = no active combo)
 *   comboLabel           — label text for current combo tier (string)
 *   comboBonus           — bonus gold per kill for current combo (number)
 *   comboVisible         — whether the combo banner should be visible (bool)
 *   unlockedAchievements — array of unlocked achievement IDs (string[])
 *   totalAchievements    — total achievement count (number, default 12)
 *   onAchievementClick   — callback when the trophy button is clicked
 *   difficultyLabel      — display label of the selected difficulty (string)
 *   difficultyColor      — CSS colour for the difficulty pill (string)
 */
function HUD({
  lives,
  gold,
  wave,
  speed,
  onSpeedToggle,
  onRestart,
  showNextWave,
  earlyWaveDisabled,
  onNextWaveEarly,
  endlessMode = false,
  comboCount = 0,
  comboLabel = '',
  comboBonus = 0,
  comboVisible = false,
  unlockedAchievements = [],
  totalAchievements = 12,
  onAchievementClick,
  difficultyLabel = '',
  difficultyColor = '#e0e0e0',
}) {
  const isRampage = comboCount >= 5

  return (
    <div className="hud">
      <span className="hud-lives">Lives: {lives}</span>
      <span className="hud-gold">Gold: {gold}</span>
      <span className="hud-wave">Wave: {wave}</span>
      {difficultyLabel && (
        <span
          className="hud-difficulty-pill"
          style={{ background: difficultyColor }}
        >
          {difficultyLabel}
        </span>
      )}
      {endlessMode && <span className="hud-endless-badge">ENDLESS</span>}
      {comboVisible && comboCount >= 2 && (
        <span className={`combo-banner${isRampage ? ' combo-banner--rampage' : ''}`}>
          {comboCount}× {comboLabel} +{comboBonus}g
        </span>
      )}
      {showNextWave && (
        <button
          className="hud-next-wave"
          onClick={onNextWaveEarly}
          disabled={earlyWaveDisabled}
        >
          Next Wave Early
        </button>
      )}
      <button
        className="hud-achievement-btn"
        onClick={onAchievementClick}
        title="Achievements"
      >
        🏆 {unlockedAchievements.length}/{totalAchievements}
      </button>
      <button className="hud-restart" onClick={onRestart}>
        Restart
      </button>
      <button className="hud-speed" onClick={onSpeedToggle}>
        {speed === 5 ? '5×' : speed === 2 ? '2×' : '1×'}
      </button>
    </div>
  )
}

export default HUD
