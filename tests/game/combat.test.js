import { describe, it, expect } from 'vitest'
import { processCombat } from '../../src/game/combat'

// Helper: build a basic tower at (row, col)
function makeTower({ row = 0, col = 0, range = 5, damage = 25, fireRate = 1, lastFiredAt = 0 } = {}) {
  return { row, col, range, damage, fireRate, lastFiredAt }
}

// Helper: build a basic enemy at (row, col)
function makeEnemy({ id = 1, hp = 100, row = 0, col = 0 } = {}) {
  return { id, hp, pos: { row, col } }
}

describe('processCombat', () => {
  it('tower targets the nearest of two enemies', () => {
    const tower = makeTower({ row: 0, col: 0, range: 10, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const close = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })  // dist 1
    const far   = makeEnemy({ id: 2, hp: 100, row: 5, col: 0 })  // dist 5

    const { enemies } = processCombat([tower], [close, far], 1000)

    const closeSurvived = enemies.find(e => e.id === 1)
    const farSurvived   = enemies.find(e => e.id === 2)

    // Nearest enemy takes damage; far enemy is untouched
    expect(closeSurvived.hp).toBe(90)
    expect(farSurvived.hp).toBe(100)
  })

  it('enemy with HP reduced to 0 is removed from returned array', () => {
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { enemies } = processCombat([tower], [enemy], 1000)

    expect(enemies.find(e => e.id === 1)).toBeUndefined()
  })

  it('awards 10 gold per kill', () => {
    const tower1 = makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 })
    const tower2 = makeTower({ row: 10, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 })
    const enemy1 = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })   // killed by tower1
    const enemy2 = makeEnemy({ id: 2, hp: 100, row: 9, col: 0 })   // killed by tower2

    const { goldEarned } = processCombat([tower1, tower2], [enemy1, enemy2], 1000)

    expect(goldEarned).toBe(20)
  })

  it('tower out of range fires no shots', () => {
    const tower = makeTower({ row: 0, col: 0, range: 2, damage: 50, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 10, col: 0 })  // dist 10, out of range

    const { enemies, goldEarned } = processCombat([tower], [enemy], 1000)

    expect(enemies[0].hp).toBe(100)
    expect(goldEarned).toBe(0)
  })

  it('tower does not fire when nowMs is below fire-rate threshold', () => {
    // lastFiredAt=500, fireRate=1 → interval=1000ms; nowMs=1499 means only 999ms elapsed
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 50, fireRate: 1, lastFiredAt: 500 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { enemies, towers } = processCombat([tower], [enemy], 1499)

    expect(enemies[0].hp).toBe(100)
    // lastFiredAt must remain unchanged since the tower did not fire
    expect(towers[0].lastFiredAt).toBe(500)
  })

  it('no enemies returns goldEarned: 0', () => {
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 25, fireRate: 1, lastFiredAt: 0 })

    const { goldEarned, enemies } = processCombat([tower], [], 1000)

    expect(goldEarned).toBe(0)
    expect(enemies).toHaveLength(0)
  })

  it('two enemies equidistant — first in array is targeted', () => {
    // Both enemies are exactly 3 tiles away from the tower
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const first  = makeEnemy({ id: 1, hp: 100, row: 3, col: 0 })  // dist 3
    const second = makeEnemy({ id: 2, hp: 100, row: 0, col: 3 })  // dist 3 (same)

    const { enemies } = processCombat([tower], [first, second], 1000)

    const firstSurvived  = enemies.find(e => e.id === 1)
    const secondSurvived = enemies.find(e => e.id === 2)

    // First in array takes the damage; second is untouched
    expect(firstSurvived.hp).toBe(90)
    expect(secondSurvived.hp).toBe(100)
  })

  it('tower adjacent to enemy reduces enemy HP each game-clock second', () => {
    // Simulates the game-loop calling processCombat once per second with advancing nowMs.
    // fireRate=1 means the tower fires once per second (interval = 1000 ms).
    const tower = makeTower({ row: 2, col: 2, range: 3, damage: 25, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 2, col: 3 })  // adjacent (dist 1)

    // Tick at t=1000 ms — tower fires, enemy takes 25 damage
    const tick1 = processCombat([tower], [enemy], 1000)
    expect(tick1.enemies[0].hp).toBe(75)

    // Tick at t=2000 ms — tower fires again; nowMs=2000, lastFiredAt=1000 → 1000ms elapsed ≥ interval
    const tick2 = processCombat(tick1.towers, tick1.enemies, 2000)
    expect(tick2.enemies[0].hp).toBe(50)
  })

  it('gold increases when an enemy is killed by a tower', () => {
    // Tower with enough damage to one-shot the enemy
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 0, col: 1 })

    const { goldEarned, enemies } = processCombat([tower], [enemy], 1000)

    // Enemy is dead and removed
    expect(enemies).toHaveLength(0)
    // Gold is awarded for the kill
    expect(goldEarned).toBe(10)
  })

  it('firing tower produces a projectile with correct from/to positions', () => {
    const tower = makeTower({ row: 2, col: 2, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 2, col: 4 })

    const { projectiles } = processCombat([tower], [enemy], 1000)

    expect(projectiles).toHaveLength(1)
    expect(projectiles[0].fromRow).toBe(2)
    expect(projectiles[0].fromCol).toBe(2)
    expect(projectiles[0].toRow).toBeCloseTo(2)
    expect(projectiles[0].toCol).toBeCloseTo(4)
  })

  it('no projectiles when tower is on cooldown', () => {
    // lastFiredAt=500, fireRate=1 → interval=1000ms; nowMs=1499 → not ready
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 500 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 0, col: 1 })

    const { projectiles } = processCombat([tower], [enemy], 1499)

    expect(projectiles).toHaveLength(0)
  })

  it('no projectiles when no enemies in range', () => {
    const tower = makeTower({ row: 0, col: 0, range: 2, damage: 50, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 10, col: 0 })

    const { projectiles } = processCombat([tower], [enemy], 1000)

    expect(projectiles).toHaveLength(0)
  })

  it('killedEnemies contains correct entry when an enemy dies', () => {
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 })
    const enemy = { ...makeEnemy({ id: 42, hp: 100, row: 3, col: 2 }), goldReward: 15 }

    const { killedEnemies } = processCombat([tower], [enemy], 1000)

    expect(killedEnemies).toHaveLength(1)
    expect(killedEnemies[0]).toMatchObject({ id: 42, row: 3, col: 2, gold: 15 })
  })

  it('killedEnemies is empty when no enemies die', () => {
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 }) // survives (10 damage < 100 hp)

    const { killedEnemies } = processCombat([tower], [enemy], 1000)

    expect(killedEnemies).toHaveLength(0)
  })

  it('two towers each produce one projectile when both fire', () => {
    const tower1 = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const tower2 = makeTower({ row: 10, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const enemy1 = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })
    const enemy2 = makeEnemy({ id: 2, hp: 100, row: 9, col: 0 })

    const { projectiles } = processCombat([tower1, tower2], [enemy1, enemy2], 1000)

    expect(projectiles).toHaveLength(2)
  })
})

