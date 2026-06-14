import { describe, it, expect } from 'vitest'
import { rollCrit, processCombat } from '../../src/game/combat'
import { createTower, upgradeTower, TOWER_TYPES } from '../../src/game/tower'

// Helper: build a tower with explicit critChance (so existing test helpers without critChance stay safe)
function makeCritTower({
  row = 0,
  col = 0,
  type = 'BasicTower',
  range = 5,
  damage = 25,
  fireRate = 1,
  lastFiredAt = 0,
  critChance = 0.10,
} = {}) {
  return { row, col, type, range, damage, fireRate, lastFiredAt, upgradeLevel: 0, kills: 0, critChance }
}

// Helper: build an enemy at (row, col) with goldReward
function makeEnemy({ id = 1, hp = 100, row = 0, col = 1, goldReward = 10 } = {}) {
  return { id, hp, maxHp: hp, pos: { row, col }, goldReward }
}

// ===== rollCrit tests =====

describe('rollCrit', () => {
  it('always returns true when rng returns 0 (below any positive chance)', () => {
    expect(rollCrit(0.10, () => 0)).toBe(true)
  })

  it('always returns true when rng returns value below critChance', () => {
    expect(rollCrit(0.10, () => 0.09)).toBe(true)
  })

  it('returns false when rng returns exactly the critChance (boundary — not strictly less)', () => {
    expect(rollCrit(0.10, () => 0.10)).toBe(false)
  })

  it('returns false when rng returns value above critChance', () => {
    expect(rollCrit(0.10, () => 0.50)).toBe(false)
  })

  it('returns false for critChance=0 regardless of rng', () => {
    expect(rollCrit(0, () => 0)).toBe(false)
  })

  it('always returns true for critChance=1 regardless of rng', () => {
    expect(rollCrit(1, () => 0.9999)).toBe(true)
  })
})

// ===== processCombat crit damage tests =====

describe('processCombat — critical hit damage', () => {
  it('forced crit deals double base damage to the target', () => {
    const tower = makeCritTower({ damage: 25, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 200 })
    // Force crit by injecting rng that always returns 0 (< 0.10 critChance)
    const { enemies } = processCombat([tower], [enemy], 1000, undefined, () => 0)
    // 25 base * 2 (crit) = 50
    expect(enemies[0].hp).toBe(150)
  })

  it('forced miss deals base damage only', () => {
    const tower = makeCritTower({ damage: 25, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 200 })
    // Force miss by injecting rng that always returns 0.99 (>= 0.10 critChance)
    const { enemies } = processCombat([tower], [enemy], 1000, undefined, () => 0.99)
    // 25 base * 1 (no crit) = 25
    expect(enemies[0].hp).toBe(175)
  })

  it('crit kill awards +50% gold bonus on top of base goldReward', () => {
    const tower = makeCritTower({ damage: 200, critChance: 0.10 })  // overkill
    const enemy = makeEnemy({ hp: 100, goldReward: 10 })
    const { goldEarned } = processCombat([tower], [enemy], 1000, undefined, () => 0)
    // 10 * 1.5 = 15
    expect(goldEarned).toBe(15)
  })

  it('non-crit kill awards base goldReward without bonus', () => {
    const tower = makeCritTower({ damage: 200, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 100, goldReward: 10 })
    const { goldEarned } = processCombat([tower], [enemy], 1000, undefined, () => 0.99)
    expect(goldEarned).toBe(10)
  })

  it('crit hit sets isCrit=true on the projectile', () => {
    const tower = makeCritTower({ damage: 5, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 200 })
    const { projectiles } = processCombat([tower], [enemy], 1000, undefined, () => 0)
    expect(projectiles).toHaveLength(1)
    expect(projectiles[0].isCrit).toBe(true)
  })

  it('non-crit hit sets isCrit=false on the projectile', () => {
    const tower = makeCritTower({ damage: 5, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 200 })
    const { projectiles } = processCombat([tower], [enemy], 1000, undefined, () => 0.99)
    expect(projectiles).toHaveLength(1)
    expect(projectiles[0].isCrit).toBe(false)
  })

  it('crit hit emits a damage number entry', () => {
    const tower = makeCritTower({ damage: 25, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 200 })
    const { damageNumbers } = processCombat([tower], [enemy], 1000, undefined, () => 0)
    expect(damageNumbers).toHaveLength(1)
    expect(damageNumbers[0].value).toBe(50)  // 25 * 2
    expect(damageNumbers[0].expiresAt).toBe(1700)  // nowMs + 700
  })

  it('non-crit hit does not emit damage numbers', () => {
    const tower = makeCritTower({ damage: 25, critChance: 0.10 })
    const enemy = makeEnemy({ hp: 200 })
    const { damageNumbers } = processCombat([tower], [enemy], 1000, undefined, () => 0.99)
    expect(damageNumbers).toHaveLength(0)
  })

  it('tower without critChance never crits (default safe for legacy test helpers)', () => {
    // A tower with no critChance property should never produce crits
    const tower = { row: 0, col: 0, range: 5, damage: 25, fireRate: 1, lastFiredAt: 0 }
    const enemy = makeEnemy({ hp: 200 })
    // Even with rng=0 (which would otherwise trigger), no critChance means no crit
    const { projectiles, damageNumbers } = processCombat([tower], [enemy], 1000, undefined, () => 0)
    expect(projectiles[0].isCrit).toBe(false)
    expect(damageNumbers).toHaveLength(0)
  })
})

