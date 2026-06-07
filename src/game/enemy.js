/**
 * enemy.js — pure game logic for enemy entities.
 * No side effects, no React imports.
 */

/**
 * createEnemy creates a new enemy object.
 * @param {string|number} id - Unique enemy identifier
 * @param {Array<{row: number, col: number}>} pathWaypoints - Array of waypoints defining the path
 * @returns {{ id, hp: number, maxHp: number, pos: {row, col}, waypointIndex: number, speed: number }}
 */
export function createEnemy(id, pathWaypoints) {
  const startPos = pathWaypoints && pathWaypoints.length > 0
    ? { row: pathWaypoints[0].row, col: pathWaypoints[0].col }
    : { row: 0, col: 0 }

  return {
    id,
    hp: 100,
    maxHp: 100,
    pos: { ...startPos },
    waypointIndex: 0,
    speed: 2,
  }
}

/**
 * Compute enemy display radius in px based on HP ratio:
 *   full HP (>= 0.5)    → 14 px (large)
 *   half HP (>= 0.25)   → 11 px (medium)
 *   near death (< 0.25) → 8 px (small)
 * @param {number} hp - Current HP
 * @param {number} maxHp - Maximum HP
 * @returns {number} Radius in pixels
 */
export function getEnemyRadius(hp, maxHp) {
  const ratio = maxHp > 0 ? hp / maxHp : 0
  if (ratio >= 0.5) return 14
  if (ratio >= 0.25) return 11
  return 8
}

/**
 * moveEnemy advances the enemy along the path by the given time delta.
 * Returns null if the enemy has reached (or passed) the last waypoint.
 * @param {{ id, hp, maxHp, pos: {row, col}, waypointIndex: number, speed: number }} enemy
 * @param {number} deltaMs - Time elapsed in milliseconds
 * @param {Array<{row: number, col: number}>} pathWaypoints
 * @returns {object|null} Updated enemy, or null when it exits the path
 */
export function moveEnemy(enemy, deltaMs, pathWaypoints) {
  if (deltaMs === 0) {
    return { ...enemy, pos: { ...enemy.pos } }
  }

  if (!pathWaypoints || pathWaypoints.length === 0) {
    return null
  }

  // Distance to travel this tick (speed is tiles-per-second, deltaMs in ms)
  let distRemaining = (enemy.speed * deltaMs) / 1000
  let { row, col } = enemy.pos
  let waypointIndex = enemy.waypointIndex

  while (distRemaining > 0) {
    const nextIndex = waypointIndex + 1

    // Reached the last waypoint — enemy exits the map
    if (nextIndex >= pathWaypoints.length) {
      return null
    }

    const target = pathWaypoints[nextIndex]
    const dRow = target.row - row
    const dCol = target.col - col
    const distToNext = Math.sqrt(dRow * dRow + dCol * dCol)

    if (distRemaining >= distToNext) {
      // Move fully to the next waypoint and continue
      distRemaining -= distToNext
      row = target.row
      col = target.col
      waypointIndex = nextIndex
    } else {
      // Partial move toward the next waypoint
      const ratio = distRemaining / distToNext
      row = row + dRow * ratio
      col = col + dCol * ratio
      distRemaining = 0
    }
  }

  return {
    ...enemy,
    pos: { row, col },
    waypointIndex,
  }
}
