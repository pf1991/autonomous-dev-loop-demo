import { describe, it, expect } from 'vitest'
import { createEnemy, ENEMY_TYPES, tickHealerAbilities } from '../../src/game/enemy.js'
import { processCombat, processEffectTick } from '../../src/game/combat.js'

const WAYPOINTS = [
  { row: 0, col: 0 },
  { row: 0, col: 10 },
]

// Helper: basic tower
function makeTower({ row = 0, col = 0, range = 10, damage = 50, fireRate = 1, lastFiredAt = 0, type = 'BasicTower' } = {}) {
  return { row, col, range, damage, fireRate, lastFiredAt, type }
}

// Helper: poison tower (applies DoT)
function makePoisonTower({ row = 0, col = 0, range = 10, damage = 5, fireRate = 1, lastFiredAt = 0 } = {}) {
  return {
    row, col, range, damage, fireRate, lastFiredAt,
    type: 'PoisonTower',
    poisonTickDamage: 20,
    poisonTicks: 3,
    poisonTickInterval: 1000,
  }
}

// ===== ENEMY_TYPES definitions =====

describe('ENEMY_TYPES — healer', () => {
  it('has correct base stats', () => {
    expect(ENEMY_TYPES.healer.hp).toBe(120)
    expect(ENEMY_TYPES.healer.speed).toBe(2.0)
    expect(ENEMY_TYPES.healer.goldReward).toBe(20)
  })
})

describe('ENEMY_TYPES — splitter', () => {
  it('has correct base stats', () => {
    expect(ENEMY_TYPES.splitter.hp).toBe(200)
    expect(ENEMY_TYPES.splitter.speed).toBe(1.5)
    expect(ENEMY_TYPES.splitter.goldReward).toBe(15)
  })
})

describe('ENEMY_TYPES — shielded', () => {
  it('has correct base stats', () => {
    expect(ENEMY_TYPES.shielded.hp).toBe(250)
    expect(ENEMY_TYPES.shielded.speed).toBe(1.2)
    expect(ENEMY_TYPES.shielded.goldReward).toBe(30)
    expect(ENEMY_TYPES.shielded.shieldedDamageReduction).toBe(0.6)
  })
})

describe('createEnemy — new types', () => {
  it('healer enemy carries no shieldedDamageReduction', () => {
    const e = createEnemy('h1', WAYPOINTS, 'healer')
    expect(e.shieldedDamageReduction).toBeUndefined()
  })

  it('shielded enemy carries shieldedDamageReduction = 0.6', () => {
    const e = createEnemy('s1', WAYPOINTS, 'shielded')
    expect(e.shieldedDamageReduction).toBe(0.6)
  })

  it('splitter enemy has no shieldedDamageReduction', () => {
    const e = createEnemy('sp1', WAYPOINTS, 'splitter')
    expect(e.shieldedDamageReduction).toBeUndefined()
  })
})

// ===== HEALER ABILITY =====

describe('tickHealerAbilities', () => {
  it('healer restores 25 HP to nearest ally within 2 tiles', () => {
    const healer = { ...createEnemy('h1', WAYPOINTS, 'healer'), pos: { row: 0, col: 0 } }
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 }, hp: 50 }

    const { enemies } = tickHealerAbilities([healer, grunt], 3000)

    const updatedGrunt = enemies.find(e => e.id === 'g1')
    expect(updatedGrunt.hp).toBe(75)  // 50 + 25
  })

  it('healer does not heal beyond maxHp', () => {
    const healer = { ...createEnemy('h1', WAYPOINTS, 'healer'), pos: { row: 0, col: 0 } }
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 }, hp: 75 }
    // grunt maxHp = 80; 75 + 25 = 100 but capped at 80

    const { enemies } = tickHealerAbilities([healer, grunt], 3000)

    const updatedGrunt = enemies.find(e => e.id === 'g1')
    expect(updatedGrunt.hp).toBe(80)
  })

  it('healer does not heal enemies outside 2-tile range', () => {
    const healer = { ...createEnemy('h1', WAYPOINTS, 'healer'), pos: { row: 0, col: 0 } }
    const distant = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 5 }, hp: 40 }

    const { enemies } = tickHealerAbilities([healer, distant], 3000)

    const updatedDistant = enemies.find(e => e.id === 'g1')
    expect(updatedDistant.hp).toBe(40)  // unchanged
  })

  it('healer respects 3s cooldown — does not heal before nextHealAt', () => {
    const healer = {
      ...createEnemy('h1', WAYPOINTS, 'healer'),
      pos: { row: 0, col: 0 },
      nextHealAt: 5000,
    }
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 }, hp: 40 }

    const { enemies } = tickHealerAbilities([healer, grunt], 4000)

    const updatedGrunt = enemies.find(e => e.id === 'g1')
    expect(updatedGrunt.hp).toBe(40)  // no heal yet
  })

  it('healer updates nextHealAt after healing', () => {
    const healer = { ...createEnemy('h1', WAYPOINTS, 'healer'), pos: { row: 0, col: 0 } }
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 }, hp: 50 }

    const { enemies } = tickHealerAbilities([healer, grunt], 3000)

    const updatedHealer = enemies.find(e => e.id === 'h1')
    expect(updatedHealer.nextHealAt).toBe(6000)  // 3000 + 3000
  })

  it('tickHealerAbilities returns heal events for animation', () => {
    const healer = { ...createEnemy('h1', WAYPOINTS, 'healer'), pos: { row: 0, col: 0 } }
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 }, hp: 50 }

    const { healEvents } = tickHealerAbilities([healer, grunt], 3000)

    expect(healEvents).toHaveLength(1)
    expect(healEvents[0].targetId).toBe('g1')
    expect(healEvents[0].healerId).toBe('h1')
  })
})

