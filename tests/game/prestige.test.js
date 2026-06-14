import { describe, it, expect } from 'vitest'
import { getPrestigeBonus, MAX_PRESTIGE_STARS } from '../../src/game/prestige'

describe('getPrestigeBonus', () => {
  it('returns no bonuses for 0 stars', () => {
    const b = getPrestigeBonus(0)
    expect(b.bonusGold).toBe(0)
    expect(b.bonusLives).toBe(0)
    expect(b.interestRateMult).toBe(1)
    expect(b.upgradeCostMult).toBe(1)
    expect(b.unlockVeteran).toBe(false)
  })

  it('1 star: +10 gold, no other bonuses', () => {
    const b = getPrestigeBonus(1)
    expect(b.bonusGold).toBe(10)
    expect(b.bonusLives).toBe(0)
    expect(b.interestRateMult).toBe(1)
    expect(b.upgradeCostMult).toBe(1)
    expect(b.unlockVeteran).toBe(false)
  })

  it('2 stars: +10 gold, +1 life', () => {
    const b = getPrestigeBonus(2)
    expect(b.bonusGold).toBe(10)
    expect(b.bonusLives).toBe(1)
    expect(b.interestRateMult).toBe(1)
    expect(b.upgradeCostMult).toBe(1)
    expect(b.unlockVeteran).toBe(false)
  })

  it('3 stars: +10 gold, +1 life, unlocks Veteran', () => {
    const b = getPrestigeBonus(3)
    expect(b.bonusGold).toBe(10)
    expect(b.bonusLives).toBe(1)
    expect(b.interestRateMult).toBe(1)
    expect(b.upgradeCostMult).toBe(1)
    expect(b.unlockVeteran).toBe(true)
  })

  it('4 stars: +20 gold, +2 lives, Veteran, +5% interest', () => {
    const b = getPrestigeBonus(4)
    expect(b.bonusGold).toBe(20)
    expect(b.bonusLives).toBe(2)
    expect(b.interestRateMult).toBeCloseTo(1.05)
    expect(b.upgradeCostMult).toBe(1)
    expect(b.unlockVeteran).toBe(true)
  })

  it('5 stars: +30 gold, +3 lives, Veteran, +10% interest, 5% cheaper upgrades', () => {
    const b = getPrestigeBonus(5)
    expect(b.bonusGold).toBe(30)
    expect(b.bonusLives).toBe(3)
    expect(b.interestRateMult).toBeCloseTo(1.10)
    expect(b.upgradeCostMult).toBeCloseTo(0.95)
    expect(b.unlockVeteran).toBe(true)
  })

  it('clamps values above 5 to 5', () => {
    const b = getPrestigeBonus(99)
    expect(b.bonusGold).toBe(30)
    expect(b.bonusLives).toBe(3)
  })

  it('clamps negative values to 0', () => {
    const b = getPrestigeBonus(-5)
    expect(b.bonusGold).toBe(0)
    expect(b.bonusLives).toBe(0)
    expect(b.unlockVeteran).toBe(false)
  })

  it('floors fractional star counts', () => {
    expect(getPrestigeBonus(2.9).bonusGold).toBe(10)
    expect(getPrestigeBonus(2.9).bonusLives).toBe(1)
    expect(getPrestigeBonus(3.0).unlockVeteran).toBe(true)
  })

  it('MAX_PRESTIGE_STARS is 5', () => {
    expect(MAX_PRESTIGE_STARS).toBe(5)
  })
})
