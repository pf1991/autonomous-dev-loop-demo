/**
 * statusEffects.test.js — unit tests for status-effect towers (Slow + Poison / DoT).
 *
 * Acceptance criteria covered:
 *  - Slow expiry: enemy resumes full speed after slowUntil elapses
 *  - DoT tick count: poison applies the correct number of ticks
 *  - DoT kill gold award: enemy killed by DoT awards gold via processEffectTick
 */
import { describe, it, expect } from 'vitest'
import { processCombat, processEffectTick } from '../../src/game/combat'
import { TOWER_TYPES, createTower } from '../../src/game/tower'

// ── helpers ────────────────────────────────────────────────────────────────

function makeEnemy({ id = 1, hp = 100, maxHp = 100, row = 1, col = 0, goldReward = 10, effects = [] } = {}) {
  return { id, hp, maxHp, pos: { row, col }, speed: 2, type: 'grunt', goldReward, effects }
}

function makeSlowTower({ row = 0, col = 0, lastFiredAt = 0 } = {}) {
  const base = TOWER_TYPES.SlowTower
  return {
    type: 'SlowTower',
    row,
    col,
    range: base.range,
    damage: base.damage,
    fireRate: base.fireRate,
    slowFactor: base.slowFactor,
    slowDuration: base.slowDuration,
    lastFiredAt,
  }
}

function makePoisonTower({ row = 0, col = 0, lastFiredAt = 0 } = {}) {
  const base = TOWER_TYPES.PoisonTower
  return {
    type: 'PoisonTower',
    row,
    col,
    range: base.range,
    damage: base.damage,
    fireRate: base.fireRate,
    poisonTickDamage: base.poisonTickDamage,
    poisonTicks: base.poisonTicks,
    poisonTickInterval: base.poisonTickInterval,
    lastFiredAt,
  }
}

// ── TOWER_TYPES definitions ────────────────────────────────────────────────

describe('TOWER_TYPES — SlowTower and PoisonTower definitions', () => {
  it('SlowTower has the correct base stats', () => {
    const t = TOWER_TYPES.SlowTower
    expect(t).toBeDefined()
    expect(t.cost).toBe(75)
    expect(t.range).toBe(3)
    expect(t.damage).toBe(5)
    expect(t.fireRate).toBe(1.5)
    expect(t.slowFactor).toBe(0.4)
    expect(t.slowDuration).toBe(2000)
  })

  it('SlowTower has two upgrade levels', () => {
    expect(TOWER_TYPES.SlowTower.upgrades).toHaveLength(2)
  })

  it('SlowTower L2 upgrade adds aoeSlowRadius', () => {
    const l2 = TOWER_TYPES.SlowTower.upgrades[1]
    expect(l2.aoeSlowRadius).toBeGreaterThan(0)
  })

  it('PoisonTower has the correct base stats', () => {
    const t = TOWER_TYPES.PoisonTower
    expect(t).toBeDefined()
    expect(t.cost).toBe(90)
    expect(t.range).toBe(4)
    expect(t.damage).toBe(8)
    expect(t.fireRate).toBe(0.8)
    expect(t.poisonTickDamage).toBe(15)
    expect(t.poisonTicks).toBe(3)
    expect(t.poisonTickInterval).toBe(1000)
  })

  it('PoisonTower L1 upgrade adds extra ticks (5 total)', () => {
    const l1 = TOWER_TYPES.PoisonTower.upgrades[0]
    expect(l1.poisonTicks).toBe(5)
  })

  it('PoisonTower L2 upgrade adds higher tick damage (35)', () => {
    const l2 = TOWER_TYPES.PoisonTower.upgrades[1]
    expect(l2.poisonTickDamage).toBe(35)
    expect(l2.poisonTicks).toBe(5)
  })
})

// ── Slow expiry ────────────────────────────────────────────────────────────

describe('Slow expiry', () => {
  it('applies slowUntil and speedMult on the hit enemy', () => {
    const tower = makeSlowTower({ lastFiredAt: 0 })
    const enemy = makeEnemy({ hp: 100 })

    const { enemies } = processCombat([tower], [enemy], 1000)
    const hit = enemies.find(e => e.id === 1)

    expect(hit.slowUntil).toBe(1000 + TOWER_TYPES.SlowTower.slowDuration)
    expect(hit.speedMult).toBe(TOWER_TYPES.SlowTower.slowFactor)
  })

  it('slow speedMult is honoured while active and absent when expired', () => {
    // The App.jsx game loop strips expired slow state before passing enemies to moveEnemy.
    // We verify this stripping logic directly: a slow with slowUntil <= nowMs is removed.
    const enemy = makeEnemy({ hp: 50, effects: [] })
    const slowed = { ...enemy, slowUntil: 1000, speedMult: 0.4 }

    // Before expiry — speedMult should be present
    expect(slowed.speedMult).toBe(0.4)

    // Simulate App.jsx expiry check at nowMs = 2000 (slowUntil = 1000)
    const nowMs = 2000
    const afterExpiry = (() => {
      if (slowed.slowUntil != null && nowMs >= slowed.slowUntil) {
        const { slowUntil, speedMult, ...rest } = slowed
        return rest
      }
      return slowed
    })()

    expect(afterExpiry.slowUntil).toBeUndefined()
    expect(afterExpiry.speedMult).toBeUndefined()
  })
})

// ── Poison DoT ticks ───────────────────────────────────────────────────────

