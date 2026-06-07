import { describe, it, expect } from 'vitest'
import { createWave, getWaveEnemyHp, getWaveEnemyCount } from '../../src/game/wave.js'

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
