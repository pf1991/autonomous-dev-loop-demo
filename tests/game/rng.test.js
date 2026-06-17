import { describe, it, expect } from 'vitest'
import { makeRng, seedFromHex, seedToHex } from '../../src/game/rng.js'

describe('makeRng', () => {
  it('returns a function', () => {
    expect(typeof makeRng(42)).toBe('function')
  })

  it('produces floats in [0, 1)', () => {
    const rng = makeRng(12345)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('same seed produces identical sequence', () => {
    const rng1 = makeRng(99999)
    const rng2 = makeRng(99999)
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = makeRng(1)
    const rng2 = makeRng(2)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })

  it('advances state on each call (not stuck)', () => {
    const rng = makeRng(777)
    const first = rng()
    const second = rng()
    expect(first).not.toBe(second)
  })
})

describe('seedFromHex', () => {
  it('parses a valid 8-char hex string to a number', () => {
    expect(seedFromHex('a3f7c2b1')).toBe(0xa3f7c2b1)
  })

  it('returns null for strings shorter than 8 chars', () => {
    expect(seedFromHex('abc')).toBeNull()
  })

  it('returns null for strings longer than 8 chars', () => {
    expect(seedFromHex('a3f7c2b100')).toBeNull()
  })

  it('returns null for non-hex characters', () => {
    expect(seedFromHex('zzzzzzzz')).toBeNull()
  })

  it('accepts uppercase hex', () => {
    expect(seedFromHex('A3F7C2B1')).toBe(0xa3f7c2b1)
  })
})

describe('seedToHex', () => {
  it('converts 0 to "00000000"', () => {
    expect(seedToHex(0)).toBe('00000000')
  })

  it('converts 0xffffffff to "ffffffff"', () => {
    expect(seedToHex(0xffffffff)).toBe('ffffffff')
  })

  it('always returns an 8-character string', () => {
    for (const seed of [1, 255, 65536, 0xdeadbeef]) {
      expect(seedToHex(seed)).toHaveLength(8)
    }
  })

  it('round-trips with seedFromHex', () => {
    const seeds = [0, 1, 12345, 0xdeadbeef, 0xffffffff]
    for (const seed of seeds) {
      expect(seedFromHex(seedToHex(seed))).toBe(seed >>> 0)
    }
  })
})
