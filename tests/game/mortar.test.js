import { describe, it, expect } from 'vitest'
import { processCombat } from '../../src/game/combat'
import { TOWER_TYPES, createTower, upgradeTower } from '../../src/game/tower'

// ── Helpers ───────────────────────────────────────────────────────────────

// Mortar fireRate = 0.4, so fireInterval = 2500 ms.
// Tests use nowMs = 5000 and lastFiredAt = 0 so the tower always fires.
const NOW = 5000

function makeMortar({ row = 0, col = 0, damage = 40, fireRate = 0.4, range = 5,
  splashDamage = 20, splashRadius = 1.5, upgradeLevel = 0, lastFiredAt = 0 } = {}) {
  return { type: 'MortarTower', row, col, damage, fireRate, range,
    splashDamage, splashRadius, upgradeLevel, lastFiredAt, kills: 0 }
}

function makeEnemy({ id = 1, hp = 200, row = 2, col = 0 } = {}) {
  return { id, hp, maxHp: hp, pos: { row, col }, goldReward: 10 }
}

// ── MortarTower definition ────────────────────────────────────────────────

describe('TOWER_TYPES.MortarTower', () => {
  it('is defined with correct base stats', () => {
    const m = TOWER_TYPES.MortarTower
    expect(m).toBeDefined()
    expect(m.cost).toBe(125)
    expect(m.range).toBe(5)
    expect(m.damage).toBe(40)
    expect(m.fireRate).toBe(0.4)
    expect(m.splashDamage).toBe(20)
    expect(m.splashRadius).toBe(1.5)
  })

  it('has exactly 2 upgrade levels', () => {
    expect(TOWER_TYPES.MortarTower.upgrades).toHaveLength(2)
  })

  it('L1 upgrade has correct stats', () => {
    const l1 = TOWER_TYPES.MortarTower.upgrades[0]
    expect(l1.cost).toBe(80)
    expect(l1.damage).toBe(55)
    expect(l1.splashDamage).toBe(28)
    expect(l1.splashRadius).toBe(2.0)
  })

  it('L2 upgrade has correct stats and extended range', () => {
    const l2 = TOWER_TYPES.MortarTower.upgrades[1]
    expect(l2.cost).toBe(120)
    expect(l2.damage).toBe(80)
    expect(l2.splashDamage).toBe(40)
    expect(l2.splashRadius).toBe(2.5)
    expect(l2.range).toBe(6)
  })
})

// ── createTower / upgradeTower ────────────────────────────────────────────

describe('createTower — MortarTower', () => {
  it('carries splashDamage and splashRadius from TOWER_TYPES', () => {
    const t = createTower('MortarTower', 3, 4)
    expect(t.splashDamage).toBe(20)
    expect(t.splashRadius).toBe(1.5)
    expect(t.type).toBe('MortarTower')
    expect(t.upgradeLevel).toBe(0)
  })
})

describe('upgradeTower — MortarTower', () => {
  it('L1 upgrade propagates splashDamage and splashRadius', () => {
    const t = createTower('MortarTower', 0, 0)
    const l1 = upgradeTower(t)
    expect(l1.upgradeLevel).toBe(1)
    expect(l1.damage).toBe(55)
    expect(l1.splashDamage).toBe(28)
    expect(l1.splashRadius).toBe(2.0)
  })

  it('L2 upgrade propagates splashDamage, splashRadius, and extended range', () => {
    const t = createTower('MortarTower', 0, 0)
    const l2 = upgradeTower(upgradeTower(t))
    expect(l2.upgradeLevel).toBe(2)
    expect(l2.damage).toBe(80)
    expect(l2.splashDamage).toBe(40)
    expect(l2.splashRadius).toBe(2.5)
    expect(l2.range).toBe(6)
  })
})

// ── processCombat — Mortar density-targeting ──────────────────────────────

