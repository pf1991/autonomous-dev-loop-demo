/**
 * enemy.js — pure game logic for enemy entities.
 * No side effects, no React imports.
 */

/**
 * Enemy type definitions.
 * Each entry specifies the base stats for a given enemy type.
 */
export const ENEMY_TYPES = {
  grunt: { hp: 80,  speed: 3.0, goldReward: 8  },
  tank:  { hp: 300, speed: 1.0, goldReward: 25 },
}

/**
 * createEnemy creates a new enemy object.
 * @param {string|number} id - Unique enemy identifier
 * @param {Array<{row: number, col: number}>} pathWaypoints - Array of waypoints defining the path
 * @param {'grunt'|'tank'} [type='grunt'] - Enemy type; defaults to 'grunt' for backwards compatibility
 * @returns {{ id, hp: number, maxHp: number, pos: {row, col}, waypointIndex: number, speed: number, type: string, goldReward: number }}
 */
export function createEnemy(id, pathWaypoints, type = 'grunt') {
  const startPos = pathWaypoints && pathWaypoints.length > 0
    ? { row: pathWaypoints[0].row, col: pathWaypoints[0].col }
    : { row: 0, col: 0 }

  const stats = ENEMY_TYPES[type] ?? ENEMY_TYPES.grunt

  return {
    id,
    hp: stats.hp,
    maxHp: stats.hp,
    pos: { ...startPos },
    waypointIndex: 0,
    speed: stats.speed,
    type,
    goldReward: stats.goldReward,
  }
}

/**
 * Compute enemy display radius in px based on enemy type.
 * Grunt (fast/weak): 10 px fixed radius.
 * Tank  (slow/tough): 16 px fixed radius.
 * Unknown/legacy type: falls back to HP-ratio sizing for backwards compatibility.
 * @param {number} hp - Current HP
 * @param {number} maxHp - Maximum HP
 * @param {string} [type] - Enemy type ('grunt' | 'tank')
 * @returns {number} Radius in pixels
 */
export function getEnemyRadius(hp, maxHp, type) {
  if (type === 'grunt') return 10
  if (type === 'tank') return 16
  // Legacy fallback — hp-ratio sizing
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

  // Distance to travel this tick (speed is tiles-per-second, deltaMs in ms).
  // If a slow debuff is active (slowUntil > nowMs equivalent), apply speedMult.
  // moveEnemy does not receive nowMs — the caller is responsible for clearing
  // expired slow state before passing enemies in.  We honour speedMult if set.
  const effectiveSpeed = enemy.speed * (enemy.speedMult ?? 1)
  let distRemaining = (effectiveSpeed * deltaMs) / 1000
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
