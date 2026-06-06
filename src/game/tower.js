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
}

/**
 * createTower(type, row, col) — returns a new tower object.
 */
export function createTower(type, row, col) {
  return { type, row, col, lastFiredAt: 0 }
}

/**
 * canAfford(gold, towerType) — returns true if the player has enough gold.
 */
export function canAfford(gold, towerType) {
  const tower = TOWER_TYPES[towerType]
  if (!tower) return false
  return gold >= tower.cost
}
