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
 *     At upgrade level 2 (aoeSlowRadius), the slow is also applied to all enemies within
 *     aoeSlowRadius tiles of the primary target.
 *   - PoisonTower (poisonTickDamage, poisonTicks, poisonTickInterval): applies a DoT poison
 *     effect to the primary target. The effect is stored in enemy.effects[]. DoT continues
 *     even if the tower is sold. Processed by processEffectTick().
 *   - Adjacency synergies: when adjacencySynergies map is provided, synergy buffs are applied
 *     as multipliers to fire rate and damage, and special effects (poisonOnHit, freezeOnHit)
 *     are activated. Base stats in TOWER_TYPES are never mutated.
 *
 * @param {Array<{ row: number, col: number, range: number, damage: number, fireRate: number, lastFiredAt: number, splashRadius?: number, slowFactor?: number, slowDuration?: number, poisonTickDamage?: number, poisonTicks?: number, poisonTickInterval?: number, aoeSlowRadius?: number }>} towers
 * @param {Array<{ id: string|number, hp: number, pos: { row: number, col: number }, slowUntil?: number, speedMult?: number, effects?: Array }>} enemies
 * @param {number} nowMs - current timestamp in milliseconds
 * @param {Map<string, Array<object>>} [adjacencySynergies] - optional map from towerKey to synergy effects
 * @returns {{ enemies: Array, towers: Array, goldEarned: number, projectiles: Projectile[] }}
 */
