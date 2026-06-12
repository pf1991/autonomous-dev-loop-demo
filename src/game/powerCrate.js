/**
 * powerCrate.js — pure game logic for boss-death power crates.
 * No side effects, no React imports.
 */

/**
 * CRATE_REWARDS lists the three possible power crate bonuses.
 * Each entry has:
 *   id     — stable identifier used by App to apply the effect
 *   label  — display text shown before the player clicks
 */
export const CRATE_REWARDS = [
  { id: 'lives',     label: '+3 Lives' },
  { id: 'gold',      label: '+200 Gold' },
  { id: 'overcharge', label: 'Tower Overcharge (15s)' },
]

/**
 * selectCrateReward picks one of the three rewards at random.
 * @param {number} [randomValue] - Optional 0–1 value (defaults to Math.random()).
 *   Provided to allow deterministic testing.
 * @returns {{ id: string, label: string }}
 */
export function selectCrateReward(randomValue) {
  const r = randomValue != null ? randomValue : Math.random()
  const index = Math.floor(r * CRATE_REWARDS.length)
  return CRATE_REWARDS[Math.min(index, CRATE_REWARDS.length - 1)]
}

/**
 * createPowerCrate creates a new power crate object at the given grid position.
 * @param {string|number} id - Unique crate identifier
 * @param {number} row - Grid row where the boss died
 * @param {number} col - Grid col where the boss died
 * @returns {{ id, row: number, col: number }}
 */
export function createPowerCrate(id, row, col) {
  return { id, row, col }
}
