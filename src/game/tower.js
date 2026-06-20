/**
 * tower.js — pure game logic for tower management
 * No side effects, no React imports.
 */

/**
 * TOWER_TYPES defines all available tower configurations.
 * Each type includes an `upgrades` array with 1-2 upgrade levels.
 * Each upgrade level has absolute stat values (range, damage, fireRate) and a cost to upgrade.
 */
export const TOWER_TYPES = {
  BasicTower: {
    cost: 50,
    range: 3,
    damage: 25,
    fireRate: 1,
    upgrades: [
      { cost: 40, range: 4, damage: 35, fireRate: 1.2 },
      { cost: 60, range: 5, damage: 50, fireRate: 1.5 },
    ],
  },
  SniperTower: {
    cost: 100,
    range: 6,
    damage: 75,
    fireRate: 0.5,
    upgrades: [
      { cost: 75, range: 8, damage: 110, fireRate: 0.7 },
      { cost: 100, range: 10, damage: 160, fireRate: 1.0, critChance: 0.20 },
    ],
  },
  /**
   * RapidTower — high fire rate, low damage, short range.
   * Best against swarms of fast enemies (grunts).
   */
  RapidTower: {
    cost: 75,
    range: 2,
    damage: 12,
    fireRate: 4,
    upgrades: [
      { cost: 50, range: 2.5, damage: 18, fireRate: 5 },
      { cost: 80, range: 3, damage: 25, fireRate: 6 },
    ],
  },
  /**
   * CannonTower — slow fire rate, very high damage, splash AoE (splashRadius = 1.5 tiles).
   * Damages all enemies within splashRadius of the primary target.
   * Best against packed groups and tanks.
   */
  CannonTower: {
    cost: 150,
    range: 4,
    damage: 120,
    fireRate: 0.4,
    splashRadius: 1.5,
    upgrades: [
      { cost: 100, range: 4.5, damage: 180, fireRate: 0.5, splashRadius: 1.75 },
      { cost: 150, range: 5, damage: 260, fireRate: 0.6, splashRadius: 2.0 },
    ],
  },
  /**
   * SlowTower — low damage, medium range, applies a slow debuff on hit.
   * Each hit slows the enemy to slowFactor (0–1) of its normal speed for slowDuration ms.
   * Synergises with all other towers by keeping enemies in range longer.
   */
  SlowTower: {
    cost: 75,
    range: 3,
    damage: 5,
    fireRate: 1.5,
    slowFactor: 0.4,
    slowDuration: 2000,
    upgrades: [
      { cost: 60, range: 4, damage: 8, fireRate: 1.8, slowFactor: 0.35, slowDuration: 2500 },
      { cost: 90, range: 4.5, damage: 12, fireRate: 2, slowFactor: 0.3, slowDuration: 3000, aoeSlowRadius: 2.5 },
    ],
  },
  /**
   * MortarTower — slow, deliberate AoE artillery tower.
   * Lobs explosive shells at the tile with the highest enemy density in range.
   * Center hit deals full damage; enemies within splashRadius take splash damage.
   * Splash damage is separate: enemies at the center can take both center + splash.
   * Synergises well with SlowTower (enemies bunch up, maximising blast value).
   * L1 upgrade: higher damage, larger splash radius.
   * L2 upgrade: even higher damage, larger splash radius, +1 range.
   */
  MortarTower: {
    cost: 125,
    range: 5,
    damage: 40,
    fireRate: 0.4,
    splashDamage: 20,
    splashRadius: 1.5,
    upgrades: [
      { cost: 80, range: 5, damage: 55, fireRate: 0.4, splashDamage: 28, splashRadius: 2.0 },
      { cost: 120, range: 6, damage: 80, fireRate: 0.4, splashDamage: 40, splashRadius: 2.5 },
    ],
  },
  /**
   * PoisonTower — medium range, applies a damage-over-time (DoT) poison on hit.
   * Initial hit deals direct damage; then the poison ticks for additional damage.
   * DoT continues even if the tower is sold. DoT kills award gold normally.
   * L1 upgrade: +2 extra DoT ticks (5 total).
   * L2 upgrade: +20 DoT damage per tick (35 per tick).
   */
  PoisonTower: {
    cost: 90,
    range: 4,
    damage: 8,
    fireRate: 0.8,
    poisonTickDamage: 15,
    poisonTicks: 3,
    poisonTickInterval: 1000,
    upgrades: [
      { cost: 70, range: 4.5, damage: 12, fireRate: 1.0, poisonTickDamage: 15, poisonTicks: 5, poisonTickInterval: 1000 },
      { cost: 100, range: 5, damage: 16, fireRate: 1.2, poisonTickDamage: 35, poisonTicks: 5, poisonTickInterval: 1000 },
    ],
  },
  /**
   * LightningTower — fires a bolt that arcs between up to 3 nearby enemies.
   * Primary target takes full damage; each chain target takes 50% of the previous hit.
   * chainRadius: maximum tile distance between chained targets.
   * maxChains: total chain hops after the primary target.
   * L1 upgrade: wider chain radius, slightly higher fire rate.
   * L2 upgrade: +1 chain hop (4 total), more damage.
   */
  LightningTower: {
    cost: 110,
    range: 4,
    damage: 45,
    fireRate: 0.8,
    chainRadius: 2.5,
    maxChains: 3,
    upgrades: [
      { cost: 80, range: 4.5, damage: 60, fireRate: 1.0, chainRadius: 3.0, maxChains: 3 },
      { cost: 120, range: 5, damage: 85, fireRate: 1.2, chainRadius: 3.5, maxChains: 4 },
    ],
  },
}

