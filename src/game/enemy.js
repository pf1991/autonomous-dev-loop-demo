/**
 * enemy.js — pure game logic for enemy entities.
 * No side effects, no React imports.
 */

/**
 * Enemy type definitions.
 * Each entry specifies the base stats for a given enemy type.
 *
 * Special fields:
 *   slowResist  (0–1) — fraction by which slow effects are diminished.
 *                       0 = full slow applied; 1 = completely immune.
 *   damageResist — object mapping tower type → damage multiplier (0–1).
 *                  Keys: 'BasicTower', 'RapidTower', 'SniperTower', 'CannonTower', 'SlowTower'.
 *                  Absent key = no resistance (multiplier 1.0).
 *   damageBonus  — object mapping tower type → damage multiplier (>1).
 *                  Used to mark specific towers that deal extra damage (weaknesses).
 */
export const ENEMY_TYPES = {
  grunt: { hp: 80,  speed: 3.0, goldReward: 8  },
  tank:  { hp: 300, speed: 1.0, goldReward: 25 },

  /**
   * colossus — boss enemy that appears every 5th wave.
   * HP is computed dynamically from tank HP × 3 for the wave; this entry
   * provides the base stats used by createEnemy when an explicit hp override
   * is not supplied.  The actual HP is overridden at spawn time via
   * getBossHp(waveNumber).
   */
  colossus: {
    hp: 900,
    speed: 0.6,
    goldReward: 150,
  },

  /**
   * speeder — extremely fast but frail.
   * Resists SlowTower (slow effects are cut in half).
   * Small HP pool so basic towers can still kill it quickly if it gets hit.
   */
  speeder: {
    hp: 50,
    speed: 5.5,
    goldReward: 12,
    slowResist: 0.5,
  },

  /**
   * armored — slow-moving, extremely high HP.
   * Nearly immune to RapidTower's chip damage.
   * Weak to CannonTower (full AoE still applies) and SniperTower high single hits.
   * Requires coordinated fire to kill in time.
   */
  armored: {
    hp: 600,
    speed: 1.2,
    goldReward: 45,
    damageResist: { RapidTower: 0.15, SlowTower: 0.25 },
  },

  /**
   * phantom — medium speed, phases through weak attacks.
   * Nearly immune to BasicTower and RapidTower — only SniperTower or CannonTower deal
   * meaningful damage.  Slow effects apply normally.
   */
  phantom: {
    hp: 220,
    speed: 2.5,
    goldReward: 30,
    damageResist: { BasicTower: 0.05, RapidTower: 0.05 },
  },

  /**
   * healer — restores 25 HP to the nearest ally enemy within 2 tiles every 3 seconds.
   * Priority target: players should kill healers first.
   * SVG overlay: green + cross floats above the enemy.
   */
  healer: {
    hp: 120,
    speed: 2.0,
    goldReward: 20,
  },

  /**
   * splitter — on death, splits into 2 Grunts with 50% HP each.
   * Spawned grunts award no gold (prevent farming).
   * SVG overlay: orange circle with diagonal split line.
   */
  splitter: {
    hp: 200,
    speed: 1.5,
    goldReward: 15,
  },

  /**
   * shielded — takes only 60% of all incoming damage (before other modifiers).
   * Exception: Poison DoT bypasses the shield (full DoT damage).
   * SVG overlay: dark-silver circle with small shield icon.
   * The shield reduction is applied in processCombat via the shieldedDamageReduction flag.
   */
  shielded: {
    hp: 250,
    speed: 1.2,
    goldReward: 30,
    shieldedDamageReduction: 0.6,
  },
}

/**
 * getBossHp returns the HP for the Colossus boss on a given wave.
 * Formula: 3 × tank base HP (300) = 900, constant across waves.
 * (The colossus is already the highest-HP enemy by far; further per-wave
 * scaling can be added if needed without breaking any callers.)
 *
 * @returns {number} HP value
 */
export function getBossHp() {
  return 3 * ENEMY_TYPES.tank.hp
}

/**
 * getEnemyHpForWave returns the HP for the given enemy type scaled to the wave number.
 *
 * Each wave enemy HP grows by ×1.4 per wave (matching the wave.js formula).
 * The scale factor is 1.4^(waveNumber - 1), so wave 1 enemies have their base HP
 * and wave 10 enemies have roughly ×20.7× more HP.
 *
 * Colossus (boss) HP is constant at getBossHp() and ignores wave scaling.
 *
 * @param {string} type - Enemy type key (e.g. 'grunt', 'tank', 'armored', 'colossus')
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} HP value (integer)
 */
export function getEnemyHpForWave(type, waveNumber) {
  if (type === 'colossus') return getBossHp()
  const stats = ENEMY_TYPES[type] ?? ENEMY_TYPES.grunt
  const scaleFactor = Math.pow(1.4, waveNumber - 1)
  return Math.round(stats.hp * scaleFactor)
}

/**
 * createEnemy creates a new enemy object.
 * @param {string|number} id - Unique enemy identifier
 * @param {Array<{row: number, col: number}>} pathWaypoints - Array of waypoints defining the path
 * @param {'grunt'|'tank'|'speeder'|'armored'|'phantom'|'colossus'} [type='grunt'] - Enemy type; defaults to 'grunt' for backwards compatibility
 * @param {number} [hpOverride] - Optional HP override (used for colossus boss whose HP scales with wave)
 * @returns {{ id, hp: number, maxHp: number, pos: {row, col}, waypointIndex: number, speed: number, type: string, goldReward: number, slowResist?: number, damageResist?: object, effects: Array }}
 */
