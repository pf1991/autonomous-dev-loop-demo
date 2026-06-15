/**
 * NextWave — shown before wave 1 to let the player start the game.
 * Props:
 *   wave       — wave number about to start (number)
 *   enemyCount — number of enemies in this wave (number)
 *   enemyHp    — HP per enemy (number)
 *   onStart    — callback invoked when Start is clicked
 */
function NextWave({ wave, enemyCount = 5, enemyHp = 100, onStart }) {
  return (
    <div className="next-wave-overlay">
      <div className="next-wave-box">
        <h2 className="next-wave-message">Wave {wave} incoming</h2>
        <p className="next-wave-info">{enemyCount} enemies &middot; {enemyHp} HP each</p>
        <button className="next-wave-start" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  )
}

export default NextWave