/**
 * getChainTargets(primary, enemies, chainRadius, maxChains) — pure function.
 * Returns an ordered list of enemies that the lightning bolt chains to after the primary target.
 *
 * Algorithm:
 *   Starting from the primary target's position, find the nearest enemy (not yet hit)
 *   within chainRadius tiles. Chain up to maxChains times.
 *   The returned list does NOT include the primary target itself.
 *
 * @param {{ id: string|number, pos: { row: number, col: number } }} primary - the first target
 * @param {Array<{ id: string|number, pos: { row: number, col: number } }>} enemies - all living enemies
 * @param {number} chainRadius - maximum tile distance for each chain hop
 * @param {number} maxChains - maximum number of additional targets (hops after primary)
 * @returns {Array<{ id: string|number, pos: { row: number, col: number } }>}
 */
export function getChainTargets(primary, enemies, chainRadius, maxChains) {
  const targets = []
  const hitIds = new Set([primary.id])
  let currentPos = primary.pos

  for (let hop = 0; hop < maxChains; hop++) {
    let bestDist = Infinity
    let bestEnemy = null

    for (const enemy of enemies) {
      if (hitIds.has(enemy.id)) continue
      const dr = currentPos.row - enemy.pos.row
      const dc = currentPos.col - enemy.pos.col
      const dist = Math.sqrt(dr * dr + dc * dc)
      if (dist <= chainRadius && dist < bestDist) {
        bestDist = dist
        bestEnemy = enemy
      }
    }

    if (!bestEnemy) break
    targets.push(bestEnemy)
    hitIds.add(bestEnemy.id)
    currentPos = bestEnemy.pos
  }

  return targets
}

/**
 * createTower(type, row, col) — returns a new tower object with combat stats from TOWER_TYPES.
 * Initialises upgradeLevel: 0 on all new towers.
 */
