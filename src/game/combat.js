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
 * A projectile represents a single shot fired from a tower toward an enemy position.
 * @typedef {{ id: string, fromRow: number, fromCol: number, toRow: number, toCol: number, createdAt: number }} Projectile
 */

/**
 * processCombat applies one combat tick: each tower fires at the nearest enemy in range.
 *
 * Special tower mechanics:
 *   - CannonTower (splashRadius > 0): deals damage to ALL enemies within splashRadius tiles
 *     of the primary target, in addition to the target itself.
 *   - SlowTower (slowFactor, slowDuration): applies a slow debuff to the primary target.
 *     The enemy's `slowUntil` and `speedMult` fields are set accordingly; the caller
 *     must honour `speedMult` in movement logic when `nowMs < slowUntil`.
 *
 * @param {Array<{ row: number, col: number, range: number, damage: number, fireRate: number, lastFiredAt: number, splashRadius?: number, slowFactor?: number, slowDuration?: number }>} towers
 * @param {Array<{ id: string|number, hp: number, pos: { row: number, col: number }, slowUntil?: number, speedMult?: number }>} enemies
 * @param {number} nowMs - current timestamp in milliseconds
 * @returns {{ enemies: Array, towers: Array, goldEarned: number, projectiles: Projectile[] }}
 */
export function processCombat(towers, enemies, nowMs) {
  // Work with mutable copies so multiple towers can hit different enemies in the same tick
  const enemyMap = new Map(enemies.map(e => [e.id, { ...e, pos: { ...e.pos } }]))

  const projectiles = []

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

    // Fire: deal damage to primary target
    const target = enemyMap.get(nearestId)
    enemyMap.set(nearestId, { ...target, hp: target.hp - tower.damage })

    // Splash damage — CannonTower damages all enemies within splashRadius of the primary target
    const splashRadius = tower.splashRadius ?? 0
    if (splashRadius > 0) {
      for (const [id, enemy] of enemyMap) {
        if (id === nearestId) continue // already hit above
        const dist = tileDistance({ row: target.pos.row, col: target.pos.col }, enemy.pos)
        if (dist <= splashRadius) {
          enemyMap.set(id, { ...enemy, hp: enemy.hp - tower.damage })
        }
      }
    }

    // Slow debuff — SlowTower applies reduced speed to the primary target
    if (tower.slowFactor != null && tower.slowDuration != null) {
      const current = enemyMap.get(nearestId)
      // Only apply if this slow is stronger (lower speedMult) or longer than existing slow
      const existingUntil = current.slowUntil ?? 0
      const newUntil = nowMs + tower.slowDuration
      if (tower.slowFactor < (current.speedMult ?? 1) || newUntil > existingUntil) {
        enemyMap.set(nearestId, {
          ...current,
          speedMult: tower.slowFactor,
          slowUntil: newUntil,
        })
      }
    }

    // Record the projectile for visual feedback
    projectiles.push({
      id: `${tower.row}-${tower.col}-${nowMs}`,
      fromRow: tower.row,
      fromCol: tower.col,
      toRow: target.pos.row,
      toCol: target.pos.col,
      createdAt: nowMs,
    })

    return { ...tower, lastFiredAt: nowMs }
  })

  // Collect results: filter out dead enemies, count gold earned
  let goldEarned = 0
  const updatedEnemies = []

  for (const enemy of enemyMap.values()) {
    if (enemy.hp <= 0) {
      goldEarned += enemy.goldReward ?? 10
    } else {
      updatedEnemies.push(enemy)
    }
  }

  return { enemies: updatedEnemies, towers: updatedTowers, goldEarned, projectiles }
}
