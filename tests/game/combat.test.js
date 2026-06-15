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

// ── Fire animation: projectile carries towerType and upgradeLevel ─────────────
describe('processCombat — fire animation metadata', () => {
  it('projectile carries the firing tower type', () => {
    const tower = { row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0, type: 'SniperTower', upgradeLevel: 0 }
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { projectiles } = processCombat([tower], [enemy], 1000)

    expect(projectiles).toHaveLength(1)
    expect(projectiles[0].towerType).toBe('SniperTower')
  })

  it('projectile carries upgradeLevel 0 for a base-level tower', () => {
    const tower = { row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0, type: 'BasicTower', upgradeLevel: 0 }
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { projectiles } = processCombat([tower], [enemy], 1000)

    expect(projectiles[0].upgradeLevel).toBe(0)
  })

  it('projectile carries upgradeLevel 1 for a level-1 tower', () => {
    const tower = { row: 0, col: 0, range: 5, damage: 35, fireRate: 1.2, lastFiredAt: 0, type: 'BasicTower', upgradeLevel: 1 }
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { projectiles } = processCombat([tower], [enemy], 1000)

    expect(projectiles[0].upgradeLevel).toBe(1)
  })

  it('projectile carries upgradeLevel 2 for a level-2 tower', () => {
    const tower = { row: 0, col: 0, range: 5, damage: 50, fireRate: 1.5, lastFiredAt: 0, type: 'RapidTower', upgradeLevel: 2 }
    const enemy = makeEnemy({ id: 1, hp: 200, row: 1, col: 0 })

    const { projectiles } = processCombat([tower], [enemy], 1000)

    expect(projectiles[0].upgradeLevel).toBe(2)
  })

  it('each tower type produces a projectile with the correct towerType', () => {
    const types = ['BasicTower', 'SniperTower', 'RapidTower', 'CannonTower', 'SlowTower']
    for (const type of types) {
      const tower = { row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0, type, upgradeLevel: 0 }
      const enemy = makeEnemy({ id: 1, hp: 999, row: 1, col: 0 })
      const { projectiles } = processCombat([tower], [enemy], 1000)
      expect(projectiles[0].towerType).toBe(type)
    }
  })
})

describe('kill attribution (tower.kills)', () => {
  it('killing blow increments kills on the tower that dealt it', () => {
    const tower = { ...makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 }), kills: 0 }
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { towers } = processCombat([tower], [enemy], 1000)

    expect(towers[0].kills).toBe(1)
  })

  it('no kill — tower.kills stays at 0', () => {
    const tower = { ...makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 1, lastFiredAt: 0 }), kills: 0 }
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { towers } = processCombat([tower], [enemy], 1000)

    expect(towers[0].kills).toBe(0)
  })

  it('kill credit goes to the tower that dealt the killing blow, not the other', () => {
    // tower1 is in range of enemy1, tower2 is far away (out of range of enemy1)
    const tower1 = { ...makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 }), kills: 0 }
    const tower2 = { ...makeTower({ row: 14, col: 19, range: 1, damage: 100, fireRate: 1, lastFiredAt: 0 }), kills: 0 }
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { towers } = processCombat([tower1, tower2], [enemy], 1000)

    expect(towers[0].kills).toBe(1)
    expect(towers[1].kills).toBe(0)
  })

  it('kills accumulate across multiple kills', () => {
    const tower = { ...makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 }), kills: 3 }
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { towers } = processCombat([tower], [enemy], 1000)

    expect(towers[0].kills).toBe(4)
  })

  it('towers without kills field default kills to 0 and credit kill correctly', () => {
    const tower = makeTower({ row: 0, col: 0, range: 5, damage: 100, fireRate: 1, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 100, row: 1, col: 0 })

    const { towers } = processCombat([tower], [enemy], 1000)

    expect(towers[0].kills).toBe(1)
  })
})

// Helper: simulate N one-shot kills by a single tower starting with kills=startKills.
// Returns the tower's accumulated kills count after N kills.
function simulateKills(startKills, n) {
  let tower = { ...makeTower({ row: 0, col: 0, range: 5, damage: 999, fireRate: 999, lastFiredAt: 0 }), kills: startKills }
  let nowMs = 1000
  for (let i = 0; i < n; i++) {
    const enemy = makeEnemy({ id: i + 1, hp: 1, row: 1, col: 0 })
    const result = processCombat([tower], [enemy], nowMs)
    tower = result.towers[0]
    nowMs += 1000
  }
  return tower.kills
}

