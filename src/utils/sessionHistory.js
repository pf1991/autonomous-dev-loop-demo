/**
 * sessionHistory.js — localStorage persistence for per-run session history.
 *
 * Each session entry:
 *   { seed, hash, maxWave, score, difficulty, playedAt }
 *
 * History is capped at MAX_HISTORY_ENTRIES (20); oldest entries are dropped.
 */

const STORAGE_KEY = 'towerDefense_sessionHistory'
const MAX_HISTORY_ENTRIES = 20

/**
 * Load the session history from localStorage.
 * @returns {Array<{ seed: number, hash: string, maxWave: number, score: number, difficulty: string, playedAt: number }>}
 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/**
 * Save a new session entry.  Entries are sorted most-recent first and capped at
 * MAX_HISTORY_ENTRIES so the oldest entry is dropped when the list is full.
 *
 * @param {{ seed: number, hash: string, maxWave: number, score: number, difficulty: string, playedAt: number }} entry
 * @returns {Array} Updated history
 */
export function saveSession(entry) {
  const history = loadHistory()
  const updated = [entry, ...history]
    .sort((a, b) => b.playedAt - a.playedAt)
    .slice(0, MAX_HISTORY_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // ignore write errors (e.g. private browsing quota)
  }
  return updated
}

/**
 * Clear all session history entries.
 * @returns {[]}
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  return []
}
