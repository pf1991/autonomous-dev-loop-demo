import { describe, it, expect } from 'vitest'
import { createWave, getWaveEnemyHp, getWaveEnemyCount, getWaveComposition, getEarlyWaveBonus } from '../../src/game/wave.js'

describe('getWaveEnemyHp', () => {
  it('wave 1 returns 100 HP', () => {
    expect(getWaveEnemyHp(1)).toBe(100)
  })

  it('wave 5 returns 200 HP', () => {
    expect(getWaveEnemyHp(5)).toBe(200)
  })

  it('wave 10 returns 325 HP', () => {
    expect(getWaveEnemyHp(10)).toBe(325)
  })

  it('formula: 100 + (wave - 1) * 25', () => {
    for (const wave of [1, 2, 3, 5, 10]) {
      expect(getWaveEnemyHp(wave)).toBe(100 + (wave - 1) * 25)
    }
  })
})

describe('getWaveEnemyCount', () => {
  it('wave 1 returns 5 enemies', () => {
    expect(getWaveEnemyCount(1)).toBe(5)
  })

  it('wave 3 returns 6 enemies', () => {
    expect(getWaveEnemyCount(3)).toBe(6)
  })

  it('wave 5 returns 7 enemies', () => {
    expect(getWaveEnemyCount(5)).toBe(7)
  })

  it('wave 9 returns 9 enemies', () => {
    expect(getWaveEnemyCount(9)).toBe(9)
  })

  it('formula: 5 + Math.floor((wave - 1) / 2)', () => {
    for (const wave of [1, 3, 5, 9]) {
      expect(getWaveEnemyCount(wave)).toBe(5 + Math.floor((wave - 1) / 2))
    }
  })
})

describe('createWave', () => {
  it('always starts with an empty enemies array', () => {
    expect(createWave(3).enemies).toEqual([])
  })

  it('always has spawnInterval of 500', () => {
    expect(createWave(7).spawnInterval).toBe(500)
  })

  it('totalEnemies matches getWaveEnemyCount', () => {
    for (const wave of [1, 5, 10]) {
      expect(createWave(wave).totalEnemies).toBe(getWaveEnemyCount(wave))
    }
  })

  it('enemyHp matches getWaveEnemyHp', () => {
    for (const wave of [1, 5, 10]) {
      expect(createWave(wave).enemyHp).toBe(getWaveEnemyHp(wave))
    }
  })

  it('wave 1: 5 enemies, 100 HP', () => {
    const w = createWave(1)
    expect(w.totalEnemies).toBe(5)
    expect(w.enemyHp).toBe(100)
  })

  it('wave 5: 7 enemies, 200 HP', () => {
    const w = createWave(5)
    expect(w.totalEnemies).toBe(7)
    expect(w.enemyHp).toBe(200)
  })

  it('wave 10: 9 enemies, 325 HP', () => {
    const w = createWave(10)
    expect(w.totalEnemies).toBe(9)
    expect(w.enemyHp).toBe(325)
  })
})

describe('getEarlyWaveBonus', () => {
  it('returns > 1 for any valid early call', () => {
    expect(getEarlyWaveBonus(1, 1)).toBeGreaterThan(1)
    expect(getEarlyWaveBonus(1, 5)).toBeGreaterThan(1)
  })

  it('calling 1 wave early on wave 1: bonus = 1 + 1/(1+1) = 1.5', () => {
    expect(getEarlyWaveBonus(1, 1)).toBe(1.5)
  })

  it('calling 1 wave early on wave 3: bonus = 1 + 1/(3+1) = 1.25', () => {
    expect(getEarlyWaveBonus(1, 3)).toBe(1.25)
  })

  it('calling 1 wave early on wave 9: bonus = 1 + 1/(9+1) = 1.1', () => {
    expect(getEarlyWaveBonus(1, 9)).toBeCloseTo(1.1, 5)
  })

  it('larger earlierWaveNumber gives higher bonus', () => {
    expect(getEarlyWaveBonus(2, 3)).toBeGreaterThan(getEarlyWaveBonus(1, 3))
  })

  it('formula: 1 + E / (C + E)', () => {
    for (const [e, c] of [[1, 1], [1, 5], [2, 4], [3, 7]]) {
      expect(getEarlyWaveBonus(e, c)).toBeCloseTo(1 + e / (c + e), 10)
    }
  })
})

describe('getWaveComposition', () => {
  it('wave 1: grunts only', () => {
    const comp = getWaveComposition(1)
    expect(comp).toHaveLength(1)
    expect(comp[0].type).toBe('grunt')
    expect(comp[0].count).toBe(getWaveEnemyCount(1))
  })

  it('wave 4: 70% grunts, 30% tanks', () => {
    const comp = getWaveComposition(4)
    const total = getWaveEnemyCount(4)
    const grunt = comp.find(c => c.type === 'grunt')
    const tank  = comp.find(c => c.type === 'tank')
    expect(grunt).toBeDefined()
    expect(tank).toBeDefined()
    expect((grunt?.count ?? 0) + (tank?.count ?? 0)).toBe(total)
    // Tank count ~30% of total
    expect(tank.count).toBe(Math.round(total * 0.3))
  })

  it('wave 7: 40% grunts, 60% tanks', () => {
    const comp = getWaveComposition(7)
    const total = getWaveEnemyCount(7)
    const grunt = comp.find(c => c.type === 'grunt')
    const tank  = comp.find(c => c.type === 'tank')
    expect(grunt).toBeDefined()
    expect(tank).toBeDefined()
    expect((grunt?.count ?? 0) + (tank?.count ?? 0)).toBe(total)
    // Tank count ~60% of total
    expect(tank.count).toBe(Math.round(total * 0.6))
  })

  it('wave 10: 40% grunts, 60% tanks', () => {
    const comp = getWaveComposition(10)
    const total = getWaveEnemyCount(10)
    const grunt = comp.find(c => c.type === 'grunt')
    const tank  = comp.find(c => c.type === 'tank')
    expect((grunt?.count ?? 0) + (tank?.count ?? 0)).toBe(total)
    expect(tank.count).toBe(Math.round(total * 0.6))
  })

  it('counts always sum to getWaveEnemyCount', () => {
    for (const wave of [1, 4, 7, 10]) {
      const comp = getWaveComposition(wave)
      const sum = comp.reduce((acc, c) => acc + c.count, 0)
      expect(sum).toBe(getWaveEnemyCount(wave))
    }
  })
})