export function createTower(type, row, col) {
  const typeDef = TOWER_TYPES[type]
  const { range, damage, fireRate } = typeDef
  // All towers have a base 10% critical hit chance; SniperTower L2 upgrades this to 20%
  const tower = { type, row, col, range, damage, fireRate, lastFiredAt: 0, upgradeLevel: 0, kills: 0, critChance: 0.10 }
  // Include special properties for towers that have unique mechanics
  if (typeDef.splashRadius      != null) tower.splashRadius      = typeDef.splashRadius
  if (typeDef.splashDamage      != null) tower.splashDamage      = typeDef.splashDamage
  if (typeDef.slowFactor        != null) tower.slowFactor        = typeDef.slowFactor
  if (typeDef.slowDuration      != null) tower.slowDuration      = typeDef.slowDuration
  if (typeDef.aoeSlowRadius     != null) tower.aoeSlowRadius     = typeDef.aoeSlowRadius
  if (typeDef.poisonTickDamage  != null) tower.poisonTickDamage  = typeDef.poisonTickDamage
  if (typeDef.poisonTicks       != null) tower.poisonTicks       = typeDef.poisonTicks
  if (typeDef.poisonTickInterval!= null) tower.poisonTickInterval= typeDef.poisonTickInterval
  if (typeDef.chainRadius       != null) tower.chainRadius       = typeDef.chainRadius
  if (typeDef.maxChains         != null) tower.maxChains         = typeDef.maxChains
  return tower
}

/**
 * canAfford(gold, towerType) — returns true if the player has enough gold.
 */
export function canAfford(gold, towerType) {
  const tower = TOWER_TYPES[towerType]
  if (!tower) return false
  return gold >= tower.cost
}

/**
 * canUpgrade(tower) — returns true if the tower has a next upgrade level available.
 */
export function canUpgrade(tower) {
  const typeDef = TOWER_TYPES[tower.type]
  if (!typeDef) return false
  return tower.upgradeLevel < typeDef.upgrades.length
}

/**
 * upgradeTower(tower) — returns a new tower object at the next upgrade level.
 * No-op (returns the same tower) if already at max level.
 */
export function upgradeTower(tower) {
  if (!canUpgrade(tower)) return tower
  const typeDef = TOWER_TYPES[tower.type]
  const nextLevel = tower.upgradeLevel + 1
  const upgrade = typeDef.upgrades[tower.upgradeLevel]
  const updated = {
    ...tower,
    upgradeLevel: nextLevel,
    range: upgrade.range,
    damage: upgrade.damage,
    fireRate: upgrade.fireRate,
  }
  // Carry over special properties from the upgrade level definition when present
  if (upgrade.splashRadius      != null) updated.splashRadius      = upgrade.splashRadius
  if (upgrade.splashDamage      != null) updated.splashDamage      = upgrade.splashDamage
  if (upgrade.slowFactor        != null) updated.slowFactor        = upgrade.slowFactor
  if (upgrade.slowDuration      != null) updated.slowDuration      = upgrade.slowDuration
  if (upgrade.aoeSlowRadius     != null) updated.aoeSlowRadius     = upgrade.aoeSlowRadius
  if (upgrade.poisonTickDamage  != null) updated.poisonTickDamage  = upgrade.poisonTickDamage
  if (upgrade.poisonTicks       != null) updated.poisonTicks       = upgrade.poisonTicks
  if (upgrade.poisonTickInterval!= null) updated.poisonTickInterval= upgrade.poisonTickInterval
  if (upgrade.critChance        != null) updated.critChance        = upgrade.critChance
  if (upgrade.chainRadius       != null) updated.chainRadius       = upgrade.chainRadius
  if (upgrade.maxChains         != null) updated.maxChains         = upgrade.maxChains
  return updated
}

/**
 * getUpgradeCost(tower) — returns the gold cost to upgrade the tower to the next level.
 * Returns null if the tower is already at max level.
 */
export function getUpgradeCost(tower) {
  if (!canUpgrade(tower)) return null
  const typeDef = TOWER_TYPES[tower.type]
  return typeDef.upgrades[tower.upgradeLevel].cost
}

