/**
 * prestige.js — Pure functions for the prestige system.
 * No side effects, no React imports.
 */

export const MAX_PRESTIGE_STARS = 5

/**
 * getPrestigeBonus returns the cumulative modifier object for a given number of prestige stars.
 *
 * Modifier object shape:
 *   bonusGold          — extra starting gold added to the base
 *   bonusLives         — extra starting lives added to the base
 *   interestRateMult   — multiplier for interest payouts (e.g. 1.05 = +5%)
 *   upgradeCostMult    — multiplier for tower upgrade costs (e.g. 0.95 = 5% cheaper)
 *   unlockVeteran      — whether Veteran difficulty is unlocked
 *
 * @param {number} stars — prestige star count (0–5)
 * @returns {{ bonusGold: number, bonusLives: number, interestRateMult: number, upgradeCostMult: number, unlockVeteran: boolean }}
 */
export function getPrestigeBonus(stars) {
  const clamped = Math.max(0, Math.min(MAX_PRESTIGE_STARS, Math.floor(stars)))
  switch (clamped) {
    case 0:
      return { bonusGold: 0, bonusLives: 0, interestRateMult: 1, upgradeCostMult: 1, unlockVeteran: false }
    case 1:
      return { bonusGold: 10, bonusLives: 0, interestRateMult: 1, upgradeCostMult: 1, unlockVeteran: false }
    case 2:
      return { bonusGold: 10, bonusLives: 1, interestRateMult: 1, upgradeCostMult: 1, unlockVeteran: false }
    case 3:
      return { bonusGold: 10, bonusLives: 1, interestRateMult: 1, upgradeCostMult: 1, unlockVeteran: true }
    case 4:
      return { bonusGold: 20, bonusLives: 2, interestRateMult: 1.05, upgradeCostMult: 1, unlockVeteran: true }
    case 5:
      return { bonusGold: 30, bonusLives: 3, interestRateMult: 1.10, upgradeCostMult: 0.95, unlockVeteran: true }
    default:
      return { bonusGold: 0, bonusLives: 0, interestRateMult: 1, upgradeCostMult: 1, unlockVeteran: false }
  }
}
