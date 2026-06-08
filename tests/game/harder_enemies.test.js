/**
 * harder_enemies.test.js
 * Unit tests for the new harder enemy types (speeder, armored, phantom)
 * and their resistance interactions with towers in combat.
 */
import { describe, it, expect } from 'vitest'
import { createEnemy, getEnemyRadius, ENEMY_TYPES } from '../../src/game/enemy.js'
import { processCombat } from '../../src/game/combat.js'
import { getWaveComposition, getWaveEnemyCount, getEndlessWaveComposition } from '../../src/game/wave.js'

const WAYPOINTS = [{ row: 0, col: 0 }, { row: 0, col: 10 }]

// ───────────────────────────────────────────────
// createEnemy — new types
// ───────────────────────────────────────────────

describe('createEnemy — speeder', () => {
  it('creates speeder with correct base stats', () => {
    const e = createEnemy('s1', WAYPOINTS, 'speeder')
    expect(e.type).toBe('speeder')
    expect(e.hp).toBe(ENEMY_TYPES.speeder.hp)
    expect(e.maxHp).toBe(ENEMY_TYPES.speeder.hp)
    expect(e.speed).toBe(ENEMY_TYPES.speeder.speed)
    expect(e.goldReward).toBe(ENEMY_TYPES.speeder.goldReward)
  })

  it('speeder has slowResist property', () => {
    const e = createEnemy('s1', WAYPOINTS, 'speeder')
    expect(e.slowResist).toBeDefined()
    expect(e.slowResist).toBeGreaterThan(0)
    expect(e.slowResist).toBeLessThanOrEqual(1)
  })

  it('speeder has higher speed than grunt', () => {
    const speeder = createEnemy('s1', WAYPOINTS, 'speeder')
    const grunt   = createEnemy('g1', WAYPOINTS, 'grunt')
    expect(speeder.speed).toBeGreaterThan(grunt.speed)
  })

  it('speeder has lower HP than grunt', () => {
    const speeder = createEnemy('s1', WAYPOINTS, 'speeder')
    const grunt   = createEnemy('g1', WAYPOINTS, 'grunt')
    expect(speeder.hp).toBeLessThan(grunt.hp)
  })
})

describe('createEnemy — armored', () => {
  it('creates armored with correct base stats', () => {
    const e = createEnemy('a1', WAYPOINTS, 'armored')
    expect(e.type).toBe('armored')
    expect(e.hp).toBe(ENEMY_TYPES.armored.hp)
    expect(e.maxHp).toBe(ENEMY_TYPES.armored.hp)
    expect(e.speed).toBe(ENEMY_TYPES.armored.speed)
    expect(e.goldReward).toBe(ENEMY_TYPES.armored.goldReward)
  })

  it('armored has damageResist object', () => {
    const e = createEnemy('a1', WAYPOINTS, 'armored')
    expect(e.damageResist).toBeDefined()
    expect(typeof e.damageResist).toBe('object')
  })

  it('armored is resistant to RapidTower (damageResist < 0.5)', () => {
    const e = createEnemy('a1', WAYPOINTS, 'armored')
    expect(e.damageResist.RapidTower).toBeLessThan(0.5)
  })

  it('armored has more HP than tank', () => {
    const armored = createEnemy('a1', WAYPOINTS, 'armored')
    const tank    = createEnemy('t1', WAYPOINTS, 'tank')
    expect(armored.hp).toBeGreaterThan(tank.hp)
  })

  it('armored does not have slowResist', () => {
    const e = createEnemy('a1', WAYPOINTS, 'armored')
    expect(e.slowResist).toBeUndefined()
  })
})

describe('createEnemy — phantom', () => {
  it('creates phantom with correct base stats', () => {
    const e = createEnemy('p1', WAYPOINTS, 'phantom')
    expect(e.type).toBe('phantom')
    expect(e.hp).toBe(ENEMY_TYPES.phantom.hp)
    expect(e.maxHp).toBe(ENEMY_TYPES.phantom.hp)
    expect(e.speed).toBe(ENEMY_TYPES.phantom.speed)
    expect(e.goldReward).toBe(ENEMY_TYPES.phantom.goldReward)
  })

  it('phantom has damageResist for BasicTower', () => {
    const e = createEnemy('p1', WAYPOINTS, 'phantom')
    expect(e.damageResist).toBeDefined()
    expect(e.damageResist.BasicTower).toBeLessThan(0.2)
  })

  it('phantom has damageResist for RapidTower', () => {
    const e = createEnemy('p1', WAYPOINTS, 'phantom')
    expect(e.damageResist.RapidTower).toBeLessThan(0.2)
  })

  it('phantom does not resist SniperTower (no key in damageResist)', () => {
    const e = createEnemy('p1', WAYPOINTS, 'phantom')
    expect(e.damageResist.SniperTower).toBeUndefined()
  })
})