// ===== SPLITTER DEATH SPAWNING =====

describe('processCombat — splitter death spawning', () => {
  it('killing a splitter returns splitterSpawns with its position and 50% HP', () => {
    const tower = makeTower({ row: 0, col: 0, range: 10, damage: 300 })
    const splitter = {
      ...createEnemy('sp1', WAYPOINTS, 'splitter'),
      pos: { row: 0, col: 3 },
      waypointIndex: 0,
    }

    const { splitterSpawns } = processCombat([tower], [splitter], 1000)

    expect(splitterSpawns).toHaveLength(1)
    expect(splitterSpawns[0].row).toBeCloseTo(0)
    expect(splitterSpawns[0].col).toBeCloseTo(3)
    expect(splitterSpawns[0].hp).toBe(Math.round(splitter.maxHp * 0.5))
  })

  it('non-splitter enemy death does not produce splitterSpawns', () => {
    const tower = makeTower({ row: 0, col: 0, range: 10, damage: 200 })
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 } }

    const { splitterSpawns } = processCombat([tower], [grunt], 1000)

    expect(splitterSpawns).toHaveLength(0)
  })

  it('splitter death still awards gold', () => {
    const tower = makeTower({ row: 0, col: 0, range: 10, damage: 300 })
    const splitter = { ...createEnemy('sp1', WAYPOINTS, 'splitter'), pos: { row: 0, col: 2 } }

    const { goldEarned } = processCombat([tower], [splitter], 1000)

    expect(goldEarned).toBe(ENEMY_TYPES.splitter.goldReward)  // 15
  })
})

// ===== SHIELDED DAMAGE REDUCTION =====

describe('processCombat — shielded damage reduction', () => {
  it('shielded enemy takes only 60% of tower damage', () => {
    const tower = makeTower({ row: 0, col: 0, range: 10, damage: 100 })
    const shielded = { ...createEnemy('sh1', WAYPOINTS, 'shielded'), pos: { row: 0, col: 2 } }

    const { enemies } = processCombat([tower], [shielded], 1000)

    const updated = enemies.find(e => e.id === 'sh1')
    expect(updated).toBeDefined()
    // 250 HP - (100 * 0.6) = 250 - 60 = 190
    expect(updated.hp).toBeCloseTo(190)
  })

  it('shielded enemy survives hits that would kill an unshielded enemy of same HP', () => {
    // A grunt with 250 HP and a shielded with 250 HP both face a 250-damage tower
    const tower = makeTower({ row: 0, col: 0, range: 10, damage: 250 })
    const shielded = {
      ...createEnemy('sh1', WAYPOINTS, 'shielded'),
      pos: { row: 0, col: 2 },
    }
    const grunt = {
      ...createEnemy('g1', WAYPOINTS, 'grunt'),
      pos: { row: 0, col: 5 },
      hp: 250,
      maxHp: 250,
    }
    const tower2 = makeTower({ row: 10, col: 5, range: 10, damage: 250 })

    const { enemies } = processCombat([tower, tower2], [shielded, grunt], 1000)

    const updatedShielded = enemies.find(e => e.id === 'sh1')
    const updatedGrunt = enemies.find(e => e.id === 'g1')
    // Shielded takes 250*0.6=150 → survives with 100 HP
    expect(updatedShielded).toBeDefined()
    expect(updatedShielded.hp).toBeCloseTo(100)
    // Grunt takes full 250 → dead
    expect(updatedGrunt).toBeUndefined()
  })
})

describe('processEffectTick — shielded armor bypass for DoT', () => {
  it('poison DoT bypasses shielded reduction (full tick damage)', () => {
    // Set up a shielded enemy with a poison effect
    const shielded = {
      ...createEnemy('sh1', WAYPOINTS, 'shielded'),
      pos: { row: 0, col: 2 },
      effects: [{
        type: 'poison',
        tickDamage: 20,
        tickInterval: 1000,
        ticksRemaining: 1,
        nextTickAt: 1000,
      }],
    }

    const { enemies } = processEffectTick([shielded], 1000)

    const updated = enemies.find(e => e.id === 'sh1')
    // Poison DoT is NOT reduced by shield: 250 - 20 = 230
    expect(updated).toBeDefined()
    expect(updated.hp).toBeCloseTo(230)
  })
})
