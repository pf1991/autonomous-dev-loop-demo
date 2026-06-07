import { useState, useEffect, useRef } from 'react'

/**
 * WaveCountdownBanner — non-blocking in-game countdown strip.
 * Shown between waves (wave > 1). Counts down 3→2→1 at 1-second intervals,
 * then calls onStart. The player may also click "Start Now" to skip.
 * Rendered inside .game-board-wrapper so it does not block the board tiles.
 */
function WaveCountdownBanner({ wave, onStart }) {
  const [countdown, setCountdown] = useState(3)
  const firedRef = useRef(false)

  useEffect(() => {
    // Reset state whenever the banner appears for a new wave
    setCountdown(3)
    firedRef.current = false
  }, [wave])

  useEffect(() => {
    if (firedRef.current) return
    if (countdown <= 0) {
      firedRef.current = true
      onStart()
      return
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown, onStart])

  function handleStartNow() {
    if (firedRef.current) return
    firedRef.current = true
    onStart()
  }

  return (
    <div className="wave-countdown-banner">
      <span className="wave-countdown-text">
        Wave {wave} in {countdown}&hellip;
      </span>
      <button className="wave-countdown-start-now" onClick={handleStartNow}>
        Start Now
      </button>
    </div>
  )
}

export default WaveCountdownBanner