/**
 * getNextUpgradeStats(tower) — returns the next upgrade level's stats { range, damage, fireRate }.
 * Returns null if the tower is already at max level.
 */
export function getNextUpgradeStats(tower) {
  if (!canUpgrade(tower)) return null
  const typeDef = TOWER_TYPES[tower.type]
  if (!typeDef) return null
  const { range, damage, fireRate } = typeDef.upgrades[tower.upgradeLevel]
  return { range, damage, fireRate }
}

/**
 * UPGRADE_STAT_LABELS defines the display name and format for every upgradable stat.
 * Used by getUpgradePreview to build the diff rows.
 */
const UPGRADE_STAT_KEYS = [
  { key: 'damage',           label: 'Damage' },
  { key: 'range',            label: 'Range' },
  { key: 'fireRate',         label: 'Fire Rate' },
  { key: 'splashRadius',     label: 'Splash Radius' },
  { key: 'splashDamage',     label: 'Splash Dmg' },
  { key: 'slowFactor',       label: 'Slow Factor' },
  { key: 'slowDuration',     label: 'Slow Dur (ms)' },
  { key: 'aoeSlowRadius',    label: 'AoE Slow Radius' },
  { key: 'poisonTickDamage', label: 'Poison Tick Dmg' },
  { key: 'poisonTicks',      label: 'Poison Ticks' },
  { key: 'critChance',       label: 'Crit Chance' },
  { key: 'chainRadius',      label: 'Chain Radius' },
  { key: 'maxChains',        label: 'Chain Hops' },
]

/**
 * getUpgradePreview(tower) — returns a rich diff object for the UpgradePanel.
 *
 * Returns null when the tower is at max level.
 *
 * Return shape:
 * {
 *   cost: number,
 *   rows: Array<{
 *     label: string,
 *     current: number | string,
 *     next: number | string,
 *     delta: number | null,   // null when unchanged
 *     isNew: boolean,         // true when the stat did not exist at current level
 *   }>
 * }
 */
export function getUpgradePreview(tower) {
  if (!canUpgrade(tower)) return null
  const typeDef = TOWER_TYPES[tower.type]
  if (!typeDef) return null
  const upgrade = typeDef.upgrades[tower.upgradeLevel]
  const cost = upgrade.cost

  const rows = []
  for (const { key, label } of UPGRADE_STAT_KEYS) {
    const currentVal = tower[key]
    const nextVal = upgrade[key]

    // Skip if neither the current tower nor the next upgrade defines this stat
    if (currentVal == null && nextVal == null) continue

    const isNew = currentVal == null && nextVal != null
    const current = isNew ? null : currentVal
    const next = nextVal != null ? nextVal : currentVal
    const delta = isNew ? null : (nextVal != null ? +(nextVal - currentVal).toFixed(4) : null)

    rows.push({ label, current, next, delta, isNew })
  }

  return { cost, rows }
}

/**
 * MAX_GOLD — the maximum gold a player can hold.
 * Selling a tower when gold is already at this cap is disallowed (the Sell button is disabled).
 */
export const MAX_GOLD = 9999

/**
 * sellTower(tower) — returns the gold refund for selling a placed tower.
 * Refund = Math.floor(baseCost * 0.5). Upgrade costs are NOT refunded.
 */
export function sellTower(tower) {
  const typeDef = TOWER_TYPES[tower.type]
  if (!typeDef) return { refund: 0 }
  return { refund: Math.floor(typeDef.cost * 0.5) }
}

/**
 * SYNERGY_RULES defines all tower-pair adjacency synergy combinations.
 * Each entry describes a pair and the effect applied to each tower in the pair.
 *
 * Fields per effect entry:
 *   targetType  — which tower type in the pair receives this buff
 *   fireRateMult — multiplicative bonus to fire rate (default 1 = no change)
 *   rangePlus    — additive bonus to range (default 0)
 *   description  — human-readable synergy description shown in UpgradePanel
 *   poisonOnHit  — boolean: SniperTower shots apply 1 poison tick on hit
 *   freezeOnHit  — boolean: SniperTower shots freeze target for 0.5s on hit
 */
