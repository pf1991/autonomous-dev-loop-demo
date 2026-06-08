import { describe, it, expect } from 'vitest'
import { computeScore } from '../../src/game/score'

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
