/**
 * wave.js — pure game logic for wave spawning.
 * No side effects, no React imports.
 */

/**
 * createWave creates a wave descriptor for the given wave number.
 * @param {number} waveNumber - 1-based wave number
 * @returns {{ enemies: Array, spawnInterval: number, totalEnemies: number }}
 */
export function createWave(waveNumber) {
  return {
    enemies: [],
    spawnInterval: 500,
    totalEnemies: waveNumber * 3,
  }
}
