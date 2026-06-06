/**
 * useGameLoop — React hook that drives a game loop via requestAnimationFrame.
 * Calls onTick(deltaMs * speed) on every animation frame.
 */
import { useEffect, useRef } from 'react'

/**
 * @param {(scaledDeltaMs: number) => void} onTick - Called each frame with the scaled delta
 * @param {number} speed - Time multiplier applied to the raw delta (default 1)
 */
export function useGameLoop(onTick, speed = 1) {
  const onTickRef = useRef(onTick)
  const speedRef = useRef(speed)

  // Keep refs up to date so the RAF callback always sees the latest values
  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    let rafId
    let lastTimestamp = null

    function frame(timestamp) {
      if (lastTimestamp !== null) {
        const deltaMs = timestamp - lastTimestamp
        onTickRef.current(deltaMs * speedRef.current)
      }
      lastTimestamp = timestamp
      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, []) // run once on mount
}