describe('processCombat — MortarTower density targeting', () => {
  it('fires at the tile with the highest enemy density in range', () => {
    // Tower at (0,0), range 10.
    // Cluster: 3 enemies tightly packed around (4,0).
    // Lone enemy at (1,9) — closest to tower but low density.
    const mortar = makeMortar({ row: 0, col: 0, range: 10, damage: 1,
      splashDamage: 1, splashRadius: 1.5 })
    const lone   = makeEnemy({ id: 1, hp: 200, row: 1, col: 9 })
    const clust1 = makeEnemy({ id: 2, hp: 200, row: 4, col: 0 })
    const clust2 = makeEnemy({ id: 3, hp: 200, row: 4, col: 1 })  // dist 1 from clust1
    const clust3 = makeEnemy({ id: 4, hp: 200, row: 5, col: 0 })  // dist 1 from clust1

    const { enemies } = processCombat([mortar], [lone, clust1, clust2, clust3], NOW)

    // The lone enemy should be untouched (not in blast radius of cluster).
    const loneAfter = enemies.find(e => e.id === 1)
    expect(loneAfter).toBeDefined()
    expect(loneAfter.hp).toBe(200)

    // At least one cluster enemy must have been hit (center + splash)
    const clust1After = enemies.find(e => e.id === 2)
    const clust2After = enemies.find(e => e.id === 3)
    const clust3After = enemies.find(e => e.id === 4)
    const anyClusterHit = [clust1After, clust2After, clust3After].some(e => !e || e.hp < 200)
    expect(anyClusterHit).toBe(true)
  })

  it('targets single in-range enemy when no cluster', () => {
    const mortar = makeMortar({ row: 0, col: 0, range: 5, damage: 40, splashDamage: 20, splashRadius: 1.5 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 })

    const { enemies } = processCombat([mortar], [enemy], NOW)

    const after = enemies.find(e => e.id === 1)
    // Center hit (40) + splash hit (20) = takes 60 total damage
    expect(after).toBeDefined()
    expect(after.hp).toBe(200 - 40 - 20)
  })

  it('does not fire when no enemies are in range', () => {
    const mortar = makeMortar({ row: 0, col: 0, range: 2, damage: 40 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 10, col: 0 })

    const { enemies, towers } = processCombat([mortar], [enemy], NOW)

    expect(enemies[0].hp).toBe(200)
    // lastFiredAt stays at 0 when no target found
    expect(towers[0].lastFiredAt).toBe(0)
  })
})

// ── processCombat — Mortar splash damage ─────────────────────────────────

describe('processCombat — MortarTower splash damage', () => {
  it('center enemy takes both center damage and splash damage', () => {
    // Place a single enemy at the blast point; it should take 40 (center) + 20 (splash)
    const mortar = makeMortar({ row: 0, col: 0, range: 5, damage: 40, splashDamage: 20, splashRadius: 1.5 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 })

    const { enemies } = processCombat([mortar], [enemy], NOW)

    expect(enemies[0].hp).toBe(200 - 40 - 20)  // 140
  })

  it('nearby enemy within splashRadius takes splash damage but not center damage', () => {
    // Two enemies: primary at (2,0), secondary at (2,1) — dist 1 from primary, within 1.5 radius
    const mortar = makeMortar({ row: 0, col: 0, range: 5, damage: 40, splashDamage: 20, splashRadius: 1.5 })
    const primary   = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 })
    const secondary = makeEnemy({ id: 2, hp: 200, row: 2, col: 1 })

    const { enemies } = processCombat([mortar], [primary, secondary], NOW)

    const pAfter = enemies.find(e => e.id === 1)
    const sAfter = enemies.find(e => e.id === 2)
    // Primary: center (40) + splash (20) = 60 damage total
    expect(pAfter.hp).toBe(200 - 40 - 20)
    // Secondary: splash only (20) — not at center
    expect(sAfter.hp).toBe(200 - 20)
  })

  it('enemy outside splashRadius is not damaged', () => {
    const mortar = makeMortar({ row: 0, col: 0, range: 8, damage: 40, splashDamage: 20, splashRadius: 1.5 })
    const primary = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 })
    const far     = makeEnemy({ id: 2, hp: 200, row: 6, col: 0 }) // dist 4 from primary — outside 1.5 radius

    const { enemies } = processCombat([mortar], [primary, far], NOW)

    const farAfter = enemies.find(e => e.id === 2)
    expect(farAfter.hp).toBe(200) // untouched
  })

  it('splash kills earn gold', () => {
    // Secondary has 15 hp; splash damage is 20 → should kill it
    const mortar = makeMortar({ row: 0, col: 0, range: 5, damage: 40, splashDamage: 20, splashRadius: 1.5 })
    const primary   = { id: 1, hp: 200, maxHp: 200, pos: { row: 2, col: 0 }, goldReward: 10 }
    const secondary = { id: 2, hp: 15,  maxHp: 15,  pos: { row: 2, col: 1 }, goldReward: 5 }

    const { goldEarned } = processCombat([mortar], [primary, secondary], NOW)

    // secondary is killed by splash → earns 5 gold (primary survives)
    expect(goldEarned).toBeGreaterThanOrEqual(5)
  })

  it('multiple enemies in blast radius all take splash damage', () => {
    const mortar = makeMortar({ row: 0, col: 0, range: 10, damage: 1, splashDamage: 30, splashRadius: 3 })
    // Pack 4 enemies around (5,0)
    const e1 = makeEnemy({ id: 1, hp: 200, row: 5, col: 0 })
    const e2 = makeEnemy({ id: 2, hp: 200, row: 5, col: 1 })
    const e3 = makeEnemy({ id: 3, hp: 200, row: 6, col: 0 })
    const e4 = makeEnemy({ id: 4, hp: 200, row: 4, col: 0 })

    const { enemies } = processCombat([mortar], [e1, e2, e3, e4], NOW)

    // All 4 should have taken splash damage (at least 30 hp lost each)
    for (const updated of enemies) {
      expect(updated.hp).toBeLessThan(200)
    }
  })
})

