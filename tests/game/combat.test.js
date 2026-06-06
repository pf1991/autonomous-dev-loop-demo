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
})
