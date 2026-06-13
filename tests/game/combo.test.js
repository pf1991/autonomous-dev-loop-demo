import { describe, it, expect } from 'vitest'
import { computeComboBonus, getComboLabel } from '../../src/game/score'

describe('computeComboBonus', () => {
  it('returns 0 for a single kill (no combo)', () => {
    expect(computeComboBonus(1)).toBe(0)
  })

  it('returns +2 for a Double Kill (2 kills)', () => {
    expect(computeComboBonus(2)).toBe(2)
  })

  it('returns +5 for a Triple Kill (3 kills)', () => {
    expect(computeComboBonus(3)).toBe(5)
  })

  it('returns +10 for a Quad Kill (4 kills)', () => {
    expect(computeComboBonus(4)).toBe(10)
  })

  it('returns +20 for RAMPAGE (5 kills)', () => {
    expect(computeComboBonus(5)).toBe(20)
  })

  it('returns +20 for RAMPAGE at 6+ kills', () => {
    expect(computeComboBonus(6)).toBe(20)
    expect(computeComboBonus(10)).toBe(20)
  })

  it('returns 0 for 0 (edge case)', () => {
    expect(computeComboBonus(0)).toBe(0)
  })
})

describe('getComboLabel', () => {
  it('returns empty string for 1 kill', () => {
    expect(getComboLabel(1)).toBe('')
  })

  it('returns "DOUBLE KILL" for 2 kills', () => {
    expect(getComboLabel(2)).toBe('DOUBLE KILL')
  })

  it('returns "TRIPLE KILL" for 3 kills', () => {
    expect(getComboLabel(3)).toBe('TRIPLE KILL')
  })

  it('returns "QUAD KILL" for 4 kills', () => {
    expect(getComboLabel(4)).toBe('QUAD KILL')
  })

  it('returns "RAMPAGE" for 5 kills', () => {
    expect(getComboLabel(5)).toBe('RAMPAGE')
  })

  it('returns "RAMPAGE" for 10+ kills', () => {
    expect(getComboLabel(10)).toBe('RAMPAGE')
  })
})
