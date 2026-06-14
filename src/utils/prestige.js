/**
 * prestige.js (utils) — localStorage persistence boundary for prestige stars.
 * This is the ONLY file allowed to access localStorage for prestige data.
 * All logic lives in src/game/prestige.js (pure functions).
 */

import { MAX_PRESTIGE_STARS } from '../game/prestige.js'

const STORAGE_KEY = 'towerDefense_prestigeStars'

/**
 * Load the current prestige star count from localStorage.
 * @returns {number} Star count (0–5)
 */
export function loadPrestigeStars() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return 0
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(n, MAX_PRESTIGE_STARS)
  } catch {
    return 0
  }
}

/**
 * Save the prestige star count to localStorage.
 * Clamps to valid range [0, MAX_PRESTIGE_STARS].
 * @param {number} n
 */
export function savePrestigeStars(n) {
  try {
    const clamped = Math.max(0, Math.min(MAX_PRESTIGE_STARS, Math.floor(n)))
    localStorage.setItem(STORAGE_KEY, String(clamped))
  } catch {
    // ignore write errors (e.g. private browsing quota)
  }
}
