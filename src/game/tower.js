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
      { cost: 100, range: 10, damage: 160, fireRate: 1.0 },
    ],
  },
}

/**
 * createTower(type, row, col) — returns a new tower object with combat stats from TOWER_TYPES.
 * Initialises upgradeLevel: 0 on all new towers.
 */
export function createTower(type, row, col) {
  const { range, damage, fireRate } = TOWER_TYPES[type]
  return { type, row, col, range, damage, fireRate, lastFiredAt: 0, upgradeLevel: 0 }
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
  return {
    ...tower,
    upgradeLevel: nextLevel,
    range: upgrade.range,
    damage: upgrade.damage,
    fireRate: upgrade.fireRate,
  }
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
