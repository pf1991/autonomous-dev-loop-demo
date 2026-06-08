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
 *   Waves 1–2:  Grunts only
 *   Wave  3:    70% Grunts, 30% Speeders  (introduces speeders)
 *   Waves 4–5:  50% Grunts, 30% Speeders, 20% Tanks
 *   Wave  6:    30% Grunts, 30% Speeders, 20% Tanks, 20% Armored  (introduces armored)
 *   Wave  7:    20% Grunts, 20% Speeders, 20% Tanks, 20% Armored, 20% Phantoms (introduces phantoms)
 *   Waves 8–10: 10% Grunts, 20% Speeders, 20% Tanks, 25% Armored, 25% Phantoms
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {Array<{ type: string, count: number }>}
 */
export function getWaveComposition(waveNumber) {
  const total = getWaveEnemyCount(waveNumber)

  function distribute(fractions) {
    // fractions: array of [type, fraction] pairs; last entry absorbs rounding
    const entries = fractions.filter(([, f]) => f > 0)
    const result = []
    let remaining = total
    for (let i = 0; i < entries.length - 1; i++) {
      const [type, frac] = entries[i]
      const count = Math.round(total * frac)
      if (count > 0) result.push({ type, count })
      remaining -= count
    }
    const [lastType] = entries[entries.length - 1]
    if (remaining > 0) result.push({ type: lastType, count: remaining })
    return result
  }

  if (waveNumber <= 2) {
    return [{ type: 'grunt', count: total }]
  }

  if (waveNumber === 3) {
    return distribute([['grunt', 0.7], ['speeder', 0.3]])
  }

  if (waveNumber <= 5) {
    return distribute([['grunt', 0.5], ['speeder', 0.3], ['tank', 0.2]])
  }

  if (waveNumber === 6) {
    return distribute([['grunt', 0.3], ['speeder', 0.3], ['tank', 0.2], ['armored', 0.2]])
  }

  if (waveNumber === 7) {
    // Five equal parts — use explicit proportions that round cleanly to guarantee each type appears.
    // Wave 7 total = 8; 2 grunts, 2 speeders, 2 tanks, 1 armored, 1 phantom.
    return distribute([['grunt', 0.25], ['speeder', 0.25], ['tank', 0.25], ['armored', 0.125], ['phantom', 0.125]])
  }

  // Waves 8–10
  return distribute([['grunt', 0.1], ['speeder', 0.2], ['tank', 0.2], ['armored', 0.25], ['phantom', 0.25]])
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
 * Waves 1–10: use standard composition.
 * Wave 11–15: 10% Grunts, 15% Speeders, 15% Tanks, 30% Armored, 30% Phantoms.
 * Wave 16+:   5% Grunts, 15% Speeders, 10% Tanks, 35% Armored, 35% Phantoms.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {Array<{ type: string, count: number }>}
 */
export function getEndlessWaveComposition(waveNumber) {
  if (waveNumber <= 10) return getWaveComposition(waveNumber)

  const total = getEndlessWaveEnemyCount(waveNumber)

  function distribute(fractions) {
    const entries = fractions.filter(([, f]) => f > 0)
    const result = []
    let remaining = total
    for (let i = 0; i < entries.length - 1; i++) {
      const [type, frac] = entries[i]
      const count = Math.round(total * frac)
      if (count > 0) result.push({ type, count })
      remaining -= count
    }
    const [lastType] = entries[entries.length - 1]
    if (remaining > 0) result.push({ type: lastType, count: remaining })
    return result
  }

  if (waveNumber <= 15) {
    return distribute([['grunt', 0.1], ['speeder', 0.15], ['tank', 0.15], ['armored', 0.3], ['phantom', 0.3]])
  }

  return distribute([['grunt', 0.05], ['speeder', 0.15], ['tank', 0.1], ['armored', 0.35], ['phantom', 0.35]])
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