export function createEnemy(id, pathWaypoints, type = 'grunt', hpOverride) {
  const startPos = pathWaypoints && pathWaypoints.length > 0
    ? { row: pathWaypoints[0].row, col: pathWaypoints[0].col }
    : { row: 0, col: 0 }

  const stats = ENEMY_TYPES[type] ?? ENEMY_TYPES.grunt
  const hp = hpOverride != null ? hpOverride : stats.hp

  const enemy = {
    id,
    hp,
    maxHp: hp,
    pos: { ...startPos },
    waypointIndex: 0,
    speed: stats.speed,
    type,
    goldReward: stats.goldReward,
    effects: [],
  }

  // Carry over resistance fields when present
  if (stats.slowResist != null)              enemy.slowResist              = stats.slowResist
  if (stats.damageResist != null)            enemy.damageResist            = { ...stats.damageResist }
  if (stats.shieldedDamageReduction != null) enemy.shieldedDamageReduction = stats.shieldedDamageReduction

  return enemy
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
  if (type === 'grunt')    return 10
  if (type === 'tank')     return 16
  if (type === 'speeder')  return 8   // tiny — hard to hit, fast-moving
  if (type === 'armored')  return 18  // largest — lumbering behemoth
  if (type === 'phantom')  return 12  // mid-size
  if (type === 'colossus') return 28  // boss — visually dominant
  if (type === 'healer')   return 11  // slightly smaller than grunt
  if (type === 'splitter') return 14  // mid-size, splits on death
  if (type === 'shielded') return 15  // medium — shielded variant
  // Legacy fallback — hp-ratio sizing
  const ratio = maxHp > 0 ? hp / maxHp : 0
  if (ratio >= 0.5) return 14
  if (ratio >= 0.25) return 11
  return 8
}

/**
 * tickHealerAbilities processes all healer enemies and heals nearby allies.
 *
 * Rules:
 *   - Each healer with type === 'healer' heals every 3 seconds (healIntervalMs).
 *   - Heals the nearest non-healer ally enemy within 2 tiles by 25 HP (capped at maxHp).
 *   - The healer's nextHealAt timestamp is tracked in enemy.nextHealAt.
 *   - Returns an updated enemies array and a list of heal events for animation.
 *
 * @param {Array<object>} enemies
 * @param {number} nowMs - current game clock ms
 * @returns {{ enemies: Array<object>, healEvents: Array<{ healerId: string|number, targetId: string|number, row: number, col: number }> }}
 */
export function tickHealerAbilities(enemies, nowMs) {
  const HEAL_INTERVAL_MS = 3000
  const HEAL_AMOUNT = 25
  const HEAL_RANGE = 2

  // Build a mutable map for quick updates
  const enemyMap = new Map(enemies.map(e => [e.id, { ...e }]))
  const healEvents = []

  for (const [, healer] of enemyMap) {
    if (healer.type !== 'healer') continue

    const nextHealAt = healer.nextHealAt ?? 0
    if (nowMs < nextHealAt) continue

    // Find nearest non-healer enemy within HEAL_RANGE tiles
    let nearestId = null
    let nearestDist = Infinity
    for (const [id, candidate] of enemyMap) {
      if (id === healer.id) continue
      if (candidate.type === 'healer') continue  // healers do not heal other healers
      const dr = healer.pos.row - candidate.pos.row
      const dc = healer.pos.col - candidate.pos.col
      const dist = Math.sqrt(dr * dr + dc * dc)
      if (dist <= HEAL_RANGE && dist < nearestDist) {
        nearestDist = dist
        nearestId = id
      }
    }

    // Update healer's nextHealAt regardless of whether a target was found
    enemyMap.set(healer.id, { ...healer, nextHealAt: nowMs + HEAL_INTERVAL_MS })

    if (nearestId !== null) {
      const target = enemyMap.get(nearestId)
      const newHp = Math.min(target.hp + HEAL_AMOUNT, target.maxHp)
      enemyMap.set(nearestId, { ...target, hp: newHp })
      healEvents.push({ healerId: healer.id, targetId: nearestId, row: target.pos.row, col: target.pos.col })
    }
  }

  return { enemies: [...enemyMap.values()], healEvents }
}

/**
 * isEnemyPoisoned returns true when the enemy currently has an active poison effect.
 * An effect is active when its type is 'poison' and ticksRemaining > 0.
 * @param {{ effects?: Array<{type: string, ticksRemaining: number}> }} enemy
 * @returns {boolean}
 */
export function isEnemyPoisoned(enemy) {
  return (enemy.effects ?? []).some(e => e.type === 'poison' && e.ticksRemaining > 0)
}

/**
 * isEnemyFrozen returns true when the enemy is fully frozen (speedMult === 0 and slowUntil is set).
 * @param {{ slowUntil?: number|null, speedMult?: number }} enemy
 * @returns {boolean}
 */
export function isEnemyFrozen(enemy) {
  return enemy.slowUntil != null && (enemy.speedMult ?? 1) === 0
}

/**
 * isEnemySlowed returns true when the enemy is slowed but not fully frozen
 * (speedMult is between 0 exclusive and 1 exclusive, and slowUntil is set).
 * @param {{ slowUntil?: number|null, speedMult?: number }} enemy
 * @returns {boolean}
 */
export function isEnemySlowed(enemy) {
  const speedMult = enemy.speedMult ?? 1
  return enemy.slowUntil != null && speedMult > 0 && speedMult < 1
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
