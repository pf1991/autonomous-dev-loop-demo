import { describe, it, expect } from 'vitest'
import { selectCrateReward, createPowerCrate, CRATE_REWARDS } from '../../src/game/powerCrate.js'

describe('selectCrateReward', () => {
  it('returns one of the three defined rewards', () => {
    const ids = CRATE_REWARDS.map(r => r.id)
    for (let i = 0; i < 20; i++) {
      const reward = selectCrateReward()
      expect(ids).toContain(reward.id)
    }
  })

  it('returns lives reward when randomValue < 1/3', () => {
    const reward = selectCrateReward(0.0)
    expect(reward.id).toBe('lives')
  })

  it('returns gold reward when randomValue is in the second third', () => {
    const reward = selectCrateReward(0.4)
    expect(reward.id).toBe('gold')
  })

  it('returns overcharge reward when randomValue is in the third third', () => {
    const reward = selectCrateReward(0.8)
    expect(reward.id).toBe('overcharge')
  })

  it('never returns undefined', () => {
    // Edge: value just below 1.0 should still return valid reward
    const reward = selectCrateReward(0.9999)
    expect(reward).toBeDefined()
    expect(reward.id).toBeDefined()
  })

  it('reward object has id and label', () => {
    const reward = selectCrateReward(0.1)
    expect(reward).toHaveProperty('id')
    expect(reward).toHaveProperty('label')
  })
})

describe('createPowerCrate', () => {
  it('creates a crate with the given id, row, and col', () => {
    const crate = createPowerCrate('crate-1', 5, 7)
    expect(crate.id).toBe('crate-1')
    expect(crate.row).toBe(5)
    expect(crate.col).toBe(7)
  })

  it('crate object has exactly id, row, col', () => {
    const crate = createPowerCrate('c', 0, 0)
    expect(Object.keys(crate).sort()).toEqual(['col', 'id', 'row'])
  })
})
