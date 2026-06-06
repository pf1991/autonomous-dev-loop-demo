function GameOver({ result, onRestart }) {
  const message = result === 'win' ? 'You Win! 🎉' : 'Game Over 💀'
  return (
    <div className="game-over-overlay">
      <div className="game-over-box">
        <h1 className="game-over-message">{message}</h1>
        <button className="game-over-restart" onClick={onRestart}>
          Restart
        </button>
      </div>
    </div>
  )
}

export default GameOver
