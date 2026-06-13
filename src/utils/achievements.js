/**
 * achievements.js (utils) — localStorage persistence boundary for achievements.
 * This is the ONLY file allowed to access localStorage for achievements.
 * All logic lives in src/game/achievements.js (pure functions).
 */

const STORAGE_KEY = 'towerDefense_achievements'

/**
 * Load the set of unlocked achievement IDs from localStorage.
 * @returns {string[]} Array of unlocked achievement IDs
 */
export function loadUnlockedAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(id => typeof id === 'string')
  } catch {
    return []
  }
}

/**
 * Save the full set of unlocked achievement IDs to localStorage.
 * @param {string[]} unlocked — complete list of unlocked IDs
 */
export function saveUnlockedAchievements(unlocked) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked))
  } catch {
    // ignore write errors (e.g. private browsing quota)
  }
}

/**
 * Add newly unlocked IDs to the persisted set and return the merged list.
 * @param {string[]} newIds — IDs that were just unlocked
 * @returns {string[]} Complete updated list of unlocked IDs
 */
export function persistNewAchievements(newIds) {
  if (newIds.length === 0) return loadUnlockedAchievements()
  const existing = loadUnlockedAchievements()
  const merged = Array.from(new Set([...existing, ...newIds]))
  saveUnlockedAchievements(merged)
  return merged
}

/**
 * Clear all achievement data (used for testing / dev resets).
 */
export function clearAchievements() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