export function processCombat(towers, enemies, nowMs, adjacencySynergies) {
  // Work with mutable copies so multiple towers can hit different enemies in the same tick
  const enemyMap = new Map(enemies.map(e => [e.id, { ...e, pos: { ...e.pos } }]))

  const projectiles = []
  // Track kill credits: Map from tower index → kill count increment for this tick
  const killCredits = new Map()

  const updatedTowers = towers.map((tower, towerIndex) => {
    // Compute synergy-boosted stats for this tick (base stats are never mutated)
    const synergyEffects = adjacencySynergies ? (adjacencySynergies.get(`${tower.row}-${tower.col}`) ?? []) : []
    let effectiveFireRate = tower.fireRate
    let effectiveDamageMultiplier = 1
    let synergyPoisonOnHit = false
    let synergyFreezeOnHit = false
    let effectiveRangePlus = 0
    for (const effect of synergyEffects) {
      if (effect.fireRateMult != null && effect.fireRateMult !== 1) {
        effectiveFireRate *= effect.fireRateMult
      }
      if (effect.damageMult != null && effect.damageMult !== 1) {
        effectiveDamageMultiplier *= effect.damageMult
      }
      if (effect.rangePlus) {
        effectiveRangePlus += effect.rangePlus
      }
      if (effect.poisonOnHit) synergyPoisonOnHit = true
      if (effect.freezeOnHit) synergyFreezeOnHit = true
    }
    const effectiveRange = tower.range + effectiveRangePlus

    const fireInterval = 1000 / effectiveFireRate
    if (nowMs - tower.lastFiredAt < fireInterval) {
      return { ...tower }
    }

    // Find nearest enemy within range
    let nearestId = null
    let nearestDist = Infinity

    for (const [id, enemy] of enemyMap) {
      const dist = tileDistance(tower, enemy.pos)
      if (dist <= effectiveRange && dist < nearestDist) {
        nearestDist = dist
        nearestId = id
      }
    }

    if (nearestId === null) {
      // No target in range — do not fire, do not update lastFiredAt
      return { ...tower }
    }

    // Fire: deal damage to primary target (respect enemy's damageResist for this tower type)
    const target = enemyMap.get(nearestId)
    const resistMultiplier = target.damageResist?.[tower.type] ?? 1
    const effectiveDamage = tower.damage * effectiveDamageMultiplier * resistMultiplier
    const newHp = target.hp - effectiveDamage
    // Track which tower index delivered the killing blow
    const killedByThis = newHp <= 0
    enemyMap.set(nearestId, { ...target, hp: newHp, ...(killedByThis ? { _killedByTowerIndex: towerIndex } : {}) })

    // Splash damage — CannonTower damages all enemies within splashRadius of the primary target
    const splashRadius = tower.splashRadius ?? 0
    if (splashRadius > 0) {
      for (const [id, enemy] of enemyMap) {
        if (id === nearestId) continue // already hit above
        const dist = tileDistance({ row: target.pos.row, col: target.pos.col }, enemy.pos)
        if (dist <= splashRadius) {
          const splashResist = enemy.damageResist?.[tower.type] ?? 1
          enemyMap.set(id, { ...enemy, hp: enemy.hp - tower.damage * splashResist })
        }
      }
    }

    // Slow debuff — SlowTower applies reduced speed to the primary target
    // Enemies with slowResist reduce how strongly the slow is applied:
    //   effectiveSlowFactor = 1 - (1 - rawSlowFactor) * (1 - slowResist)
    //   e.g. rawSlow=0.4, slowResist=0.5 → effectiveSlowFactor = 1 - 0.6*0.5 = 0.7
    if (tower.slowFactor != null && tower.slowDuration != null) {
      const applySlowTo = (enemyId) => {
        const current = enemyMap.get(enemyId)
        if (!current) return
        const slowResist = current.slowResist ?? 0
        const rawFactor = tower.slowFactor
        // When there is no resistance, pass the raw factor through unchanged (avoids floating-point drift).
        // When resistance > 0, dilute the slow: effectiveFactor = 1 - (1 - raw) * (1 - resist)
        const appliedFactor = slowResist <= 0
          ? rawFactor
          : slowResist >= 1
            ? 1  // fully immune — no slow at all
            : 1 - (1 - rawFactor) * (1 - slowResist)
        // Only apply if this slow is stronger (lower speedMult) or longer than existing slow
        const existingUntil = current.slowUntil ?? 0
        const newUntil = nowMs + tower.slowDuration
        if (appliedFactor < (current.speedMult ?? 1) || newUntil > existingUntil) {
          enemyMap.set(enemyId, {
            ...current,
            speedMult: appliedFactor,
            slowUntil: newUntil,
          })
        }
      }

      applySlowTo(nearestId)

      // AoE slow — SlowTower L2 (aoeSlowRadius): slow all enemies within aoeSlowRadius tiles
      const aoeSlowRadius = tower.aoeSlowRadius ?? 0
      if (aoeSlowRadius > 0) {
        const primary = enemyMap.get(nearestId)
        for (const [id] of enemyMap) {
          if (id === nearestId) continue
          const e = enemyMap.get(id)
          const dist = tileDistance({ row: primary.pos.row, col: primary.pos.col }, e.pos)
          if (dist <= aoeSlowRadius) {
            applySlowTo(id)
          }
        }
      }
    }

    // Poison DoT — PoisonTower applies a stackable DoT effect to the primary target
    if (tower.poisonTickDamage != null && tower.poisonTicks != null && tower.poisonTickInterval != null) {
      const current = enemyMap.get(nearestId)
      const newEffect = {
        type: 'poison',
        tickDamage: tower.poisonTickDamage,
        tickInterval: tower.poisonTickInterval,
        ticksRemaining: tower.poisonTicks,
        nextTickAt: nowMs + tower.poisonTickInterval,
      }
      const existingEffects = current.effects ?? []
      enemyMap.set(nearestId, {
        ...current,
        effects: [...existingEffects, newEffect],
      })
    }

    // Synergy: poisonOnHit — SniperTower+PoisonTower pair: apply 1 poison tick on hit
    if (synergyPoisonOnHit) {
      const current = enemyMap.get(nearestId)
      const newEffect = {
        type: 'poison',
        tickDamage: 15,
        tickInterval: 1000,
        ticksRemaining: 1,
        nextTickAt: nowMs + 1000,
      }
      const existingEffects = current.effects ?? []
      enemyMap.set(nearestId, {
        ...current,
        effects: [...existingEffects, newEffect],
      })
    }

    // Synergy: freezeOnHit — SniperTower+SlowTower pair: freeze target for 0.5s
    if (synergyFreezeOnHit) {
      const current = enemyMap.get(nearestId)
      const freezeUntil = nowMs + 500
      const existingUntil = current.slowUntil ?? 0
      if (freezeUntil > existingUntil || (current.speedMult ?? 1) > 0) {
        enemyMap.set(nearestId, {
          ...current,
          speedMult: 0,
          slowUntil: freezeUntil,
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
      towerType: tower.type,
      upgradeLevel: tower.upgradeLevel ?? 0,
    })

    return { ...tower, lastFiredAt: nowMs }
  })

  // Collect results: filter out dead enemies, count gold earned
  let goldEarned = 0
  const updatedEnemies = []
  /** @type {Array<{ id: string|number, row: number, col: number, gold: number }>} */
  const killedEnemies = []

  for (const enemy of enemyMap.values()) {
    if (enemy.hp <= 0) {
      const reward = enemy.goldReward ?? 10
      goldEarned += reward
      killedEnemies.push({ id: enemy.id, row: enemy.pos.row, col: enemy.pos.col, gold: reward, type: enemy.type })
      // Credit kill to the tower that dealt the killing blow
      if (enemy._killedByTowerIndex != null) {
        killCredits.set(enemy._killedByTowerIndex, (killCredits.get(enemy._killedByTowerIndex) ?? 0) + 1)
      }
    } else {
      updatedEnemies.push(enemy)
    }
  }

  // Apply kill credits to updated towers
  const towersWithKills = updatedTowers.map((t, i) => {
    const credits = killCredits.get(i) ?? 0
    if (credits === 0) return t
    return { ...t, kills: (t.kills ?? 0) + credits }
  })

  return { enemies: updatedEnemies, towers: towersWithKills, goldEarned, projectiles, killedEnemies }
}

/**
 * processEffectTick advances all active DoT/status effects on enemies.
 * Must be called once per game tick, after processCombat.
 *
 * For each enemy:
 *   - Iterates effects[]; for each effect whose nextTickAt <= nowMs, applies tick damage
 *     and decrements ticksRemaining.  Effects with ticksRemaining <= 0 are removed.
 * Enemies whose hp drops to 0 or below from DoT are killed; their goldReward is collected.
 *
 * @param {Array<{ id: string|number, hp: number, maxHp: number, goldReward: number, effects?: Array }>} enemies
 * @param {number} nowMs - current game clock in milliseconds
 * @returns {{ enemies: Array, goldEarned: number, killedEnemies: Array }}
 */
export function processEffectTick(enemies, nowMs) {
  let goldEarned = 0
  const killedEnemies = []
  const updatedEnemies = []

  for (const enemy of enemies) {
    const effects = enemy.effects ?? []
    if (effects.length === 0) {
      updatedEnemies.push(enemy)
      continue
    }

    let currentHp = enemy.hp
    const survivingEffects = []

    for (const effect of effects) {
      if (effect.type === 'poison') {
        if (effect.ticksRemaining <= 0) continue // fully expired

        if (nowMs >= effect.nextTickAt) {
          // Apply this tick's damage
          currentHp -= effect.tickDamage
          const newRemaining = effect.ticksRemaining - 1
          if (newRemaining > 0) {
            survivingEffects.push({
              ...effect,
              ticksRemaining: newRemaining,
              nextTickAt: effect.nextTickAt + effect.tickInterval,
            })
          }
          // else effect is fully consumed — drop it
        } else {
          survivingEffects.push(effect)
        }
      }
    }

    if (currentHp <= 0) {
      const reward = enemy.goldReward ?? 0
      goldEarned += reward
      killedEnemies.push({
        id: enemy.id,
        row: enemy.pos.row,
        col: enemy.pos.col,
        gold: reward,
        type: enemy.type,
      })
    } else {
      updatedEnemies.push({ ...enemy, hp: currentHp, effects: survivingEffects })
    }
  }

  return { enemies: updatedEnemies, goldEarned, killedEnemies }
}