// ───────────────────────────────────────────────
// getEnemyRadius — new types
// ───────────────────────────────────────────────

describe('getEnemyRadius — new types', () => {
  it('speeder has radius 8 (smallest)', () => {
    expect(getEnemyRadius(50, 50, 'speeder')).toBe(8)
  })

  it('phantom has radius 12 (between grunt and tank)', () => {
    expect(getEnemyRadius(220, 220, 'phantom')).toBe(12)
  })

  it('armored has radius 18 (largest)', () => {
    expect(getEnemyRadius(600, 600, 'armored')).toBe(18)
  })
})

// ───────────────────────────────────────────────
// processCombat — damageResist
// ───────────────────────────────────────────────

function makeRapidTower({ row = 0, col = 0, damage = 12 } = {}) {
  return { type: 'RapidTower', row, col, range: 10, damage, fireRate: 4, lastFiredAt: 0 }
}

function makeSniperTower({ row = 0, col = 0, damage = 75 } = {}) {
  return { type: 'SniperTower', row, col, range: 10, damage, fireRate: 0.5, lastFiredAt: 0 }
}

function makeBasicTower({ row = 0, col = 0, damage = 25 } = {}) {
  return { type: 'BasicTower', row, col, range: 10, damage, fireRate: 1, lastFiredAt: 0 }
}

function makeSlowTower({ row = 0, col = 0, damage = 8 } = {}) {
  return {
    type: 'SlowTower', row, col, range: 10, damage, fireRate: 1.5,
    lastFiredAt: 0, slowFactor: 0.4, slowDuration: 2000,
  }
}

describe('processCombat — armored damageResist', () => {
  it('RapidTower deals heavily reduced damage to armored enemy', () => {
    const rapidDmg = 100
    const rapidTower = makeRapidTower({ damage: rapidDmg })
    const armored = { ...createEnemy('a1', WAYPOINTS, 'armored'), pos: { row: 0, col: 1 }, maxHp: 600 }
    const armoredResist = armored.damageResist.RapidTower

    const { enemies } = processCombat([rapidTower], [armored], 1000)
    const survivor = enemies.find(e => e.id === 'a1')
    expect(survivor).toBeDefined()
    const damageDealt = armored.hp - survivor.hp
    expect(damageDealt).toBeCloseTo(rapidDmg * armoredResist, 1)
  })

  it('SniperTower deals full damage to armored enemy (no resistance)', () => {
    const sniperDmg = 75
    const sniperTower = makeSniperTower({ damage: sniperDmg })
    const armored = { ...createEnemy('a1', WAYPOINTS, 'armored'), pos: { row: 0, col: 1 }, maxHp: 600 }

    const { enemies } = processCombat([sniperTower], [armored], 2000)
    const survivor = enemies.find(e => e.id === 'a1')
    expect(survivor).toBeDefined()
    const damageDealt = armored.hp - survivor.hp
    expect(damageDealt).toBeCloseTo(sniperDmg, 1)
  })
})

describe('processCombat — phantom damageResist', () => {
  it('BasicTower deals near-zero damage to phantom', () => {
    const basicDmg = 100
    const basicTower = makeBasicTower({ damage: basicDmg })
    const phantom = { ...createEnemy('p1', WAYPOINTS, 'phantom'), pos: { row: 0, col: 1 }, maxHp: 220 }
    const phantomResist = phantom.damageResist.BasicTower

    const { enemies } = processCombat([basicTower], [phantom], 1000)
    const survivor = enemies.find(e => e.id === 'p1')
    expect(survivor).toBeDefined()
    const damageDealt = phantom.hp - survivor.hp
    expect(damageDealt).toBeCloseTo(basicDmg * phantomResist, 1)
  })

  it('SniperTower deals full damage to phantom', () => {
    const sniperDmg = 75
    const sniperTower = makeSniperTower({ damage: sniperDmg })
    const phantom = { ...createEnemy('p1', WAYPOINTS, 'phantom'), pos: { row: 0, col: 1 }, maxHp: 220 }

    const { enemies } = processCombat([sniperTower], [phantom], 2000)
    const survivor = enemies.find(e => e.id === 'p1')
    expect(survivor).toBeDefined()
    const damageDealt = phantom.hp - survivor.hp
    expect(damageDealt).toBeCloseTo(sniperDmg, 1)
  })
})

