import { describe, it, expect } from 'vitest'
import { createWave, getWaveEnemyHp, getWaveEnemyCount, getWaveComposition, getEarlyWaveBonus, getEndlessWaveEnemyHp, getEndlessWaveEnemyCount, getEndlessWaveComposition, isBossWave, getWaveEventType, WAVE_EVENT_CONFIG } from '../../src/game/wave.js'

describe('getWaveEnemyHp', () => {
  it('wave 1 returns 100 HP', () => {
    expect(getWaveEnemyHp(1)).toBe(100)
  })

  it('wave 5 returns 384 HP', () => {
    expect(getWaveEnemyHp(5)).toBe(384)
  })

  it('wave 10 returns 2066 HP', () => {
    expect(getWaveEnemyHp(10)).toBe(2066)
  })

  it('each wave is harder than the previous (HP grows each wave)', () => {
    for (let wave = 1; wave < 10; wave++) {
      expect(getWaveEnemyHp(wave + 1)).toBeGreaterThan(getWaveEnemyHp(wave))
    }
  })

  it('formula: Math.round(100 * 1.4^(wave - 1))', () => {
    for (const wave of [1, 2, 3, 5, 10]) {
      expect(getWaveEnemyHp(wave)).toBe(Math.round(100 * Math.pow(1.4, wave - 1)))
    }
  })

  it('wave 5 HP is significantly higher than wave 1 (not trivially close)', () => {
    expect(getWaveEnemyHp(5)).toBeGreaterThan(getWaveEnemyHp(1) * 2)
  })
})

