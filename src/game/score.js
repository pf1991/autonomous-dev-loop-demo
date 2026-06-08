/**
 * Pure score computation — no side effects, no React imports.
 *
 * Formula: (kills * 10) + (goldEarned * 2) + (livesRemaining * 50) + (wavesCompleted * 100)
 *
 * @param {{ kills: number, goldEarned: number, livesRemaining: number, wavesCompleted: number }} params
 * @returns {number} Final integer score
 */
export function computeScore({ kills, goldEarned, livesRemaining, wavesCompleted }) {
  return (
    (kills * 10) +
    (goldEarned * 2) +
    (livesRemaining * 50) +
    (wavesCompleted * 100)
  )
}
