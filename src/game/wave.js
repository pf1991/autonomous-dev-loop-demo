/**
 * wave.js — pure game logic for wave spawning.
 * No side effects, no React imports.
 */

/**
 * getWaveEnemyHp returns the HP for enemies in the given wave.
 * Formula: 100 + (wave - 1) * 25
 * wave 1: 100, wave 5: 200, wave 10: 325
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} HP value
 */
export function getWaveEnemyHp(waveNumber) {
  return 100 + (waveNumber - 1) * 25
}

/**
 * getWaveEnemyCount returns the number of enemies to spawn in the given wave.
 * Formula: 5 + Math.floor((wave - 1) / 2)
 * wave 1: 5, wave 3: 6, wave 5: 7, wave 9: 9
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} Enemy count
 */
export function getWaveEnemyCount(waveNumber) {
  return 5 + Math.floor((waveNumber - 1) / 2)
}

/**
 * getWaveComposition returns the mix of enemy types for the given wave.
 *
 * Wave composition rules:
 *   Waves 1–3:  Grunts only
 *   Waves 4–6:  70% Grunts, 30% Tanks
 *   Waves 7–10: 40% Grunts, 60% Tanks
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {Array<{ type: 'grunt'|'tank', count: number }>}
 */
export function getWaveComposition(waveNumber) {
  const total = getWaveEnemyCount(waveNumber)

  if (waveNumber <= 3) {
    return [{ type: 'grunt', count: total }]
  }

  let gruntFraction, tankFraction
  if (waveNumber <= 6) {
    gruntFraction = 0.7
    tankFraction  = 0.3
  } else {
    gruntFraction = 0.4
    tankFraction  = 0.6
  }

  const tankCount  = Math.round(total * tankFraction)
  const gruntCount = total - tankCount

  const result = []
  if (gruntCount > 0) result.push({ type: 'grunt', count: gruntCount })
  if (tankCount  > 0) result.push({ type: 'tank',  count: tankCount  })
  return result
}

/**
 * createWave creates a wave descriptor for the given wave number.
 * @param {number} waveNumber - 1-based wave number
 * @returns {{ enemies: Array, spawnInterval: number, totalEnemies: number, enemyHp: number }}
 */
export function createWave(waveNumber) {
  return {
    enemies: [],
    spawnInterval: 500,
    totalEnemies: getWaveEnemyCount(waveNumber),
    enemyHp: getWaveEnemyHp(waveNumber),
  }
}

/**
 * getEndlessWaveEnemyHp returns the HP for enemies in an endless-mode wave.
 *
 * Waves 1–10 use the standard formula.
 * Wave 11+: starts at wave-10 HP (325) and scales by ×1.15 per wave beyond 10.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} HP value (integer)
 */
export function getEndlessWaveEnemyHp(waveNumber) {
  if (waveNumber <= 10) return getWaveEnemyHp(waveNumber)
  const base = getWaveEnemyHp(10) // 325
  return Math.round(base * Math.pow(1.15, waveNumber - 10))
}

/**
 * getEndlessWaveEnemyCount returns the number of enemies in an endless-mode wave.
 *
 * Waves 1–10 use the standard formula.
 * Wave 11+: starts at wave-10 count (9) and adds 1 per 2 extra waves.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} Enemy count
 */
export function getEndlessWaveEnemyCount(waveNumber) {
  if (waveNumber <= 10) return getWaveEnemyCount(waveNumber)
  const base = getWaveEnemyCount(10) // 9
  return base + Math.floor((waveNumber - 10) / 2)
}

/**
 * getEndlessWaveComposition returns the enemy mix for an endless-mode wave.
 *
 * Wave 11+: always 30% Grunts / 70% Tanks (heavier tank-weighted).
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {Array<{ type: 'grunt'|'tank', count: number }>}
 */
export function getEndlessWaveComposition(waveNumber) {
  if (waveNumber <= 10) return getWaveComposition(waveNumber)
  const total = getEndlessWaveEnemyCount(waveNumber)
  const tankCount = Math.round(total * 0.7)
  const gruntCount = total - tankCount
  const result = []
  if (gruntCount > 0) result.push({ type: 'grunt', count: gruntCount })
  if (tankCount > 0) result.push({ type: 'tank', count: tankCount })
  return result
}

/**
 * getEarlyWaveBonus returns the gold-per-kill multiplier granted when the player
 * calls the next wave early.
 *
 * Formula: 1 + (earlierWaveNumber / (currentWaveNumber + earlierWaveNumber))
 *   where earlierWaveNumber = how many waves early the player called it (≥ 1)
 *         currentWaveNumber = the wave number currently being played (≥ 1)
 *
 * @param {number} earlierWaveNumber - Waves called ahead of schedule (≥ 1)
 * @param {number} currentWaveNumber - The wave number that was active when early was called (≥ 1)
 * @returns {number} Multiplier ≥ 1.0
 */
export function getEarlyWaveBonus(earlierWaveNumber, currentWaveNumber) {
  return 1 + earlierWaveNumber / (currentWaveNumber + earlierWaveNumber)
}