export const SYNERGY_RULES = [
  {
    pairKey: 'BasicTower+SlowTower',
    typeA: 'BasicTower',
    typeB: 'SlowTower',
    effects: [
      {
        targetType: 'BasicTower',
        fireRateMult: 1.2,
        rangePlus: 0,
        description: 'Adjacent SlowTower: +20% fire rate',
      },
      {
        targetType: 'SlowTower',
        fireRateMult: 1,
        rangePlus: 1,
        description: 'Adjacent BasicTower: +1 range',
      },
    ],
  },
  {
    pairKey: 'SniperTower+PoisonTower',
    typeA: 'SniperTower',
    typeB: 'PoisonTower',
    effects: [
      {
        targetType: 'SniperTower',
        fireRateMult: 1,
        rangePlus: 0,
        poisonOnHit: true,
        description: 'Adjacent PoisonTower: shots apply 1 poison tick on hit',
      },
    ],
  },
  {
    pairKey: 'BasicTower+BasicTower',
    typeA: 'BasicTower',
    typeB: 'BasicTower',
    effects: [
      {
        targetType: 'BasicTower',
        fireRateMult: 1,
        rangePlus: 0,
        damageMult: 1.1,
        description: 'Adjacent BasicTower: +10% damage',
      },
    ],
  },
  {
    pairKey: 'SniperTower+SlowTower',
    typeA: 'SniperTower',
    typeB: 'SlowTower',
    effects: [
      {
        targetType: 'SniperTower',
        fireRateMult: 1,
        rangePlus: 0,
        freezeOnHit: true,
        description: 'Adjacent SlowTower: shots freeze target for 0.5s',
      },
    ],
  },
]

/**
 * towerKey(tower) — returns a string key for a tower based on its position.
 * @param {{ row: number, col: number }} tower
 * @returns {string}
 */
export function towerKey(tower) {
  return `${tower.row}-${tower.col}`
}

/**
 * areAdjacent(a, b) — returns true if towers a and b are in adjacent tiles
 * (horizontal, vertical, or diagonal; Chebyshev distance = 1).
 * @param {{ row: number, col: number }} a
 * @param {{ row: number, col: number }} b
 * @returns {boolean}
 */
function areAdjacent(a, b) {
  const dr = Math.abs(a.row - b.row)
  const dc = Math.abs(a.col - b.col)
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)
}

/**
 * getAdjacentSynergies(towers) — pure function; returns a Map from towerKey to
 * an array of active synergy effect objects for that tower.
 *
 * Each synergy effect object has the shape:
 *   { pairKey, targetType, fireRateMult?, rangePlus?, damageMult?, poisonOnHit?, freezeOnHit?, description }
 *
 * @param {Array<{ row: number, col: number, type: string }>} towers
 * @returns {Map<string, Array<object>>}
 */
