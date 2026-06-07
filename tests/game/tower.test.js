import { describe, it, expect } from 'vitest'
import { TOWER_TYPES, createTower, canAfford } from '../../src/game/tower'

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
    })
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
  })

  it('canAfford returns false when gold < SniperTower cost', () => {
    expect(canAfford(99, 'SniperTower')).toBe(false)
  })

  it('canAfford returns true when gold >= SniperTower cost', () => {
    expect(canAfford(100, 'SniperTower')).toBe(true)
  })
})
