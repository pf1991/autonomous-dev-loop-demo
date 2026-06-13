import { useState, useEffect, useRef } from 'react'

/**
 * WaveCountdownBanner — non-blocking in-game countdown strip.
 * Shown between waves (wave > 1). Counts down 3→2→1 at 1-second intervals,
 * then calls onStart. The player may also click "Start Now" to skip.
 * Rendered inside .game-board-wrapper so it does not block the board tiles.
 *
 * eventType: 'normal' | 'horde' | 'elite' | 'stealth' — drives the banner styling.
 */
function WaveCountdownBanner({ wave, enemyCount = 5, enemyHp = 100, isBossWave = false, eventType = 'normal', onStart }) {
  const [countdown, setCountdown] = useState(3)
  const firedRef = useRef(false)
  // Hold latest onStart in a ref so the countdown effect is not sensitive to
  // reference changes caused by the parent re-rendering on every game-loop tick.
  const onStartRef = useRef(onStart)
  useEffect(() => { onStartRef.current = onStart }, [onStart])

  useEffect(() => {
    // Reset state whenever the banner appears for a new wave
    setCountdown(3)
    firedRef.current = false
  }, [wave])

  useEffect(() => {
    if (firedRef.current) return
    if (countdown <= 0) {
      firedRef.current = true
      onStartRef.current()
      return
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  function handleStartNow() {
    if (firedRef.current) return
    firedRef.current = true
    onStartRef.current()
  }

  const eventClass = eventType !== 'normal' ? ` wave-countdown-banner--${eventType}` : ''
  const EVENT_LABELS = {
    horde:   '⚡ HORDE WAVE — Brace yourself!',
    elite:   '💀 ELITE WAVE — Hardened enemies incoming',
    stealth: "👁 STEALTH WAVE — You can't see them... but they're there",
  }

  return (
    <div className={`wave-countdown-banner${isBossWave ? ' wave-countdown-banner--boss' : ''}${eventClass}`}>
      {isBossWave && (
        <span className="wave-countdown-boss-label">&#9888; BOSS WAVE</span>
      )}
      {eventType !== 'normal' && EVENT_LABELS[eventType] && (
        <span className={`wave-countdown-event-label wave-countdown-event-label--${eventType}`}>
          {EVENT_LABELS[eventType]}
        </span>
      )}
      <span className="wave-countdown-text">
        Wave {wave} in {countdown}&hellip;
      </span>
      <span className="wave-countdown-info">
        {enemyCount} enemies &middot; {enemyHp} HP each
      </span>
      <button className="wave-countdown-start-now" onClick={handleStartNow}>
        Start Now
      </button>
    </div>
  )
}

export default WaveCountdownBanner
