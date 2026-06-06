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
})
