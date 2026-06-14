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

/**
 * Compute bonus gold awarded for a kill-streak combo.
 *
 * Thresholds:
 *   1  kill  — no bonus (0)
 *   2  kills — Double Kill  (+2)
 *   3  kills — Triple Kill  (+5)
 *   4  kills — Quad Kill    (+10)
 *   5+ kills — RAMPAGE      (+20)
 *
 * @param {number} comboCount — number of kills in the current combo window (≥ 1)
 * @returns {number} Bonus gold to award on top of the enemy's base gold reward
 */
export function computeComboBonus(comboCount) {
  if (comboCount >= 5) return 20
  if (comboCount === 4) return 10
  if (comboCount === 3) return 5
  if (comboCount === 2) return 2
  return 0
}

/**
 * Compute gold earned from the passive interest tick.
 *
 * Rules:
 *   - interest = floor(gold × 0.05)
 *   - Minimum payout: 1 gold (only if gold > 0)
 *   - Maximum payout per tick: 50 gold
 *   - Returns 0 if gold ≤ 0 (no interest on empty wallet)
 *
 * @param {number} gold — current gold held by the player
 * @returns {number} Interest gold to award this tick
 */
export function computeInterest(gold) {
  if (gold <= 0) return 0
  return Math.min(50, Math.max(1, Math.floor(gold * 0.05)))
}

/**
 * Return the label string for a given combo count.
 *
 * @param {number} comboCount
 * @returns {string}
 */
export function getComboLabel(comboCount) {
  if (comboCount >= 5) return 'RAMPAGE'
  if (comboCount === 4) return 'QUAD KILL'
  if (comboCount === 3) return 'TRIPLE KILL'
  if (comboCount === 2) return 'DOUBLE KILL'
  return ''
}
