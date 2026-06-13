import { describe, it, expect } from 'vitest'
import { checkAchievements, ACHIEVEMENTS } from '../../src/game/achievements'

// Base game state with no trigger conditions met
const BASE_STATE = {
  totalKills: 0,
  totalTowersPlaced: 0,
  gold: 0,
  waveCompletedClean: false,
  gameWon: false,
  livesRemaining: 20,
  speedDroppedToOne: true,
  maxComboReached: 0,
  sniperDamageDealt: 0,
  bossKilledThisTick: false,
  wave: 1,
  endlessMode: false,
  activeSynergyPairs: 0,
}

describe('ACHIEVEMENTS metadata', () => {
  it('exports exactly 12 achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(12)
  })

  it('has unique IDs', () => {
    const ids = ACHIEVEMENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(12)
  })

  it('every achievement has id, name, and description', () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.id).toBe('string')
      expect(typeof a.name).toBe('string')
      expect(typeof a.description).toBe('string')
    }
  })
})

describe('checkAchievements', () => {
  it('returns empty array when no conditions are met', () => {
    expect(checkAchievements(BASE_STATE, [])).toEqual([])
  })

  it('does not re-unlock already unlocked achievements', () => {
    const state = { ...BASE_STATE, totalKills: 5 }
    expect(checkAchievements(state, ['first_blood'])).toEqual([])
  })

  // --- first_blood ---
  it('unlocks first_blood on first kill', () => {
    const state = { ...BASE_STATE, totalKills: 1 }
    expect(checkAchievements(state, [])).toContain('first_blood')
  })

  it('does not unlock first_blood when kills = 0', () => {
    expect(checkAchievements(BASE_STATE, [])).not.toContain('first_blood')
  })

  // --- tower_builder ---
  it('unlocks tower_builder when 10 towers placed', () => {
    const state = { ...BASE_STATE, totalTowersPlaced: 10 }
    expect(checkAchievements(state, [])).toContain('tower_builder')
  })

  it('unlocks tower_builder when more than 10 towers placed', () => {
    const state = { ...BASE_STATE, totalTowersPlaced: 15 }
    expect(checkAchievements(state, [])).toContain('tower_builder')
  })

  it('does not unlock tower_builder with 9 towers', () => {
    const state = { ...BASE_STATE, totalTowersPlaced: 9 }
    expect(checkAchievements(state, [])).not.toContain('tower_builder')
  })

  // --- golden_hoard ---
  it('unlocks golden_hoard when gold >= 500', () => {
    const state = { ...BASE_STATE, gold: 500 }
    expect(checkAchievements(state, [])).toContain('golden_hoard')
  })

  it('unlocks golden_hoard when gold > 500', () => {
    const state = { ...BASE_STATE, gold: 750 }
    expect(checkAchievements(state, [])).toContain('golden_hoard')
  })

  it('does not unlock golden_hoard when gold < 500', () => {
    const state = { ...BASE_STATE, gold: 499 }
    expect(checkAchievements(state, [])).not.toContain('golden_hoard')
  })

  // --- untouchable ---
  it('unlocks untouchable when wave completed clean', () => {
    const state = { ...BASE_STATE, waveCompletedClean: true }
    expect(checkAchievements(state, [])).toContain('untouchable')
  })

  it('does not unlock untouchable when wave not completed clean', () => {
    expect(checkAchievements(BASE_STATE, [])).not.toContain('untouchable')
  })

  // --- flawless ---
  it('unlocks flawless when game won with 20 lives', () => {
    const state = { ...BASE_STATE, gameWon: true, livesRemaining: 20 }
    expect(checkAchievements(state, [])).toContain('flawless')
  })

  it('does not unlock flawless when lives < 20', () => {
    const state = { ...BASE_STATE, gameWon: true, livesRemaining: 19 }
    expect(checkAchievements(state, [])).not.toContain('flawless')
  })

  it('does not unlock flawless when game not won even with 20 lives', () => {
    const state = { ...BASE_STATE, gameWon: false, livesRemaining: 20 }
    expect(checkAchievements(state, [])).not.toContain('flawless')
  })

  // --- speed_demon ---
  it('unlocks speed_demon when game won without ever dropping to 1x speed', () => {
    const state = { ...BASE_STATE, gameWon: true, speedDroppedToOne: false }
    expect(checkAchievements(state, [])).toContain('speed_demon')
  })

  it('does not unlock speed_demon when speed dropped to 1x during run', () => {
    const state = { ...BASE_STATE, gameWon: true, speedDroppedToOne: true }
    expect(checkAchievements(state, [])).not.toContain('speed_demon')
  })

  it('does not unlock speed_demon when game not won', () => {
    const state = { ...BASE_STATE, gameWon: false, speedDroppedToOne: false }
    expect(checkAchievements(state, [])).not.toContain('speed_demon')
  })

  // --- combo_king ---
  it('unlocks combo_king at 5x combo (RAMPAGE)', () => {
    const state = { ...BASE_STATE, maxComboReached: 5 }
    expect(checkAchievements(state, [])).toContain('combo_king')
  })

  it('unlocks combo_king when combo exceeds 5', () => {
    const state = { ...BASE_STATE, maxComboReached: 8 }
    expect(checkAchievements(state, [])).toContain('combo_king')
  })

  it('does not unlock combo_king with 4x combo', () => {
    const state = { ...BASE_STATE, maxComboReached: 4 }
    expect(checkAchievements(state, [])).not.toContain('combo_king')
  })

  // --- sniper_elite ---
  it('unlocks sniper_elite at 1000 damage', () => {
    const state = { ...BASE_STATE, sniperDamageDealt: 1000 }
    expect(checkAchievements(state, [])).toContain('sniper_elite')
  })

  it('unlocks sniper_elite above 1000 damage', () => {
    const state = { ...BASE_STATE, sniperDamageDealt: 1500 }
    expect(checkAchievements(state, [])).toContain('sniper_elite')
  })

  it('does not unlock sniper_elite below 1000 damage', () => {
    const state = { ...BASE_STATE, sniperDamageDealt: 999 }
    expect(checkAchievements(state, [])).not.toContain('sniper_elite')
  })

  // --- boss_slayer ---
  it('unlocks boss_slayer when boss killed this tick', () => {
    const state = { ...BASE_STATE, bossKilledThisTick: true }
    expect(checkAchievements(state, [])).toContain('boss_slayer')
  })

  it('does not unlock boss_slayer when no boss killed', () => {
    expect(checkAchievements(BASE_STATE, [])).not.toContain('boss_slayer')
  })

  // --- endless_10 ---
  it('unlocks endless_10 at wave 10 in endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: true, wave: 10 }
    expect(checkAchievements(state, [])).toContain('endless_10')
  })

  it('unlocks endless_10 beyond wave 10 in endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: true, wave: 15 }
    expect(checkAchievements(state, [])).toContain('endless_10')
  })

  it('does not unlock endless_10 in non-endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: false, wave: 10 }
    expect(checkAchievements(state, [])).not.toContain('endless_10')
  })

  it('does not unlock endless_10 before wave 10 in endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: true, wave: 9 }
    expect(checkAchievements(state, [])).not.toContain('endless_10')
  })

  // --- endless_20 ---
  it('unlocks endless_20 at wave 20 in endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: true, wave: 20 }
    expect(checkAchievements(state, [])).toContain('endless_20')
  })

  it('does not unlock endless_20 at wave 19 in endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: true, wave: 19 }
    expect(checkAchievements(state, [])).not.toContain('endless_20')
  })

  it('does not unlock endless_20 in non-endless mode', () => {
    const state = { ...BASE_STATE, endlessMode: false, wave: 20 }
    expect(checkAchievements(state, [])).not.toContain('endless_20')
  })

  // --- synergy_master ---
  it('unlocks synergy_master with 3 active synergy pairs', () => {
    const state = { ...BASE_STATE, activeSynergyPairs: 3 }
    expect(checkAchievements(state, [])).toContain('synergy_master')
  })

  it('unlocks synergy_master with more than 3 synergy pairs', () => {
    const state = { ...BASE_STATE, activeSynergyPairs: 5 }
    expect(checkAchievements(state, [])).toContain('synergy_master')
  })

  it('does not unlock synergy_master with 2 synergy pairs', () => {
    const state = { ...BASE_STATE, activeSynergyPairs: 2 }
    expect(checkAchievements(state, [])).not.toContain('synergy_master')
  })

  // --- multiple unlocks in one call ---
  it('can unlock multiple achievements in one call', () => {
    const state = {
      ...BASE_STATE,
      totalKills: 1,
      bossKilledThisTick: true,
    }
    const result = checkAchievements(state, [])
    expect(result).toContain('first_blood')
    expect(result).toContain('boss_slayer')
  })

  it('does not include duplicates when multiple conditions trigger the same achievement', () => {
    const state = { ...BASE_STATE, totalKills: 10 }
    const result = checkAchievements(state, [])
    const firstBloodCount = result.filter(id => id === 'first_blood').length
    expect(firstBloodCount).toBe(1)
  })

  it('ignores already-unlocked achievements even when conditions are met', () => {
    const state = { ...BASE_STATE, bossKilledThisTick: true, totalKills: 5 }
    const result = checkAchievements(state, ['boss_slayer', 'first_blood'])
    expect(result).not.toContain('boss_slayer')
    expect(result).not.toContain('first_blood')
  })

  it('uses default values when optional fields are omitted', () => {
    // Should not crash and should return empty array
    const result = checkAchievements({}, [])
    expect(Array.isArray(result)).toBe(true)
  })
})