export function getAdjacentSynergies(towers) {
  const result = new Map()

  for (const tower of towers) {
    result.set(towerKey(tower), [])
  }

  // Check every pair of towers (i < j to avoid double-counting the pair lookup)
  for (let i = 0; i < towers.length; i++) {
    for (let j = i + 1; j < towers.length; j++) {
      const a = towers[i]
      const b = towers[j]
      if (!areAdjacent(a, b)) continue

      for (const rule of SYNERGY_RULES) {
        const matchAB = a.type === rule.typeA && b.type === rule.typeB
        const matchBA = b.type === rule.typeA && a.type === rule.typeB
        // For same-type pairs (e.g. BasicTower+BasicTower), matchAB and matchBA are both true
        // when typeA === typeB — avoid applying twice for each tower
        const isSameType = rule.typeA === rule.typeB

        if (matchAB || matchBA) {
          for (const effect of rule.effects) {
            // Determine which actual tower(s) should receive this effect
            if (isSameType) {
              // Both towers are the same type and both receive the same effect
              const keyA = towerKey(a)
              const keyB = towerKey(b)
              result.get(keyA).push({ ...effect, pairKey: rule.pairKey })
              result.get(keyB).push({ ...effect, pairKey: rule.pairKey })
            } else if (matchAB) {
              // a matches typeA, b matches typeB
              if (effect.targetType === rule.typeA) {
                result.get(towerKey(a)).push({ ...effect, pairKey: rule.pairKey })
              }
              if (effect.targetType === rule.typeB) {
                result.get(towerKey(b)).push({ ...effect, pairKey: rule.pairKey })
              }
            } else {
              // matchBA: b matches typeA, a matches typeB
              if (effect.targetType === rule.typeA) {
                result.get(towerKey(b)).push({ ...effect, pairKey: rule.pairKey })
              }
              if (effect.targetType === rule.typeB) {
                result.get(towerKey(a)).push({ ...effect, pairKey: rule.pairKey })
              }
            }
          }
        }
      }
    }
  }

  return result
}

/**
 * getSynergyPartners(towers) — pure function; returns a Map from towerKey to
 * an array of synergy partner descriptors for visual line rendering.
 *
 * Each entry: { partnerRow, partnerCol, effectType, description }
 * effectType: 'fireRate' | 'freeze' | 'poison' | 'range'
 *   'fireRate' — teal line  (fireRateMult > 1 or damageMult)
 *   'freeze'   — red line   (freezeOnHit)
 *   'poison'   — green line (poisonOnHit)
 *   'range'    — blue line  (rangePlus > 0)
 *
 * @param {Array<{ row: number, col: number, type: string }>} towers
 * @returns {Map<string, Array<{ partnerRow: number, partnerCol: number, effectType: string, description: string }>>}
 */
export function getSynergyPartners(towers) {
  const result = new Map()
  for (const tower of towers) {
    result.set(towerKey(tower), [])
  }

  function effectType(effect) {
    if (effect.freezeOnHit) return 'freeze'
    if (effect.poisonOnHit) return 'poison'
    if (effect.rangePlus && effect.rangePlus > 0) return 'range'
    return 'fireRate'
  }

  for (let i = 0; i < towers.length; i++) {
    for (let j = i + 1; j < towers.length; j++) {
      const a = towers[i]
      const b = towers[j]
      if (!areAdjacent(a, b)) continue

      for (const rule of SYNERGY_RULES) {
        const matchAB = a.type === rule.typeA && b.type === rule.typeB
        const matchBA = b.type === rule.typeA && a.type === rule.typeB
        const isSameType = rule.typeA === rule.typeB

        if (matchAB || matchBA) {
          for (const effect of rule.effects) {
            const etype = effectType(effect)
            if (isSameType) {
              result.get(towerKey(a)).push({ partnerRow: b.row, partnerCol: b.col, effectType: etype, description: effect.description })
              result.get(towerKey(b)).push({ partnerRow: a.row, partnerCol: a.col, effectType: etype, description: effect.description })
            } else if (matchAB) {
              if (effect.targetType === rule.typeA) {
                result.get(towerKey(a)).push({ partnerRow: b.row, partnerCol: b.col, effectType: etype, description: effect.description })
              }
              if (effect.targetType === rule.typeB) {
                result.get(towerKey(b)).push({ partnerRow: a.row, partnerCol: a.col, effectType: etype, description: effect.description })
              }
            } else {
              if (effect.targetType === rule.typeA) {
                result.get(towerKey(b)).push({ partnerRow: a.row, partnerCol: a.col, effectType: etype, description: effect.description })
              }
              if (effect.targetType === rule.typeB) {
                result.get(towerKey(a)).push({ partnerRow: b.row, partnerCol: b.col, effectType: etype, description: effect.description })
              }
            }
          }
        }
      }
    }
  }

  return result
}
