import { describe, it, expect } from 'vitest'
import { TOWER_TYPES, createTower, canAfford, canUpgrade, upgradeTower, getUpgradeCost, getNextUpgradeStats, sellTower } from '../../src/game/tower'

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

describe('getNextUpgradeStats', () => {
  it('returns next level stats for an upgradable tower', () => {
    const tower = createTower('BasicTower', 0, 0)
    const stats = getNextUpgradeStats(tower)
    const expected = TOWER_TYPES.BasicTower.upgrades[0]
    expect(stats).toEqual({ range: expected.range, damage: expected.damage, fireRate: expected.fireRate })
  })

  it('returns null when tower is at max level', () => {
    const tower = createTower('BasicTower', 0, 0)
    const maxLevel = TOWER_TYPES.BasicTower.upgrades.length
    const maxTower = { ...tower, upgradeLevel: maxLevel }
    expect(getNextUpgradeStats(maxTower)).toBeNull()
  })

  it('returns level-1 upgrade stats for a level-1 SniperTower', () => {
    const tower = createTower('SniperTower', 0, 0)
    const level1 = { ...tower, upgradeLevel: 1 }
    const stats = getNextUpgradeStats(level1)
    const expected = TOWER_TYPES.SniperTower.upgrades[1]
    expect(stats).toEqual({ range: expected.range, damage: expected.damage, fireRate: expected.fireRate })
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

describe('RapidTower', () => {
  it('has higher fireRate than BasicTower', () => {
    expect(TOWER_TYPES.RapidTower.fireRate).toBeGreaterThan(TOWER_TYPES.BasicTower.fireRate)
  })

  it('has lower cost than SniperTower', () => {
    expect(TOWER_TYPES.RapidTower.cost).toBeLessThan(TOWER_TYPES.SniperTower.cost)
  })

  it('createTower creates a RapidTower with correct stats', () => {
    const t = createTower('RapidTower', 2, 3)
    expect(t.type).toBe('RapidTower')
    expect(t.fireRate).toBe(TOWER_TYPES.RapidTower.fireRate)
    expect(t.damage).toBe(TOWER_TYPES.RapidTower.damage)
    expect(t.upgradeLevel).toBe(0)
  })

  it('has no splashRadius or slowFactor', () => {
    const t = createTower('RapidTower', 0, 0)
    expect(t.splashRadius).toBeUndefined()
    expect(t.slowFactor).toBeUndefined()
  })
})

describe('CannonTower', () => {
  it('has splashRadius defined in TOWER_TYPES', () => {
    expect(TOWER_TYPES.CannonTower.splashRadius).toBeGreaterThan(0)
  })

  it('createTower includes splashRadius on the tower object', () => {
    const t = createTower('CannonTower', 0, 0)
    expect(t.splashRadius).toBe(TOWER_TYPES.CannonTower.splashRadius)
  })

  it('has higher cost than BasicTower', () => {
    expect(TOWER_TYPES.CannonTower.cost).toBeGreaterThan(TOWER_TYPES.BasicTower.cost)
  })

  it('upgradeTower preserves splashRadius at each upgrade level', () => {
    let t = createTower('CannonTower', 0, 0)
    t = upgradeTower(t)
    expect(t.splashRadius).toBe(TOWER_TYPES.CannonTower.upgrades[0].splashRadius)
    t = upgradeTower(t)
    expect(t.splashRadius).toBe(TOWER_TYPES.CannonTower.upgrades[1].splashRadius)
  })

  it('each upgrade level increases splashRadius', () => {
    const base = TOWER_TYPES.CannonTower.splashRadius
    const lvl1 = TOWER_TYPES.CannonTower.upgrades[0].splashRadius
    const lvl2 = TOWER_TYPES.CannonTower.upgrades[1].splashRadius
    expect(lvl1).toBeGreaterThan(base)
    expect(lvl2).toBeGreaterThan(lvl1)
  })
})

describe('SlowTower', () => {
  it('has slowFactor and slowDuration defined in TOWER_TYPES', () => {
    expect(TOWER_TYPES.SlowTower.slowFactor).toBeDefined()
    expect(TOWER_TYPES.SlowTower.slowDuration).toBeDefined()
  })

  it('slowFactor is between 0 and 1 (exclusive)', () => {
    expect(TOWER_TYPES.SlowTower.slowFactor).toBeGreaterThan(0)
    expect(TOWER_TYPES.SlowTower.slowFactor).toBeLessThan(1)
  })

  it('createTower includes slowFactor and slowDuration', () => {
    const t = createTower('SlowTower', 1, 2)
    expect(t.slowFactor).toBe(TOWER_TYPES.SlowTower.slowFactor)
    expect(t.slowDuration).toBe(TOWER_TYPES.SlowTower.slowDuration)
  })

  it('upgradeTower carries slowFactor improvements forward', () => {
    let t = createTower('SlowTower', 0, 0)
    const baseSlowFactor = t.slowFactor
    t = upgradeTower(t)
    // Upgrade level 1 should have a lower (stronger) slowFactor than base
    expect(t.slowFactor).toBeLessThan(baseSlowFactor)
  })

  it('has no splashRadius', () => {
    const t = createTower('SlowTower', 0, 0)
    expect(t.splashRadius).toBeUndefined()
  })

  it('sellTower returns 70% of base cost rounded down', () => {
    const t = createTower('SlowTower', 0, 0)
    const expected = Math.floor(TOWER_TYPES.SlowTower.cost * 0.7)
    expect(sellTower(t)).toEqual({ refund: expected })
  })
})

describe('sellTower', () => {
  it('returns 70% of BasicTower base cost (50), rounded down = 35', () => {
    const tower = createTower('BasicTower', 0, 0)
    expect(sellTower(tower)).toEqual({ refund: 35 })
  })

  it('returns 70% of SniperTower base cost (100), rounded down = 70', () => {
    const tower = createTower('SniperTower', 2, 3)
    expect(sellTower(tower)).toEqual({ refund: 70 })
  })

  it('refund is the same regardless of upgrade level (upgrade costs are not refunded)', () => {
    const tower = createTower('BasicTower', 0, 0)
    const upgraded = upgradeTower(tower)
    expect(sellTower(tower).refund).toBe(sellTower(upgraded).refund)
  })

  it('returns refund: 0 for unknown tower type', () => {
    const fakeTower = { type: 'UnknownTower', row: 0, col: 0, upgradeLevel: 0 }
    expect(sellTower(fakeTower)).toEqual({ refund: 0 })
  })
})
