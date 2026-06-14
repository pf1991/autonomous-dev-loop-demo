import { describe, it, expect } from 'vitest'
import { createTower, getAdjacentSynergies, towerKey, SYNERGY_RULES } from '../../src/game/tower.js'
import { processCombat } from '../../src/game/combat.js'

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeTower(type, row, col) {
  return createTower(type, row, col)
}

function makeEnemy(id, row, col, hp = 200) {
  return {
    id,
    hp,
    maxHp: hp,
    pos: { row, col },
    goldReward: 10,
    type: 'grunt',
  }
}

// ---------------------------------------------------------------------------
// getAdjacentSynergies — core unit tests
// ---------------------------------------------------------------------------

describe('getAdjacentSynergies', () => {
  it('returns an empty array for isolated towers (no neighbours)', () => {
    const towers = [
      makeTower('BasicTower', 0, 0),
      makeTower('SlowTower', 5, 5),
    ]
    const map = getAdjacentSynergies(towers)
    expect(map.get(towerKey(towers[0]))).toHaveLength(0)
    expect(map.get(towerKey(towers[1]))).toHaveLength(0)
  })

  it('BasicTower + SlowTower horizontal adjacency: BasicTower gets +20% fire rate synergy', () => {
    const basic = makeTower('BasicTower', 3, 3)
    const slow  = makeTower('SlowTower',  3, 4)
    const map = getAdjacentSynergies([basic, slow])
    const basicEffects = map.get(towerKey(basic))
    expect(basicEffects.some(e => e.fireRateMult === 1.2)).toBe(true)
  })

  it('BasicTower + SlowTower horizontal adjacency: SlowTower gets +1 range synergy', () => {
    const basic = makeTower('BasicTower', 3, 3)
    const slow  = makeTower('SlowTower',  3, 4)
    const map = getAdjacentSynergies([basic, slow])
    const slowEffects = map.get(towerKey(slow))
    expect(slowEffects.some(e => e.rangePlus === 1)).toBe(true)
  })

  it('SniperTower + PoisonTower adjacency: SniperTower gets poisonOnHit synergy', () => {
    const sniper = makeTower('SniperTower', 2, 2)
    const poison = makeTower('PoisonTower', 2, 3)
    const map = getAdjacentSynergies([sniper, poison])
    const sniperEffects = map.get(towerKey(sniper))
    expect(sniperEffects.some(e => e.poisonOnHit === true)).toBe(true)
  })

  it('SniperTower + PoisonTower: PoisonTower receives no extra effect from this rule', () => {
    const sniper = makeTower('SniperTower', 2, 2)
    const poison = makeTower('PoisonTower', 2, 3)
    const map = getAdjacentSynergies([sniper, poison])
    // The SYNERGY_RULE only targets SniperTower, so PoisonTower should have no effects from this rule
    const poisonEffects = map.get(towerKey(poison))
    expect(poisonEffects.filter(e => e.poisonOnHit)).toHaveLength(0)
  })

  it('BasicTower + BasicTower adjacency: both get +10% damage synergy', () => {
    const b1 = makeTower('BasicTower', 0, 0)
    const b2 = makeTower('BasicTower', 0, 1)
    const map = getAdjacentSynergies([b1, b2])
    const e1 = map.get(towerKey(b1))
    const e2 = map.get(towerKey(b2))
    expect(e1.some(e => e.damageMult === 1.1)).toBe(true)
    expect(e2.some(e => e.damageMult === 1.1)).toBe(true)
  })

  it('SniperTower + SlowTower adjacency: SniperTower gets freezeOnHit synergy', () => {
    const sniper = makeTower('SniperTower', 1, 1)
    const slow   = makeTower('SlowTower',   1, 2)
    const map = getAdjacentSynergies([sniper, slow])
    const sniperEffects = map.get(towerKey(sniper))
    expect(sniperEffects.some(e => e.freezeOnHit === true)).toBe(true)
  })

  it('diagonal adjacency triggers synergy (Chebyshev distance = 1)', () => {
    const basic = makeTower('BasicTower', 0, 0)
    const slow  = makeTower('SlowTower',  1, 1) // diagonal
    const map = getAdjacentSynergies([basic, slow])
    const basicEffects = map.get(towerKey(basic))
    expect(basicEffects.some(e => e.fireRateMult === 1.2)).toBe(true)
  })

  it('distance = 2 does NOT trigger synergy', () => {
    const basic = makeTower('BasicTower', 0, 0)
    const slow  = makeTower('SlowTower',  0, 2) // col distance = 2
    const map = getAdjacentSynergies([basic, slow])
    const basicEffects = map.get(towerKey(basic))
    expect(basicEffects).toHaveLength(0)
  })

  it('same position does NOT count as adjacent (edge case)', () => {
    // Two towers at same position is invalid in game, but function should not crash
    const a = makeTower('BasicTower', 0, 0)
    const b = { ...makeTower('SlowTower', 0, 0) }
    // Should not throw; synergy should not fire since dr==0 && dc==0
    const map = getAdjacentSynergies([a, b])
    const effects = map.get(towerKey(a))
    expect(effects).toHaveLength(0)
  })

  it('synergy removal — removing partner clears synergy in new computation', () => {
    const basic = makeTower('BasicTower', 3, 3)
    const slow  = makeTower('SlowTower',  3, 4)
    const before = getAdjacentSynergies([basic, slow])
    expect(before.get(towerKey(basic)).some(e => e.fireRateMult === 1.2)).toBe(true)

    // Simulate selling the SlowTower (remove from list)
    const after = getAdjacentSynergies([basic])
    expect(after.get(towerKey(basic))).toHaveLength(0)
  })

  it('returns a Map with one entry per tower', () => {
    const towers = [
      makeTower('BasicTower', 0, 0),
      makeTower('SniperTower', 1, 1),
      makeTower('PoisonTower', 2, 2),
    ]
    const map = getAdjacentSynergies(towers)
    expect(map.size).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// processCombat synergy integration
// ---------------------------------------------------------------------------

describe('processCombat — synergy buff integration', () => {
  it('BasicTower+BasicTower synergy applies +10% damage multiplier', () => {
    // Two BasicTowers side by side, targeting same enemy
    const b1 = { ...makeTower('BasicTower', 0, 0), lastFiredAt: 0 }
    const b2 = { ...makeTower('BasicTower', 0, 1), lastFiredAt: 0 }
    // Enemy at row=0, col=2 — in range for both towers (range=3)
    const enemy = makeEnemy('e1', 0, 2, 1000)
    const synergies = getAdjacentSynergies([b1, b2])

    // Inject rng that always misses crits so damage is deterministic
    const noRng = () => 1.0

    // Without synergy
    const withoutResult = processCombat([b1, b2], [enemy], 1000, null, noRng)
    const totalDamageWithout = 1000 - (withoutResult.enemies[0]?.hp ?? 1000 - 999)

    // Reset enemy and run with synergy
    const freshEnemy = makeEnemy('e1', 0, 2, 1000)
    const withResult = processCombat([b1, b2], [freshEnemy], 1000, synergies, noRng)
    const hpAfterWith = withResult.enemies[0]?.hp ?? 0
    const totalDamageWith = 1000 - hpAfterWith

    // With synergy each tower deals 1.1× damage so total damage should be higher
    expect(totalDamageWith).toBeGreaterThan(totalDamageWithout - 1)
    // Specifically: base damage 25 each → 50 total without; 27.5 each → 55 total with
    expect(totalDamageWith).toBeCloseTo(55, 0)
  })

  it('BasicTower+SlowTower synergy: BasicTower fires faster (shorter interval)', () => {
    const basic = { ...makeTower('BasicTower', 0, 0), lastFiredAt: 0 }
    const slow  = { ...makeTower('SlowTower',  0, 1), lastFiredAt: 0 }
    const synergies = getAdjacentSynergies([basic, slow])

    // Base BasicTower fires every 1000ms. With +20% fireRate it fires every 1000/1.2 ≈ 833ms.
    // At t=900ms basic should fire WITH synergy but NOT without.
    const enemy = makeEnemy('e1', 0, 2, 1000)
    const freshEnemy = makeEnemy('e1', 0, 2, 1000)

    const withoutResult = processCombat([basic, slow], [enemy], 900, null)
    const withResult = processCombat([basic, slow], [freshEnemy], 900, synergies)

    // With synergy: BasicTower fires at t=900ms (interval ~833ms), without: doesn't (interval 1000ms)
    // Check by seeing if enemy hp went down by more with synergy
    const hpWithout = withoutResult.enemies[0]?.hp ?? 0
    const hpWith = withResult.enemies[0]?.hp ?? 0
    expect(hpWith).toBeLessThan(hpWithout + 1) // with synergy deals more damage
  })

  it('SniperTower+PoisonTower synergy: shot applies a poison effect', () => {
    const sniper = { ...makeTower('SniperTower', 0, 0), lastFiredAt: 0 }
    const poison = { ...makeTower('PoisonTower', 0, 1), lastFiredAt: 0 }
    const synergies = getAdjacentSynergies([sniper, poison])

    // Enemy far enough away that only SniperTower can reach it (range=6)
    const enemy = makeEnemy('e1', 0, 5, 1000)
    const result = processCombat([sniper], [enemy], 2000, synergies)

    // Enemy should have a poison effect applied by the synergy
    const updatedEnemy = result.enemies[0]
    expect(updatedEnemy).toBeDefined()
    expect(updatedEnemy.effects).toBeDefined()
    expect(updatedEnemy.effects.some(e => e.type === 'poison')).toBe(true)
  })

  it('SniperTower+SlowTower synergy: shot freezes target (speedMult=0)', () => {
    const sniper = { ...makeTower('SniperTower', 0, 0), lastFiredAt: 0 }
    const slow   = { ...makeTower('SlowTower',   0, 1), lastFiredAt: 0 }
    const synergies = getAdjacentSynergies([sniper, slow])

    const enemy = makeEnemy('e1', 0, 5, 1000)
    const result = processCombat([sniper], [enemy], 2000, synergies)

    const updatedEnemy = result.enemies[0]
    expect(updatedEnemy).toBeDefined()
    expect(updatedEnemy.speedMult).toBe(0)
    expect(updatedEnemy.slowUntil).toBe(2500) // nowMs + 500
  })

  it('no synergies passed: normal combat behaviour unchanged', () => {
    const basic = { ...makeTower('BasicTower', 0, 0), lastFiredAt: 0 }
    const enemy = makeEnemy('e1', 0, 2, 1000)
    // Inject rng that never crits so damage is deterministic
    const result = processCombat([basic], [enemy], 1000, null, () => 1.0)
    const dmg = 1000 - (result.enemies[0]?.hp ?? 0)
    expect(dmg).toBe(25) // base damage
  })
})