describe('kill badge colour tier boundaries (via processCombat kill accumulation)', () => {
  // Grey tier: 1–9 kills. Boundary values: 0 (no badge), 1 (first kill), 9 (upper grey).
  it('tower with 0 kills stays at 0 (no badge tier)', () => {
    // No kill — tower with high damage but no enemy in range
    const tower = { ...makeTower({ row: 0, col: 0, range: 1, damage: 999, fireRate: 999, lastFiredAt: 0 }), kills: 0 }
    const enemy = makeEnemy({ id: 1, hp: 1, row: 10, col: 0 }) // out of range
    const { towers } = processCombat([tower], [enemy], 1000)
    expect(towers[0].kills).toBe(0)
  })

  it('first kill brings kills from 0 to 1 (enters grey tier)', () => {
    expect(simulateKills(0, 1)).toBe(1)
  })

  it('9th kill stays in grey tier (kills === 9, still < 10)', () => {
    expect(simulateKills(0, 9)).toBe(9)
  })

  // Green tier: 10–24 kills. Boundary values: 10 (entry), 24 (upper green).
  it('10th kill crosses into green tier (kills === 10)', () => {
    expect(simulateKills(0, 10)).toBe(10)
  })

  it('24 kills stays in green tier (kills === 24, still < 25)', () => {
    expect(simulateKills(0, 24)).toBe(24)
  })

  // Blue tier: 25–49 kills. Boundary values: 25 (entry), 49 (upper blue).
  it('25th kill crosses into blue tier (kills === 25)', () => {
    expect(simulateKills(0, 25)).toBe(25)
  })

  it('49 kills stays in blue tier (kills === 49, still < 50)', () => {
    expect(simulateKills(0, 49)).toBe(49)
  })

  // Gold tier: 50+ kills. Boundary values: 50 (entry).
  it('50th kill crosses into gold tier (kills === 50)', () => {
    expect(simulateKills(0, 50)).toBe(50)
  })

  it('kills accumulate correctly from an existing count (e.g. 48 → 50)', () => {
    expect(simulateKills(48, 2)).toBe(50)
  })
})

// Regression test for issue #101: overcharge (fireRate * 1.5) must NOT compound across ticks.
// processCombat returns towers with the same fireRate that was passed in.
// A caller that applies a temporary multiplier (e.g. overcharge) must NOT feed the returned
// towers directly back as state — it must restore the original fireRate and only carry over
// lastFiredAt / kills from the result.
describe('overcharge fireRate regression (#101)', () => {
  it('processCombat preserves the fireRate of the towers it was given', () => {
    const baseTower = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 2, lastFiredAt: 0 })
    const boostedTower = { ...baseTower, fireRate: baseTower.fireRate * 1.5 } // simulate overcharge copy
    const enemy = makeEnemy({ id: 1, hp: 500, row: 0, col: 0 })

    const { towers: result } = processCombat([boostedTower], [enemy], 1000)

    // processCombat must return the same fireRate it was given (3, not the base 2)
    expect(result[0].fireRate).toBe(3)
  })

  it('fireRate does NOT compound when caller correctly restores base stats after each overcharge tick', () => {
    const baseTower = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 2, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 99999, row: 0, col: 0 })

    // Simulate 5 overcharge ticks using the CORRECT approach:
    // apply multiplier to a copy, call processCombat, then only merge lastFiredAt/kills back.
    let currentTower = { ...baseTower }
    for (let tick = 1; tick <= 5; tick++) {
      const boosted = { ...currentTower, fireRate: currentTower.fireRate * 1.5 }
      const { towers: result } = processCombat([boosted], [enemy], tick * 1000)
      // Correct: restore original fireRate, only carry over lastFiredAt and kills
      currentTower = {
        ...currentTower,
        lastFiredAt: result[0].lastFiredAt,
        kills: result[0].kills,
      }
    }

    // After 5 ticks, fireRate must still be the original base value (2), not 2 * 1.5^5
    expect(currentTower.fireRate).toBe(2)
  })

  it('fireRate compounds (bug) when caller naively stores processCombat result during overcharge', () => {
    const baseTower = makeTower({ row: 0, col: 0, range: 5, damage: 10, fireRate: 2, lastFiredAt: 0 })
    const enemy = makeEnemy({ id: 1, hp: 99999, row: 0, col: 0 })

    // Simulate the BUGGY approach: feed combatResult.towers directly back each tick
    let currentTower = { ...baseTower }
    for (let tick = 1; tick <= 5; tick++) {
      const boosted = { ...currentTower, fireRate: currentTower.fireRate * 1.5 }
      const { towers: result } = processCombat([boosted], [enemy], tick * 1000)
      // Bug: overwrite currentTower with the result that already has boosted fireRate
      currentTower = result[0]
    }

    // fireRate has compounded: 2 * 1.5^5 = 15.1875
    expect(currentTower.fireRate).toBeCloseTo(2 * Math.pow(1.5, 5))
    // The rate is no longer 2 — this demonstrates what the bug looked like
    expect(currentTower.fireRate).not.toBe(2)
  })
})
