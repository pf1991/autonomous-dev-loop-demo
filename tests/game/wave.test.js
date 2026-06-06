import { describe, it, expect } from 'vitest'
import { createWave } from '../../src/game/wave.js'

describe('createWave', () => {
  it('wave 1 produces 3 total enemies', () => {
    const wave = createWave(1)
    expect(wave.totalEnemies).toBe(3)
    expect(wave.enemies).toEqual([])
    expect(wave.spawnInterval).toBe(500)
  })

  it('wave 5 produces 15 total enemies', () => {
    const wave = createWave(5)
    expect(wave.totalEnemies).toBe(15)
  })

  it('wave N produces N*3 total enemies', () => {
    for (const n of [1, 2, 3, 10]) {
      expect(createWave(n).totalEnemies).toBe(n * 3)
    }
  })

  it('always starts with an empty enemies array', () => {
    expect(createWave(3).enemies).toEqual([])
  })

  it('always has spawnInterval of 500', () => {
    expect(createWave(7).spawnInterval).toBe(500)
  })
})