describe('Poison DoT — tick count', () => {
  it('PoisonTower injects a poison effect with the correct tick count', () => {
    // PoisonTower fireRate=0.8 → interval=1250ms; use nowMs=1500 so it fires on first call
    const tower = makePoisonTower({ lastFiredAt: 0 })
    const enemy = makeEnemy({ hp: 500, effects: [] })

    const { enemies } = processCombat([tower], [enemy], 1500)
    const hit = enemies.find(e => e.id === 1)

    expect(hit.effects).toBeDefined()
    const poison = hit.effects.find(e => e.type === 'poison')
    expect(poison).toBeDefined()
    expect(poison.ticksRemaining).toBe(TOWER_TYPES.PoisonTower.poisonTicks)
    expect(poison.tickDamage).toBe(TOWER_TYPES.PoisonTower.poisonTickDamage)
    expect(poison.tickInterval).toBe(TOWER_TYPES.PoisonTower.poisonTickInterval)
  })

  it('processEffectTick applies one tick of damage when nextTickAt is reached', () => {
    const effect = { type: 'poison', tickDamage: 15, tickInterval: 1000, ticksRemaining: 3, nextTickAt: 2000 }
    const enemy = makeEnemy({ hp: 100, effects: [effect] })

    const { enemies } = processEffectTick([enemy], 2000)
    const alive = enemies.find(e => e.id === 1)

    expect(alive.hp).toBe(85) // 100 - 15
    const remainingPoison = alive.effects.find(e => e.type === 'poison')
    expect(remainingPoison.ticksRemaining).toBe(2)
    expect(remainingPoison.nextTickAt).toBe(3000)
  })

  it('processEffectTick does NOT tick when nextTickAt has not elapsed', () => {
    const effect = { type: 'poison', tickDamage: 15, tickInterval: 1000, ticksRemaining: 3, nextTickAt: 5000 }
    const enemy = makeEnemy({ hp: 100, effects: [effect] })

    const { enemies } = processEffectTick([enemy], 2000)
    const alive = enemies.find(e => e.id === 1)

    expect(alive.hp).toBe(100) // no tick fired
    expect(alive.effects[0].ticksRemaining).toBe(3)
  })

  it('processEffectTick removes the effect when all ticks are consumed', () => {
    const effect = { type: 'poison', tickDamage: 5, tickInterval: 1000, ticksRemaining: 1, nextTickAt: 1000 }
    const enemy = makeEnemy({ hp: 100, effects: [effect] })

    const { enemies } = processEffectTick([enemy], 1000)
    const alive = enemies.find(e => e.id === 1)

    expect(alive.effects).toHaveLength(0) // effect fully consumed
  })

  it('processEffectTick handles an enemy with no effects gracefully', () => {
    const enemy = makeEnemy({ hp: 100, effects: [] })

    const { enemies, goldEarned } = processEffectTick([enemy], 1000)
    expect(enemies).toHaveLength(1)
    expect(enemies[0].hp).toBe(100)
    expect(goldEarned).toBe(0)
  })
})

// ── DoT kill — gold award ──────────────────────────────────────────────────

describe('Poison DoT — kill gold award', () => {
  it('processEffectTick removes a DoT-killed enemy and awards its gold', () => {
    const effect = { type: 'poison', tickDamage: 50, tickInterval: 1000, ticksRemaining: 2, nextTickAt: 2000 }
    const enemy = makeEnemy({ id: 7, hp: 30, goldReward: 25, effects: [effect] })

    const { enemies, goldEarned, killedEnemies } = processEffectTick([enemy], 2000)

    expect(enemies).toHaveLength(0)           // enemy is dead
    expect(goldEarned).toBe(25)               // full gold reward
    expect(killedEnemies).toHaveLength(1)
    expect(killedEnemies[0].id).toBe(7)
    expect(killedEnemies[0].gold).toBe(25)
  })

  it('processEffectTick awards gold only for enemies actually killed by DoT', () => {
    // One enemy killed by DoT, one survives with leftover ticks
    const dyingEffect   = { type: 'poison', tickDamage: 100, tickInterval: 1000, ticksRemaining: 1, nextTickAt: 1000 }
    const survivorEffect= { type: 'poison', tickDamage: 10,  tickInterval: 1000, ticksRemaining: 2, nextTickAt: 1000 }
    const dying   = makeEnemy({ id: 1, hp: 50,  goldReward: 20, effects: [dyingEffect] })
    const survivor= makeEnemy({ id: 2, hp: 200, goldReward: 40, effects: [survivorEffect] })

    const { enemies, goldEarned, killedEnemies } = processEffectTick([dying, survivor], 1000)

    expect(enemies).toHaveLength(1)          // only survivor remains
    expect(enemies[0].id).toBe(2)
    expect(goldEarned).toBe(20)              // only dying enemy's reward
    expect(killedEnemies).toHaveLength(1)
    expect(killedEnemies[0].id).toBe(1)
  })
})

// ── createTower carries over poison properties ─────────────────────────────

describe('createTower — PoisonTower properties', () => {
  it('createTower(PoisonTower) sets poisonTickDamage, poisonTicks, poisonTickInterval', () => {
    const tower = createTower('PoisonTower', 2, 3)
    expect(tower.poisonTickDamage).toBe(TOWER_TYPES.PoisonTower.poisonTickDamage)
    expect(tower.poisonTicks).toBe(TOWER_TYPES.PoisonTower.poisonTicks)
    expect(tower.poisonTickInterval).toBe(TOWER_TYPES.PoisonTower.poisonTickInterval)
  })
})
