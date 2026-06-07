import { describe, it, expect } from 'vitest'
import { TOWER_TYPES, createTower, canAfford, canUpgrade, upgradeTower, getUpgradeCost } from '../../src/game/tower'

describe('TOWER_TYPES', () => {
  it('BasicTower has all required fields', () => {
    const bt = TOWER_TYPES.BasicTower
    expect(bt).toBeDefined()
    expect(bt.cost).toBe(50)
    expect(bt.range).toBe(3)
    expect(bt.damage).toBe(25)
    expect(bt.fireRate).toBe(1)
  })

  it('every TOWER_TYPES entry has cost, range, damage, and fireRate', () => {
    for (const [name, config] of Object.entries(TOWER_TYPES)) {
      expect(typeof config.cost, `${name}.cost`).toBe('number')
      expect(typeof config.range, `${name}.range`).toBe('number')
      expect(typeof config.damage, `${name}.damage`).toBe('number')
      expect(typeof config.fireRate, `${name}.fireRate`).toBe('number')
    }
  })

  it('every TOWER_TYPES entry has an upgrades array with at least 1 level', () => {
    for (const [name, config] of Object.entries(TOWER_TYPES)) {
      expect(Array.isArray(config.upgrades), `${name}.upgrades should be array`).toBe(true)
      expect(config.upgrades.length, `${name} should have at least 1 upgrade`).toBeGreaterThan(0)
    }
  })

  it('every upgrade level has cost, range, damage, fireRate', () => {
    for (const [name, config] of Object.entries(TOWER_TYPES)) {
      for (const [i, upgrade] of config.upgrades.entries()) {
        expect(typeof upgrade.cost, `${name}.upgrades[${i}].cost`).toBe('number')
        expect(typeof upgrade.range, `${name}.upgrades[${i}].range`).toBe('number')
        expect(typeof upgrade.damage, `${name}.upgrades[${i}].damage`).toBe('number')
        expect(typeof upgrade.fireRate, `${name}.upgrades[${i}].fireRate`).toBe('number')
      }
    }
  })
})

describe('createTower', () => {
  it('returns a tower object with correct shape including combat stats', () => {
    const tower = createTower('BasicTower', 2, 5)
    expect(tower).toEqual({
      type: 'BasicTower',
      row: 2,
      col: 5,
      range: 3,
      damage: 25,
      fireRate: 1,
      lastFiredAt: 0,
      upgradeLevel: 0,
    })
  })

  it('initialises upgradeLevel to 0', () => {
    const tower = createTower('BasicTower', 0, 0)
    expect(tower.upgradeLevel).toBe(0)
  })

  it('SniperTower initialises with upgradeLevel 0', () => {
    const tower = createTower('SniperTower', 1, 1)
    expect(tower.upgradeLevel).toBe(0)
  })
})

describe('canAfford', () => {
  it('returns true when gold equals cost', () => {
    expect(canAfford(50, 'BasicTower')).toBe(true)
  })

  it('returns true when gold exceeds cost', () => {
    expect(canAfford(100, 'BasicTower')).toBe(true)
  })

  it('returns false when gold is less than cost', () => {
    expect(canAfford(49, 'BasicTower')).toBe(false)
  })

  it('returns false when gold is 0', () => {
    expect(canAfford(0, 'BasicTower')).toBe(false)
  })
})

describe('canUpgrade', () => {
  it('returns true when tower is at level 0 (upgrades available)', () => {
    const tower = createTower('BasicTower', 0, 0)
    expect(canUpgrade(tower)).toBe(true)
  })

  it('returns false when tower is at max level', () => {
    const tower = createTower('BasicTower', 0, 0)
    const maxLevel = TOWER_TYPES.BasicTower.upgrades.length
    const maxTower = { ...tower, upgradeLevel: maxLevel }
    expect(canUpgrade(maxTower)).toBe(false)
  })

  it('returns false when tower is at max level for SniperTower', () => {
    const tower = createTower('SniperTower', 0, 0)
    const maxLevel = TOWER_TYPES.SniperTower.upgrades.length
    const maxTower = { ...tower, upgradeLevel: maxLevel }
    expect(canUpgrade(maxTower)).toBe(false)
  })

  it('returns true when at intermediate level (still has upgrades)', () => {
    const tower = createTower('BasicTower', 0, 0)
    // level 1 still has level 2 upgrade
    const level1 = { ...tower, upgradeLevel: 1 }
    if (TOWER_TYPES.BasicTower.upgrades.length > 1) {
      expect(canUpgrade(level1)).toBe(true)
    }
  })
})

