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
  if (stats.slowResist != null)    enemy.slowResist    = stats.slowResist
  if (stats.damageResist != null)  enemy.damageResist  = { ...stats.damageResist }

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
  // Legacy fallback — hp-ratio sizing
  const ratio = maxHp > 0 ? hp / maxHp : 0
  if (ratio >= 0.5) return 14
  if (ratio >= 0.25) return 11
  return 8
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
