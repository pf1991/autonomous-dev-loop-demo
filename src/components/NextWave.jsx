function NextWave({ wave, onStart }) {
  return (
    <div className="next-wave-overlay">
      <div className="next-wave-box">
        <h2 className="next-wave-message">Wave {wave} incoming</h2>
        <button className="next-wave-start" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  )
}

export default NextWave