// ── CannonTower splash mechanics ──────────────────────────────────────────────
describe('processCombat — CannonTower splash', () => {
  function makeCannonTower({ row = 0, col = 0, splashRadius = 1.5 } = {}) {
    return { row, col, range: 5, damage: 120, fireRate: 1, lastFiredAt: 0, splashRadius }
  }

  it('splash tower damages the primary target', () => {
    const cannon = makeCannonTower({ row: 0, col: 0 })
    const primary = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 }) // dist 1 — nearest

    const { enemies } = processCombat([cannon], [primary], 1000)

    expect(enemies.find(e => e.id === 1).hp).toBe(80)
  })

  it('splash tower also damages enemies within splashRadius of the primary target', () => {
    const cannon = makeCannonTower({ row: 0, col: 0, splashRadius: 2 })
    const primary  = makeEnemy({ id: 1, hp: 200, row: 3, col: 0 }) // dist 3 — nearest
    const splash   = makeEnemy({ id: 2, hp: 200, row: 4, col: 0 }) // dist 1 from primary — in splash

    const { enemies } = processCombat([cannon], [primary, splash], 1000)

    expect(enemies.find(e => e.id === 1).hp).toBe(80)  // primary hit
    expect(enemies.find(e => e.id === 2).hp).toBe(80)  // splash hit
  })

  it('splash tower does NOT damage enemies outside splashRadius', () => {
    const cannon = makeCannonTower({ row: 0, col: 0, splashRadius: 1 })
    const primary  = makeEnemy({ id: 1, hp: 200, row: 2, col: 0 }) // nearest
    const outsider = makeEnemy({ id: 2, hp: 200, row: 5, col: 0 }) // dist 3 from primary — outside splash

    const { enemies } = processCombat([cannon], [primary, outsider], 1000)

    expect(enemies.find(e => e.id === 1).hp).toBe(80)   // primary hit
    expect(enemies.find(e => e.id === 2).hp).toBe(200)  // not hit by splash
  })

  it('splash kill earns gold for each killed enemy', () => {
    const cannon = makeCannonTower({ row: 0, col: 0, splashRadius: 3 })
    // Both enemies well within splash — both should die to 120 damage
    const e1 = { ...makeEnemy({ id: 1, hp: 100, row: 2, col: 0 }), goldReward: 10 }
    const e2 = { ...makeEnemy({ id: 2, hp: 100, row: 3, col: 0 }), goldReward: 10 }

    const { goldEarned } = processCombat([cannon], [e1, e2], 1000)

    expect(goldEarned).toBe(20)
  })

  it('tower with no splashRadius does not affect non-targeted enemy', () => {
    const basic = makeTower({ row: 0, col: 0, range: 5, damage: 50, fireRate: 1, lastFiredAt: 0 })
    const primary  = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })
    const nearby   = makeEnemy({ id: 2, hp: 100, row: 1, col: 1 }) // close to primary

    const { enemies } = processCombat([basic], [primary, nearby], 1000)

    // Only primary is hit — no splash
    expect(enemies.find(e => e.id === 2).hp).toBe(100)
  })
})

