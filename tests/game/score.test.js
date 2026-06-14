import { describe, it, expect } from 'vitest'
import { computeScore, computeInterest } from '../../src/game/score'

describe('computeScore', () => {
  it('computes correct score for known inputs', () => {
    // kills=10, goldEarned=50, livesRemaining=15, wavesCompleted=3
    // (10*10) + (50*2) + (15*50) + (3*100) = 100 + 100 + 750 + 300 = 1250
    expect(computeScore({ kills: 10, goldEarned: 50, livesRemaining: 15, wavesCompleted: 3 })).toBe(1250)
  })

  it('returns 0 for all-zero inputs', () => {
    expect(computeScore({ kills: 0, goldEarned: 0, livesRemaining: 0, wavesCompleted: 0 })).toBe(0)
  })

  it('weighs lives and waves more heavily than kills and gold', () => {
    const scoreHighLives = computeScore({ kills: 0, goldEarned: 0, livesRemaining: 1, wavesCompleted: 0 })
    const scoreHighKills = computeScore({ kills: 5, goldEarned: 0, livesRemaining: 0, wavesCompleted: 0 })
    // 1 life = 50 pts, 5 kills = 50 pts — equal
    expect(scoreHighLives).toBe(scoreHighKills)
  })

  it('computes correct score for a won game', () => {
    // Typical win: 80 kills, 200 gold earned, 18 lives remaining, 10 waves
    // (80*10) + (200*2) + (18*50) + (10*100) = 800 + 400 + 900 + 1000 = 3100
    expect(computeScore({ kills: 80, goldEarned: 200, livesRemaining: 18, wavesCompleted: 10 })).toBe(3100)
  })
})

describe('computeInterest', () => {
  it('returns 0 when gold is 0 (no interest on empty wallet)', () => {
    expect(computeInterest(0)).toBe(0)
  })

  it('returns 0 when gold is negative', () => {
    expect(computeInterest(-100)).toBe(0)
  })

  it('returns minimum 1 gold when gold is 1 (floor(1*0.05)=0, but min=1)', () => {
    expect(computeInterest(1)).toBe(1)
  })

  it('returns floor(gold * 0.05) for 100 gold — 5 gold interest', () => {
    // floor(100 * 0.05) = floor(5) = 5, clamped between 1 and 50
    expect(computeInterest(100)).toBe(5)
  })

  it('returns correct interest for 1000 gold — 50 gold (at cap)', () => {
    // floor(1000 * 0.05) = floor(50) = 50; exactly at the cap
    expect(computeInterest(1000)).toBe(50)
  })

  it('caps at 50 gold for 2000 gold (prevents runaway scaling)', () => {
    // floor(2000 * 0.05) = 100, but max is 50
    expect(computeInterest(2000)).toBe(50)
  })

  it('caps at 50 for very large gold reserves', () => {
    expect(computeInterest(100000)).toBe(50)
  })

  it('returns minimum 1 for any small positive gold amount where floor gives 0', () => {
    // floor(15 * 0.05) = floor(0.75) = 0 → clamped to min 1
    expect(computeInterest(15)).toBe(1)
  })
})