describe('upgradeTower', () => {
  it('increases upgradeLevel by 1', () => {
    const tower = createTower('BasicTower', 0, 0)
    const upgraded = upgradeTower(tower)
    expect(upgraded.upgradeLevel).toBe(1)
  })

  it('applies upgrade stats (range, damage, fireRate improve)', () => {
    const tower = createTower('BasicTower', 0, 0)
    const upgraded = upgradeTower(tower)
    const upgrade = TOWER_TYPES.BasicTower.upgrades[0]
    expect(upgraded.range).toBe(upgrade.range)
    expect(upgraded.damage).toBe(upgrade.damage)
    expect(upgraded.fireRate).toBe(upgrade.fireRate)
  })

  it('is a no-op when tower is at max level', () => {
    const tower = createTower('BasicTower', 0, 0)
    const maxLevel = TOWER_TYPES.BasicTower.upgrades.length
    const maxTower = { ...tower, upgradeLevel: maxLevel }
    const result = upgradeTower(maxTower)
    expect(result).toBe(maxTower)
    expect(result.upgradeLevel).toBe(maxLevel)
  })

  it('returns a new object (does not mutate original)', () => {
    const tower = createTower('BasicTower', 0, 0)
    const upgraded = upgradeTower(tower)
    expect(upgraded).not.toBe(tower)
    expect(tower.upgradeLevel).toBe(0)
  })

  it('can upgrade twice on a tower with 2 upgrade levels', () => {
    const tower = createTower('BasicTower', 0, 0)
    const level1 = upgradeTower(tower)
    const level2 = upgradeTower(level1)
    expect(level2.upgradeLevel).toBe(2)
    const upgrade2 = TOWER_TYPES.BasicTower.upgrades[1]
    expect(level2.range).toBe(upgrade2.range)
    expect(level2.damage).toBe(upgrade2.damage)
  })

  it('preserves row and col when upgrading', () => {
    const tower = createTower('BasicTower', 3, 7)
    const upgraded = upgradeTower(tower)
    expect(upgraded.row).toBe(3)
    expect(upgraded.col).toBe(7)
  })
})

describe('getUpgradeCost', () => {
  it('returns the cost of the next upgrade level', () => {
    const tower = createTower('BasicTower', 0, 0)
    const cost = getUpgradeCost(tower)
    expect(cost).toBe(TOWER_TYPES.BasicTower.upgrades[0].cost)
  })

  it('returns null when tower is at max level', () => {
    const tower = createTower('BasicTower', 0, 0)
    const maxLevel = TOWER_TYPES.BasicTower.upgrades.length
    const maxTower = { ...tower, upgradeLevel: maxLevel }
    expect(getUpgradeCost(maxTower)).toBeNull()
  })
})

describe('placement deducts correct amount', () => {
  it('cost of BasicTower is 50', () => {
    const cost = TOWER_TYPES.BasicTower.cost
    const goldBefore = 100
    const goldAfter = goldBefore - cost
    expect(goldAfter).toBe(50)
  })
})

describe('SniperTower', () => {
  it('SniperTower has higher range and damage than BasicTower', () => {
    const sniper = TOWER_TYPES.SniperTower
    const basic = TOWER_TYPES.BasicTower
    expect(sniper).toBeDefined()
    expect(sniper.range).toBeGreaterThan(basic.range)
    expect(sniper.damage).toBeGreaterThan(basic.damage)
    expect(sniper.cost).toBeGreaterThan(basic.cost)
  })

  it('createTower places a SniperTower when selectedTowerType is SniperTower', () => {
    const selectedTowerType = 'SniperTower'
    const tower = createTower(selectedTowerType, 3, 7)
    expect(tower.type).toBe('SniperTower')
    expect(tower.range).toBe(TOWER_TYPES.SniperTower.range)
    expect(tower.damage).toBe(TOWER_TYPES.SniperTower.damage)
    expect(tower.fireRate).toBe(TOWER_TYPES.SniperTower.fireRate)
    expect(tower.row).toBe(3)
    expect(tower.col).toBe(7)
    expect(tower.lastFiredAt).toBe(0)
    expect(tower.upgradeLevel).toBe(0)
  })

  it('canAfford returns false when gold < SniperTower cost', () => {
    expect(canAfford(99, 'SniperTower')).toBe(false)
  })

  it('canAfford returns true when gold >= SniperTower cost', () => {
    expect(canAfford(100, 'SniperTower')).toBe(true)
  })
})
