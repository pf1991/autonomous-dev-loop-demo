/**
 * combat.js — pure game logic for tower combat.
 * No side effects, no React imports.
 */

/**
 * tileDistance calculates the Euclidean distance in tiles between a tower and an enemy position.
 * @param {{ row: number, col: number }} tower
 * @param {{ row: number, col: number }} pos - enemy position
 * @returns {number}
 */
function tileDistance(tower, pos) {
  const dr = tower.row - pos.row
  const dc = tower.col - pos.col
  return Math.sqrt(dr * dr + dc * dc)
}

/**
 * processCombat applies one combat tick: each tower fires at the nearest enemy in range.
 *
 * @param {Array<{ row: number, col: number, range: number, damage: number, fireRate: number, lastFiredAt: number }>} towers
 * @param {Array<{ id: string|number, hp: number, pos: { row: number, col: number } }>} enemies
 * @param {number} nowMs - current timestamp in milliseconds
 * @returns {{ enemies: Array, towers: Array, goldEarned: number }}
 */
export function processCombat(towers, enemies, nowMs) {
  // Work with mutable copies so multiple towers can hit different enemies in the same tick
  const enemyMap = new Map(enemies.map(e => [e.id, { ...e, pos: { ...e.pos } }]))

  const updatedTowers = towers.map(tower => {
    const fireInterval = 1000 / tower.fireRate
    if (nowMs - tower.lastFiredAt < fireInterval) {
      return { ...tower }
    }

    // Find nearest enemy within range
    let nearestId = null
    let nearestDist = Infinity

    for (const [id, enemy] of enemyMap) {
      const dist = tileDistance(tower, enemy.pos)
      if (dist <= tower.range && dist < nearestDist) {
        nearestDist = dist
        nearestId = id
      }
    }

    if (nearestId === null) {
      // No target in range — do not fire, do not update lastFiredAt
      return { ...tower }
    }

    // Fire: deal damage to target
    const target = enemyMap.get(nearestId)
    enemyMap.set(nearestId, { ...target, hp: target.hp - tower.damage })

    return { ...tower, lastFiredAt: nowMs }
  })

  // Collect results: filter out dead enemies, count gold earned
  let goldEarned = 0
  const updatedEnemies = []

  for (const enemy of enemyMap.values()) {
    if (enemy.hp <= 0) {
      goldEarned += 10
    } else {
      updatedEnemies.push(enemy)
    }
  }

  return { enemies: updatedEnemies, towers: updatedTowers, goldEarned }
}