describe('getWaveEnemyCount', () => {
  it('wave 1 returns 5 enemies', () => {
    expect(getWaveEnemyCount(1)).toBe(5)
  })

  it('wave 3 returns 7 enemies', () => {
    expect(getWaveEnemyCount(3)).toBe(7)
  })

  it('wave 5 returns 9 enemies', () => {
    expect(getWaveEnemyCount(5)).toBe(9)
  })

  it('wave 9 returns 13 enemies', () => {
    expect(getWaveEnemyCount(9)).toBe(13)
  })

  it('wave 10 returns 14 enemies', () => {
    expect(getWaveEnemyCount(10)).toBe(14)
  })

  it('formula: 5 + (wave - 1)', () => {
    for (const wave of [1, 3, 5, 9, 10]) {
      expect(getWaveEnemyCount(wave)).toBe(5 + (wave - 1))
    }
  })

  it('count grows by 1 each wave', () => {
    for (let wave = 1; wave < 10; wave++) {
      expect(getWaveEnemyCount(wave + 1)).toBe(getWaveEnemyCount(wave) + 1)
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

  it('wave 5: 9 enemies, 384 HP', () => {
    const w = createWave(5)
    expect(w.totalEnemies).toBe(9)
    expect(w.enemyHp).toBe(384)
  })

  it('wave 10: 14 enemies, 2066 HP', () => {
    const w = createWave(10)
    expect(w.totalEnemies).toBe(14)
    expect(w.enemyHp).toBe(2066)
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
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
    // wave 10 is a boss wave: sum = regular count + 1 colossus
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(getWaveEnemyCount(10) + 1)
  })

  it('counts always sum to getWaveEnemyCount (+ 1 for boss waves)', () => {
    for (const wave of [1, 4, 7, 10]) {
      const comp = getWaveComposition(wave)
      const sum = comp.reduce((acc, c) => acc + c.count, 0)
      const expectedTotal = getWaveEnemyCount(wave) + (isBossWave(wave) ? 1 : 0)
      expect(sum).toBe(expectedTotal)
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

  it('wave 11: 2066 × 1.15 rounded = 2376', () => {
    expect(getEndlessWaveEnemyHp(11)).toBe(Math.round(2066 * 1.15))
  })

  it('wave 12: 2066 × 1.15^2 rounded', () => {
    expect(getEndlessWaveEnemyHp(12)).toBe(Math.round(2066 * Math.pow(1.15, 2)))
  })

  it('wave 15: 2066 × 1.15^5 rounded', () => {
    expect(getEndlessWaveEnemyHp(15)).toBe(Math.round(2066 * Math.pow(1.15, 5)))
  })

  it('wave 20: 2066 × 1.15^10 rounded', () => {
    expect(getEndlessWaveEnemyHp(20)).toBe(Math.round(2066 * Math.pow(1.15, 10)))
  })

  it('wave 20 is significantly higher than wave 11', () => {
    expect(getEndlessWaveEnemyHp(20)).toBeGreaterThan(getEndlessWaveEnemyHp(11))
  })

  it('HP grows each wave beyond 10 (waves 11-20)', () => {
    for (let w = 11; w <= 20; w++) {
      expect(getEndlessWaveEnemyHp(w + 1)).toBeGreaterThan(getEndlessWaveEnemyHp(w))
    }
  })

  it('formula: Math.round(2066 * 1.15^(wave-10)) for wave 13', () => {
    expect(getEndlessWaveEnemyHp(13)).toBe(Math.round(2066 * Math.pow(1.15, 3)))
  })
})

describe('getEndlessWaveEnemyCount', () => {
  it('waves 1-10 match the standard formula', () => {
    for (const wave of [1, 5, 10]) {
      expect(getEndlessWaveEnemyCount(wave)).toBe(getWaveEnemyCount(wave))
    }
  })

  it('wave 11 equals 14 (base, inherits wave-10 count)', () => {
    expect(getEndlessWaveEnemyCount(11)).toBe(14)
  })

  it('wave 12 equals 15 (+1 for each 2-wave step from 10)', () => {
    expect(getEndlessWaveEnemyCount(12)).toBe(15)
  })

  it('wave 13 equals 15 (+1 per 2 extra waves)', () => {
    expect(getEndlessWaveEnemyCount(13)).toBe(15)
  })

  it('wave 15 equals 16', () => {
    expect(getEndlessWaveEnemyCount(15)).toBe(16)
  })

  it('wave 17 equals 17', () => {
    expect(getEndlessWaveEnemyCount(17)).toBe(17)
  })

  it('wave 20 equals 19', () => {
    expect(getEndlessWaveEnemyCount(20)).toBe(19)
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

  it('wave 20: all counts sum to total enemy count (+ 1 for boss wave)', () => {
    const comp = getEndlessWaveComposition(20)
    const total = getEndlessWaveEnemyCount(20)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    // wave 20 is a boss wave: +1 colossus
    expect(sum).toBe(total + 1)
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

  it('wave 15: counts sum to getEndlessWaveEnemyCount(15) + 1 boss and includes harder enemies', () => {
    const comp = getEndlessWaveComposition(15)
    const total = getEndlessWaveEnemyCount(15)
    const sum = comp.reduce((acc, c) => acc + c.count, 0)
    // wave 15 is a boss wave: +1 colossus
    expect(sum).toBe(total + 1)
    expect(comp.some(c => c.type === 'armored')).toBe(true)
    expect(comp.some(c => c.type === 'phantom')).toBe(true)
  })
})

describe('isBossWave', () => {
  it('returns true for multiples of 5', () => {
    expect(isBossWave(5)).toBe(true)
    expect(isBossWave(10)).toBe(true)
    expect(isBossWave(15)).toBe(true)
    expect(isBossWave(20)).toBe(true)
  })

  it('returns false for non-multiples of 5', () => {
    expect(isBossWave(1)).toBe(false)
    expect(isBossWave(3)).toBe(false)
    expect(isBossWave(6)).toBe(false)
    expect(isBossWave(9)).toBe(false)
  })
})

describe('boss composition in getWaveComposition', () => {
  it('wave 5 includes exactly one colossus entry', () => {
    const comp = getWaveComposition(5)
    const boss = comp.filter(c => c.type === 'colossus')
    expect(boss).toHaveLength(1)
    expect(boss[0].count).toBe(1)
  })

  it('wave 10 includes exactly one colossus entry', () => {
    const comp = getWaveComposition(10)
    const boss = comp.filter(c => c.type === 'colossus')
    expect(boss).toHaveLength(1)
    expect(boss[0].count).toBe(1)
  })

  it('wave 1 has no colossus', () => {
    const comp = getWaveComposition(1)
    expect(comp.some(c => c.type === 'colossus')).toBe(false)
  })

  it('wave 7 has no colossus', () => {
    const comp = getWaveComposition(7)
    expect(comp.some(c => c.type === 'colossus')).toBe(false)
  })

  it('colossus is the last entry on boss waves', () => {
    const comp = getWaveComposition(5)
    expect(comp[comp.length - 1].type).toBe('colossus')
  })
})

describe('boss composition in getEndlessWaveComposition', () => {
  it('wave 15 (endless) includes exactly one colossus entry', () => {
    const comp = getEndlessWaveComposition(15)
    const boss = comp.filter(c => c.type === 'colossus')
    expect(boss).toHaveLength(1)
    expect(boss[0].count).toBe(1)
  })

  it('wave 20 (endless) includes exactly one colossus entry', () => {
    const comp = getEndlessWaveComposition(20)
    const boss = comp.filter(c => c.type === 'colossus')
    expect(boss).toHaveLength(1)
    expect(boss[0].count).toBe(1)
  })

  it('wave 11 (endless) has no colossus', () => {
    const comp = getEndlessWaveComposition(11)
    expect(comp.some(c => c.type === 'colossus')).toBe(false)
  })
})

describe('getWaveEventType', () => {
  it('waves 1–3 always return normal', () => {
    const seeds = [0, 1, 12345, 99999]
    for (const seed of seeds) {
      for (const wave of [1, 2, 3]) {
        expect(getWaveEventType(wave, seed)).toBe('normal')
      }
    }
  })

  it('returns one of the four valid event types for wave ≥ 4', () => {
    const valid = new Set(['normal', 'horde', 'elite', 'stealth'])
    for (let wave = 4; wave <= 20; wave++) {
      expect(valid.has(getWaveEventType(wave, 12345))).toBe(true)
    }
  })

  it('is deterministic: same wave + seed always returns same result', () => {
    for (let wave = 4; wave <= 10; wave++) {
      expect(getWaveEventType(wave, 42)).toBe(getWaveEventType(wave, 42))
    }
  })

  it('different seeds can produce different results for the same wave', () => {
    // Run many seeds and ensure we eventually see variation
    const results = new Set()
    for (let seed = 0; seed < 500; seed++) {
      results.add(getWaveEventType(4, seed))
    }
    // With 500 seeds we expect more than one distinct result
    expect(results.size).toBeGreaterThan(1)
  })

  it('special event frequency is approximately 20% for wave ≥ 4', () => {
    // Run 1000 different seeds for wave 4 and count specials
    let specialCount = 0
    for (let seed = 0; seed < 1000; seed++) {
      const t = getWaveEventType(4, seed)
      if (t !== 'normal') specialCount++
    }
    // Expect between 10% and 35% specials (generous range for LCG distribution)
    expect(specialCount).toBeGreaterThan(100)
    expect(specialCount).toBeLessThan(350)
  })
})

describe('WAVE_EVENT_CONFIG', () => {
  it('horde event has 2.5× count multiplier and forces grunt type', () => {
    expect(WAVE_EVENT_CONFIG.horde.countMultiplier).toBe(2.5)
    expect(WAVE_EVENT_CONFIG.horde.forceType).toBe('grunt')
  })

  it('horde event has +20% gold multiplier (1.2)', () => {
    expect(WAVE_EVENT_CONFIG.horde.goldMultiplier).toBeCloseTo(1.2)
  })

  it('elite event has +50% HP multiplier and +25% speed multiplier', () => {
    expect(WAVE_EVENT_CONFIG.elite.hpMultiplier).toBeCloseTo(1.5)
    expect(WAVE_EVENT_CONFIG.elite.speedMultiplier).toBeCloseTo(1.25)
  })

  it('elite event has +50% gold multiplier (1.5)', () => {
    expect(WAVE_EVENT_CONFIG.elite.goldMultiplier).toBeCloseTo(1.5)
  })

  it('stealth event has stealthDurationMs of 5000', () => {
    expect(WAVE_EVENT_CONFIG.stealth.stealthDurationMs).toBe(5000)
  })

  it('normal event has all multipliers at 1 and no forceType', () => {
    expect(WAVE_EVENT_CONFIG.normal.goldMultiplier).toBe(1)
    expect(WAVE_EVENT_CONFIG.normal.countMultiplier).toBe(1)
    expect(WAVE_EVENT_CONFIG.normal.hpMultiplier).toBe(1)
    expect(WAVE_EVENT_CONFIG.normal.speedMultiplier).toBe(1)
    expect(WAVE_EVENT_CONFIG.normal.forceType).toBeNull()
  })

  it('every event type has a label (except normal which is null)', () => {
    expect(WAVE_EVENT_CONFIG.horde.label).toContain('HORDE')
    expect(WAVE_EVENT_CONFIG.elite.label).toContain('ELITE')
    expect(WAVE_EVENT_CONFIG.stealth.label).toContain('STEALTH')
    expect(WAVE_EVENT_CONFIG.normal.label).toBeNull()
  })
})
