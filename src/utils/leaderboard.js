const STORAGE_KEY = 'towerDefense_leaderboard'

/**
 * Load the leaderboard from localStorage.
 * @returns {{ score: number, date: string, result: string }[]}
 */
export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * Add a new entry to the leaderboard, keep top 5 sorted descending.
 * @param {{ score: number, date: string, result: string }} entry
 * @returns {{ score: number, date: string, result: string }[]} Updated leaderboard
 */
export function saveLeaderboardEntry(entry) {
  const board = loadLeaderboard()
  board.push(entry)
  board.sort((a, b) => b.score - a.score)
  const top5 = board.slice(0, 5)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(top5))
  return top5
}

/**
 * Clear all leaderboard entries.
 * @returns {[]}
 */
export function clearLeaderboard() {
  localStorage.removeItem(STORAGE_KEY)
  return []
}