// ── SlowTower mechanics ───────────────────────────────────────────────────────
describe('processCombat — SlowTower slow debuff', () => {
  function makeSlowTower({ row = 0, col = 0, slowFactor = 0.4, slowDuration = 2000 } = {}) {
    return { row, col, range: 5, damage: 8, fireRate: 1, lastFiredAt: 0, slowFactor, slowDuration }
  }

  it('SlowTower sets speedMult on the hit enemy', () => {
    const slow = makeSlowTower({ slowFactor: 0.4, slowDuration: 2000 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { enemies } = processCombat([slow], [enemy], 1000)

    const updated = enemies.find(e => e.id === 1)
    expect(updated.speedMult).toBe(0.4)
  })

  it('SlowTower sets slowUntil to nowMs + slowDuration', () => {
    const slow = makeSlowTower({ slowFactor: 0.4, slowDuration: 2000 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { enemies } = processCombat([slow], [enemy], 1000)

    const updated = enemies.find(e => e.id === 1)
    expect(updated.slowUntil).toBe(3000) // 1000 + 2000
  })

  it('a stronger slow (lower speedMult) overwrites a weaker existing slow', () => {
    const slow = makeSlowTower({ slowFactor: 0.2, slowDuration: 2000 })
    // Enemy already has a weaker slow
    const enemy = { ...makeEnemy({ id: 1, hp: 200, row: 1, col: 0 }), speedMult: 0.6, slowUntil: 999 }

    const { enemies } = processCombat([slow], [enemy], 1000)

    const updated = enemies.find(e => e.id === 1)
    expect(updated.speedMult).toBe(0.2) // stronger slow applied
  })

  it('a weaker slow does NOT overwrite a stronger existing slow that is still active', () => {
    // Existing strong slow (speedMult 0.2, active until 5000)
    const slow = makeSlowTower({ slowFactor: 0.5, slowDuration: 500 })
    const enemy = { ...makeEnemy({ id: 1, hp: 200, row: 1, col: 0 }), speedMult: 0.2, slowUntil: 5000 }

    const { enemies } = processCombat([slow], [enemy], 1000)

    const updated = enemies.find(e => e.id === 1)
    // The existing slower speedMult should remain — but the new slowUntil (1500) is shorter than 5000
    // so neither condition triggers an overwrite
    expect(updated.speedMult).toBe(0.2)
  })

  it('tower without slowFactor does NOT set speedMult on enemies', () => {
    const basic = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { enemies } = processCombat([basic], [enemy], 1000)

    const updated = enemies.find(e => e.id === 1)
    expect(updated.speedMult).toBeUndefined()
    expect(updated.slowUntil).toBeUndefined()
  })
})
