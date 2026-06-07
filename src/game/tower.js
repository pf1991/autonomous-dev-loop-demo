/**
 * tower.js — pure game logic for tower management
 * No side effects, no React imports.
 */

/**
 * TOWER_TYPES defines all available tower configurations.
 */
export const TOWER_TYPES = {
  BasicTower: {
    cost: 50,
    range: 3,
    damage: 25,
    fireRate: 1,
  },
  SniperTower: {
    cost: 100,
    range: 6,
    damage: 75,
    fireRate: 0.5,
  },
}

/**
 * createTower(type, row, col) — returns a new tower object with combat stats from TOWER_TYPES.
 */
export function createTower(type, row, col) {
  const { range, damage, fireRate } = TOWER_TYPES[type]
  return { type, row, col, range, damage, fireRate, lastFiredAt: 0 }
}

/**
 * canAfford(gold, towerType) — returns true if the player has enough gold.
 */
export function canAfford(gold, towerType) {
  const tower = TOWER_TYPES[towerType]
  if (!tower) return false
  return gold >= tower.cost
}
