import { describe, it, expect } from 'vitest'
import { createWave, getWaveEnemyHp, getWaveEnemyCount, getWaveComposition, getEarlyWaveBonus, getEndlessWaveEnemyHp, getEndlessWaveEnemyCount, getEndlessWaveComposition } from '../../src/game/wave.js'

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

  it('wave 4: has grunts, speeders, and tanks', () => {
    const comp = getWaveComposition(4)
    const total = getWaveEnemyCount(4)
    const grunt   = comp.find(c => c.type === 'grunt')
    const speeder = comp.find(c => c.type === 'speeder')
    const tank    = comp.find(c => c.type === 'tank')
    expect(grunt).toBeDefined()
    expect(speeder).toBeDefined()
    expect(tank).toBeDefined()
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
  })

  it('wave 7: includes all five enemy types', () => {
    const comp = getWaveComposition(7)
    const total = getWaveEnemyCount(7)
    expect(comp.some(c => c.type === 'grunt')).toBe(true)
    expect(comp.some(c => c.type === 'speeder')).toBe(true)
    expect(comp.some(c => c.type === 'tank')).toBe(true)
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
  })

  it('wave 10: includes harder enemy types (armored and phantom)', () => {
    const comp = getWaveComposition(10)
    const total = getWaveEnemyCount(10)
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
  })

  it('counts always sum to getWaveEnemyCount', () => {
    for (const wave of [1, 4, 7, 10]) {
      const comp = getWaveComposition(wave)
      const sum = comp.reduce((acc, c) => acc + c.count, 0)
      expect(sum).toBe(getWaveEnemyCount(wave))
    }
  })
})

describe('getEndlessWaveEnemyHp', () => {
  it('waves 1-10 match the standard formula', () => {
    for (const wave of [1, 5, 10]) {
      expect(getEndlessWaveEnemyHp(wave)).toBe(getWaveEnemyHp(wave))
    }
  })

  it('wave 11 is greater than wave 10', () => {
    expect(getEndlessWaveEnemyHp(11)).toBeGreaterThan(getEndlessWaveEnemyHp(10))
  })

  it('wave 11: 325 × 1.15 rounded = 374', () => {
    expect(getEndlessWaveEnemyHp(11)).toBe(Math.round(325 * 1.15))
  })

  it('wave 12: 325 × 1.15^2 rounded = 430', () => {
    expect(getEndlessWaveEnemyHp(12)).toBe(Math.round(325 * Math.pow(1.15, 2)))
  })

  it('wave 15: 325 × 1.15^5 rounded = 654', () => {
    expect(getEndlessWaveEnemyHp(15)).toBe(Math.round(325 * Math.pow(1.15, 5)))
  })

  it('wave 20: 325 × 1.15^10 rounded = 1315', () => {
    expect(getEndlessWaveEnemyHp(20)).toBe(Math.round(325 * Math.pow(1.15, 10)))
  })

  it('wave 20 is significantly higher than wave 11', () => {
    expect(getEndlessWaveEnemyHp(20)).toBeGreaterThan(getEndlessWaveEnemyHp(11))
  })

  it('HP grows each wave beyond 10 (waves 11-20)', () => {
    for (let w = 11; w <= 20; w++) {
      expect(getEndlessWaveEnemyHp(w + 1)).toBeGreaterThan(getEndlessWaveEnemyHp(w))
    }
  })

  it('formula: Math.round(325 * 1.15^(wave-10)) for wave 13', () => {
    expect(getEndlessWaveEnemyHp(13)).toBe(Math.round(325 * Math.pow(1.15, 3)))
  })
})

describe('getEndlessWaveEnemyCount', () => {
  it('waves 1-10 match the standard formula', () => {
    for (const wave of [1, 5, 10]) {
      expect(getEndlessWaveEnemyCount(wave)).toBe(getWaveEnemyCount(wave))
    }
  })

  it('wave 11 equals 9 (base)', () => {
    expect(getEndlessWaveEnemyCount(11)).toBe(9)
  })

  it('wave 12 equals 10 (+1 for each 2-wave step from 10)', () => {
    expect(getEndlessWaveEnemyCount(12)).toBe(10)
  })

  it('wave 13 equals 10 (+1 per 2 extra waves)', () => {
    expect(getEndlessWaveEnemyCount(13)).toBe(10)
  })

  it('wave 15 equals 11', () => {
    expect(getEndlessWaveEnemyCount(15)).toBe(11)
  })

  it('wave 17 equals 12', () => {
    expect(getEndlessWaveEnemyCount(17)).toBe(12)
  })

  it('wave 20 equals 14', () => {
    expect(getEndlessWaveEnemyCount(20)).toBe(14)
  })

  it('count is non-decreasing beyond wave 10', () => {
    for (let w = 11; w <= 20; w++) {
      expect(getEndlessWaveEnemyCount(w + 1)).toBeGreaterThanOrEqual(getEndlessWaveEnemyCount(w))
    }
  })
})

describe('getEndlessWaveComposition', () => {
  it('waves 1-10 match the standard composition', () => {
    for (const wave of [1, 5, 10]) {
      expect(getEndlessWaveComposition(wave)).toEqual(getWaveComposition(wave))
    }
  })

  it('wave 11: includes armored and phantom enemies', () => {
    const comp = getEndlessWaveComposition(11)
    const total = getEndlessWaveEnemyCount(11)
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
  })

  it('wave 11: counts sum to total enemy count', () => {
    const comp = getEndlessWaveComposition(11)
    const total = getEndlessWaveEnemyCount(11)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
  })

  it('wave 20: all counts sum to total enemy count', () => {
    const comp = getEndlessWaveComposition(20)
    const total = getEndlessWaveEnemyCount(20)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
  })

  it('wave 20: includes harder enemy types (armored and phantom)', () => {
    const comp = getEndlessWaveComposition(20)
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
  })

  it('grunt count is never zero for endless waves 11+ when total >= 2', () => {
    for (let w = 11; w <= 20; w++) {
      const total = getEndlessWaveEnemyCount(w)
      if (total >= 2) {
        const comp = getEndlessWaveComposition(w)
        const grunt = comp.find(c => c.type === 'grunt')
        expect(grunt).toBeDefined()
        expect(grunt.count).toBeGreaterThan(0)
      }
    }
  })

  it('wave 15: counts sum to getEndlessWaveEnemyCount(15) and includes harder enemies', () => {
    const comp = getEndlessWaveComposition(15)
    const total = getEndlessWaveEnemyCount(15)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(total)
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
  })
})