// ===== createTower — base critChance =====

describe('createTower — base critChance', () => {
  it('BasicTower created via createTower has critChance: 0.10', () => {
    const tower = createTower('BasicTower', 0, 0)
    expect(tower.critChance).toBe(0.10)
  })

  it('RapidTower created via createTower has critChance: 0.10', () => {
    const tower = createTower('RapidTower', 0, 0)
    expect(tower.critChance).toBe(0.10)
  })

  it('CannonTower created via createTower has critChance: 0.10', () => {
    const tower = createTower('CannonTower', 0, 0)
    expect(tower.critChance).toBe(0.10)
  })
})

// ===== SniperTower L2 crit chance =====

describe('SniperTower L2 — 20% crit chance', () => {
  it('SniperTower at L0 has critChance: 0.10 (base)', () => {
    const tower = createTower('SniperTower', 0, 0)
    expect(tower.critChance).toBe(0.10)
  })

  it('SniperTower L1 upgrade does not change critChance from base 0.10', () => {
    const l0 = createTower('SniperTower', 0, 0)
    const l1 = upgradeTower(l0)
    expect(l1.upgradeLevel).toBe(1)
    expect(l1.critChance).toBe(0.10)
  })

  it('SniperTower L2 upgrade sets critChance to 0.20', () => {
    const l0 = createTower('SniperTower', 0, 0)
    const l1 = upgradeTower(l0)
    const l2 = upgradeTower(l1)
    expect(l2.upgradeLevel).toBe(2)
    expect(l2.critChance).toBe(0.20)
  })

  it('SniperTower L2 critChance is defined in TOWER_TYPES upgrades[1]', () => {
    expect(TOWER_TYPES.SniperTower.upgrades[1].critChance).toBe(0.20)
  })

  it('SniperTower L2 forced crit uses 20% chance — rng=0.19 triggers crit', () => {
    const l2 = upgradeTower(upgradeTower(createTower('SniperTower', 0, 0)))
    const enemy = makeEnemy({ hp: 2000, row: 0, col: 1 })
    const { projectiles } = processCombat([l2], [enemy], 1000, undefined, () => 0.19)
    expect(projectiles[0].isCrit).toBe(true)
  })

  it('SniperTower L2 — rng=0.20 does not trigger crit (boundary)', () => {
    const l2 = upgradeTower(upgradeTower(createTower('SniperTower', 0, 0)))
    const enemy = makeEnemy({ hp: 2000, row: 0, col: 1 })
    const { projectiles } = processCombat([l2], [enemy], 1000, undefined, () => 0.20)
    expect(projectiles[0].isCrit).toBe(false)
  })
})
