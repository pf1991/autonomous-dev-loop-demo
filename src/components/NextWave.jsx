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