// ───────────────────────────────────────────────
// processCombat — speeder slowResist
// ───────────────────────────────────────────────

describe('processCombat — speeder slowResist', () => {
  it('speeder receives a weaker slow than a grunt from SlowTower', () => {
    const slowTower = makeSlowTower({})
    const speeder = { ...createEnemy('s1', WAYPOINTS, 'speeder'), pos: { row: 0, col: 1 } }
    const grunt   = { ...createEnemy('g1', WAYPOINTS, 'grunt'),   pos: { row: 0, col: 1 } }

    // Fire at speeder
    const resultSpeeder = processCombat([{ ...slowTower }], [speeder], 1000)
    const slowedSpeeder = resultSpeeder.enemies.find(e => e.id === 's1')

    // Fire at grunt (different timestamp so tower fires again)
    const resultGrunt = processCombat([{ ...slowTower }], [grunt], 2000)
    const slowedGrunt = resultGrunt.enemies.find(e => e.id === 'g1')

    // Both should be slowed
    expect(slowedSpeeder?.speedMult).toBeDefined()
    expect(slowedGrunt?.speedMult).toBeDefined()

    // Speeder's effective speedMult should be higher (less slowed) than grunt's
    expect(slowedSpeeder.speedMult).toBeGreaterThan(slowedGrunt.speedMult)
  })

  it('grunt receives full slow factor from SlowTower', () => {
    const slowTower = makeSlowTower({})
    const grunt = { ...createEnemy('g1', WAYPOINTS, 'grunt'), pos: { row: 0, col: 1 } }

    const { enemies } = processCombat([slowTower], [grunt], 1000)
    const slowed = enemies.find(e => e.id === 'g1')
    expect(slowed?.speedMult).toBeCloseTo(0.4, 3)
  })
})

// ───────────────────────────────────────────────
// getWaveComposition — new types appear at correct waves
// ───────────────────────────────────────────────

describe('getWaveComposition — new enemy types introduced at correct waves', () => {
  it('wave 1 has only grunts', () => {
    const comp = getWaveComposition(1)
    expect(comp.every(e => e.type === 'grunt')).toBe(true)
  })

  it('wave 2 has only grunts', () => {
    const comp = getWaveComposition(2)
    expect(comp.every(e => e.type === 'grunt')).toBe(true)
  })

  it('wave 3 introduces speeders', () => {
    const comp = getWaveComposition(3)
    expect(comp.some(e => e.type === 'speeder')).toBe(true)
  })

  it('wave 6 introduces armored enemies', () => {
    const comp = getWaveComposition(6)
    expect(comp.some(e => e.type === 'armored')).toBe(true)
  })

  it('wave 7 introduces phantom enemies', () => {
    const comp = getWaveComposition(7)
    expect(comp.some(e => e.type === 'phantom')).toBe(true)
  })

  it('wave 10 has armored and phantom enemies', () => {
    const comp = getWaveComposition(10)
    expect(comp.some(e => e.type === 'armored')).toBe(true)
    expect(comp.some(e => e.type === 'phantom')).toBe(true)
  })

  it('total count matches getWaveEnemyCount for all waves 1–10', () => {
    for (const w of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const comp = getWaveComposition(w)
      const total = comp.reduce((s, e) => s + e.count, 0)
      expect(total).toBe(getWaveEnemyCount(w))
    }
  })
})

// ───────────────────────────────────────────────
// getEndlessWaveComposition — harder enemies in endless mode
// ───────────────────────────────────────────────

describe('getEndlessWaveComposition — harder enemy types in endless waves', () => {
  it('endless wave 11 includes armored and phantom', () => {
    const comp = getEndlessWaveComposition(11)
    expect(comp.some(e => e.type === 'armored')).toBe(true)
    expect(comp.some(e => e.type === 'phantom')).toBe(true)
  })

  it('endless wave 16 still includes armored and phantom', () => {
    const comp = getEndlessWaveComposition(16)
    expect(comp.some(e => e.type === 'armored')).toBe(true)
    expect(comp.some(e => e.type === 'phantom')).toBe(true)
  })
})
