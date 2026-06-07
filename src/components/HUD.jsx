/**
 * HUD — Heads-up display showing live game stats, a speed toggle button,
 * and a persistent Restart button.
 * Props:
 *   lives         — current player lives (number)
 *   gold          — current gold (number)
 *   wave          — current wave number (number)
 *   speed         — current speed multiplier (1 or 2)
 *   onSpeedToggle — callback invoked when the speed button is clicked
 *   onRestart     — callback invoked when the Restart button is clicked
 */
function HUD({ lives, gold, wave, speed, onSpeedToggle, onRestart }) {
  return (
    <div className="hud">
      <span className="hud-lives">Lives: {lives}</span>
      <span className="hud-gold">Gold: {gold}</span>
      <span className="hud-wave">Wave: {wave}</span>
      <button className="hud-restart" onClick={onRestart}>
        Restart
      </button>
      <button className="hud-speed" onClick={onSpeedToggle}>
        {speed === 1 ? '1×' : '2×'}
      </button>
    </div>
  )
}

export default HUD
