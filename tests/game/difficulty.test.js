import { describe, it, expect } from 'vitest'
import { getDifficultyConfig, applyDifficultyToScore, DIFFICULTY_MODES } from '../../src/game/difficulty'

describe('getDifficultyConfig', () => {
  it('returns correct easy config', () => {
    const cfg = getDifficultyConfig('easy')
    expect(cfg.startingGold).toBe(150)
    expect(cfg.startingLives).toBe(30)
    expect(cfg.enemyHpMult).toBeCloseTo(0.7)
    expect(cfg.enemySpeedMult).toBeCloseTo(0.85)
    expect(cfg.goldPerKillMult).toBeCloseTo(1.3)
    expect(cfg.scoreMultiplier).toBeCloseTo(0.5)
  })

  it('returns correct normal config', () => {
    const cfg = getDifficultyConfig('normal')
    expect(cfg.startingGold).toBe(100)
    expect(cfg.startingLives).toBe(20)
    expect(cfg.enemyHpMult).toBe(1.0)
    expect(cfg.enemySpeedMult).toBe(1.0)
    expect(cfg.goldPerKillMult).toBe(1.0)
    expect(cfg.scoreMultiplier).toBe(1.0)
  })

  it('returns correct hard config', () => {
    const cfg = getDifficultyConfig('hard')
    expect(cfg.startingGold).toBe(75)
    expect(cfg.startingLives).toBe(15)
    expect(cfg.enemyHpMult).toBeCloseTo(1.3)
    expect(cfg.enemySpeedMult).toBeCloseTo(1.2)
    expect(cfg.goldPerKillMult).toBeCloseTo(0.9)
    expect(cfg.scoreMultiplier).toBeCloseTo(1.5)
  })

  it('returns correct nightmare config', () => {
    const cfg = getDifficultyConfig('nightmare')
    expect(cfg.startingGold).toBe(50)
    expect(cfg.startingLives).toBe(10)
    expect(cfg.enemyHpMult).toBeCloseTo(1.8)
    expect(cfg.enemySpeedMult).toBeCloseTo(1.4)
    expect(cfg.goldPerKillMult).toBeCloseTo(0.75)
    expect(cfg.scoreMultiplier).toBeCloseTo(2.5)
  })

  it('falls back to normal for unknown mode', () => {
    const cfg = getDifficultyConfig('unknown')
    expect(cfg.startingGold).toBe(100)
    expect(cfg.scoreMultiplier).toBe(1.0)
  })

  it('all modes have label and colour strings', () => {
    for (const mode of DIFFICULTY_MODES) {
      const cfg = getDifficultyConfig(mode)
      expect(typeof cfg.label).toBe('string')
      expect(cfg.label.length).toBeGreaterThan(0)
      expect(typeof cfg.color).toBe('string')
      expect(cfg.color.startsWith('#')).toBe(true)
    }
  })

  it('DIFFICULTY_MODES contains exactly 4 entries', () => {
    expect(DIFFICULTY_MODES).toHaveLength(4)
    expect(DIFFICULTY_MODES).toContain('easy')
    expect(DIFFICULTY_MODES).toContain('normal')
    expect(DIFFICULTY_MODES).toContain('hard')
    expect(DIFFICULTY_MODES).toContain('nightmare')
  })
})

describe('applyDifficultyToScore', () => {
  it('halves score on easy', () => {
    expect(applyDifficultyToScore(1000, 'easy')).toBe(500)
  })

  it('leaves score unchanged on normal', () => {
    expect(applyDifficultyToScore(1000, 'normal')).toBe(1000)
  })

  it('multiplies score by 1.5 on hard', () => {
    expect(applyDifficultyToScore(1000, 'hard')).toBe(1500)
  })

  it('multiplies score by 2.5 on nightmare', () => {
    expect(applyDifficultyToScore(1000, 'nightmare')).toBe(2500)
  })

  it('returns integer (Math.round applied)', () => {
    // 1001 * 1.5 = 1501.5 → rounds to 1502
    const result = applyDifficultyToScore(1001, 'hard')
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBe(1502)
  })

  it('gold/HP calculations match the issue spec (spot-check)', () => {
    // Hard: 75 gold start, 15 lives, HP ×1.3, speed ×1.2, gold/kill ×0.9
    const hard = getDifficultyConfig('hard')
    const baseGold = 100
    const baseHp = 100
    expect(Math.round(baseGold * hard.goldPerKillMult)).toBe(90)
    expect(Math.round(baseHp * hard.enemyHpMult)).toBe(130)
  })
})