// ── processCombat — Mortar projectile shape ────────────────────────────────

describe('processCombat — MortarTower projectile', () => {
  it('emits a projectile with towerType MortarTower and splashRadius', () => {
    const mortar = makeMortar({ row: 0, col: 0, range: 5 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 })

    const { projectiles } = processCombat([mortar], [enemy], NOW)

    expect(projectiles).toHaveLength(1)
    expect(projectiles[0].towerType).toBe('MortarTower')
    expect(typeof projectiles[0].splashRadius).toBe('number')
    expect(projectiles[0].splashRadius).toBeGreaterThan(0)
  })

  it('projectile toRow/toCol points to the blast tile (not tower position)', () => {
    const mortar = makeMortar({ row: 0, col: 0, range: 5 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 3, col: 2 })

    const { projectiles } = processCombat([mortar], [enemy], NOW)

    expect(projectiles[0].fromRow).toBe(0)
    expect(projectiles[0].fromCol).toBe(0)
    expect(projectiles[0].toRow).toBe(3)
    expect(projectiles[0].toCol).toBe(2)
  })

  it('projectile carries upgradeLevel', () => {
    const mortar = { ...makeMortar({ row: 0, col: 0, range: 5 }), upgradeLevel: 1 }
    const enemy = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 })

    const { projectiles } = processCombat([mortar], [enemy], NOW)

    expect(projectiles[0].upgradeLevel).toBe(1)
  })
})

// ── Upgrade stat integration ─────────────────────────────────────────────

describe('MortarTower upgrade stat integration via processCombat', () => {
  it('L1 mortar deals 55 center + 28 splash damage', () => {
    const base = createTower('MortarTower', 0, 0)
    const l1 = upgradeTower(base)
    const enemy = makeEnemy({ id: 1, hp: 500, row: 2, col: 0 })

    const { enemies } = processCombat([l1], [enemy], NOW)

    // Center (55) + splash (28) = 83 total
    expect(enemies[0].hp).toBe(500 - 55 - 28)
  })

  it('L2 mortar deals 80 center + 40 splash damage', () => {
    const base = createTower('MortarTower', 0, 0)
    const l2 = upgradeTower(upgradeTower(base))
    const enemy = makeEnemy({ id: 1, hp: 500, row: 2, col: 0 })

    const { enemies } = processCombat([l2], [enemy], NOW)

    // Center (80) + splash (40) = 120 total
    expect(enemies[0].hp).toBe(500 - 80 - 40)
  })
})
