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
 * Load the leaderboard from localStorage.
 * @returns {{ score: number, date: string, result: string }[]}
 */
export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem('towerDefense_leaderboard')
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
  localStorage.setItem('towerDefense_leaderboard', JSON.stringify(top5))
  return top5
}

/**
 * Clear all leaderboard entries.
 * @returns {[]}
 */
export function clearLeaderboard() {
  localStorage.removeItem('towerDefense_leaderboard')
  return []
}
