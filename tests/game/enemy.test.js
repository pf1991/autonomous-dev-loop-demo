import { describe, it, expect } from 'vitest'
import { createEnemy, moveEnemy, getEnemyRadius, getBossHp, getEnemyHpForWave, ENEMY_TYPES } from '../../src/game/enemy.js'

const WAYPOINTS = [
  { row: 0, col: 0 },
  { row: 0, col: 5 },
  { row: 5, col: 5 },
]

describe('createEnemy', () => {
  it('defaults to grunt type', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    expect(enemy.type).toBe('grunt')
    expect(enemy.hp).toBe(80)
    expect(enemy.maxHp).toBe(80)
    expect(enemy.speed).toBe(3.0)
    expect(enemy.goldReward).toBe(8)
    expect(enemy.waypointIndex).toBe(0)
    expect(enemy.pos).toEqual({ row: 0, col: 0 })
  })

  it('creates a grunt with correct stats', () => {
    const enemy = createEnemy('e2', WAYPOINTS, 'grunt')
    expect(enemy.hp).toBe(80)
    expect(enemy.maxHp).toBe(80)
    expect(enemy.speed).toBe(3.0)
    expect(enemy.goldReward).toBe(8)
    expect(enemy.type).toBe('grunt')
  })

  it('creates a tank with correct stats', () => {
    const enemy = createEnemy('e3', WAYPOINTS, 'tank')
    expect(enemy.hp).toBe(300)
    expect(enemy.maxHp).toBe(300)
    expect(enemy.speed).toBe(1.0)
    expect(enemy.goldReward).toBe(25)
    expect(enemy.type).toBe('tank')
  })

  it('unknown type falls back to grunt stats', () => {
    const enemy = createEnemy('e4', WAYPOINTS, 'unknown')
    expect(enemy.hp).toBe(80)
    expect(enemy.speed).toBe(3.0)
  })
})

describe('moveEnemy', () => {
  it('deltaMs=0 returns an unchanged enemy', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    const result = moveEnemy(enemy, 0, WAYPOINTS)
    expect(result).not.toBeNull()
    expect(result.pos).toEqual(enemy.pos)
    expect(result.waypointIndex).toBe(enemy.waypointIndex)
  })

  it('enemy moves toward next waypoint when given a positive deltaMs', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    // grunt speed=3.0 tiles/sec; 333ms → ~1 tile of movement along col axis
    const result = moveEnemy(enemy, 333, WAYPOINTS)
    expect(result).not.toBeNull()
    // Should have moved right (increasing col)
    expect(result.pos.col).toBeGreaterThan(0)
    expect(result.pos.row).toBeCloseTo(0)
  })

  it('enemy reaches and advances past a waypoint correctly', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    // 5 cols to next waypoint at grunt speed 3.0 tiles/sec → ~1667ms to reach exactly
    const result = moveEnemy(enemy, 1667, WAYPOINTS)
    expect(result).not.toBeNull()
    expect(result.waypointIndex).toBe(1)
    expect(result.pos.col).toBeCloseTo(5)
    expect(result.pos.row).toBeCloseTo(0)
  })

  it('returns null when enemy reaches the last waypoint', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    // Very large deltaMs to guarantee the enemy traverses all waypoints
    const result = moveEnemy(enemy, 999999, WAYPOINTS)
    expect(result).toBeNull()
  })

  it('returns null when enemy is already at the last waypoint and given movement time', () => {
    // Place enemy at the last waypoint index
    const enemy = {
      ...createEnemy('e1', WAYPOINTS),
      waypointIndex: WAYPOINTS.length - 1,
      pos: { ...WAYPOINTS[WAYPOINTS.length - 1] },
    }
    const result = moveEnemy(enemy, 100, WAYPOINTS)
    expect(result).toBeNull()
  })
})

describe('moveEnemy — slow debuff (speedMult)', () => {
  it('enemy with speedMult 0.5 moves half as far in the same time', () => {
    const normal = createEnemy('a', WAYPOINTS, 'grunt')
    const slowed = { ...createEnemy('b', WAYPOINTS, 'grunt'), speedMult: 0.5 }

    const movedNormal = moveEnemy(normal, 500, WAYPOINTS)
    const movedSlowed = moveEnemy(slowed, 500, WAYPOINTS)

    // slowed enemy should travel half the column distance
    expect(movedSlowed.pos.col).toBeCloseTo(movedNormal.pos.col / 2)
  })

  it('enemy without speedMult moves at full speed', () => {
    const enemy = createEnemy('c', WAYPOINTS, 'grunt')
    const result = moveEnemy(enemy, 1000, WAYPOINTS)
    // grunt speed=3 tiles/s → 3 tiles in 1s
    expect(result.pos.col).toBeCloseTo(3)
  })

  it('enemy with speedMult 1 (no slow) moves at full speed', () => {
    const enemy = { ...createEnemy('d', WAYPOINTS, 'grunt'), speedMult: 1 }
    const result = moveEnemy(enemy, 1000, WAYPOINTS)
    expect(result.pos.col).toBeCloseTo(3)
  })
})

describe('getEnemyRadius', () => {
  it('returns 10 for grunt type', () => expect(getEnemyRadius(80, 80, 'grunt')).toBe(10))
  it('returns 16 for tank type', () => expect(getEnemyRadius(300, 300, 'tank')).toBe(16))
  // Legacy HP-ratio fallback (no type provided)
  it('returns 14 for full HP (legacy)', () => expect(getEnemyRadius(100, 100)).toBe(14))
  it('returns 14 at exactly 50% HP (legacy)', () => expect(getEnemyRadius(50, 100)).toBe(14))
  it('returns 11 for 49% HP (legacy)', () => expect(getEnemyRadius(49, 100)).toBe(11))
  it('returns 11 at exactly 25% HP (legacy)', () => expect(getEnemyRadius(25, 100)).toBe(11))
  it('returns 8 for 24% HP (legacy)', () => expect(getEnemyRadius(24, 100)).toBe(8))
  it('returns 8 for 0 HP (legacy)', () => expect(getEnemyRadius(0, 100)).toBe(8))
  it('returns 8 when maxHp is 0 (guard, legacy)', () => expect(getEnemyRadius(0, 0)).toBe(8))
  it('returns 28 for colossus type', () => expect(getEnemyRadius(900, 900, 'colossus')).toBe(28))
})

describe('getBossHp', () => {
  it('returns 3× tank base HP', () => {
    expect(getBossHp()).toBe(3 * ENEMY_TYPES.tank.hp)
  })

  it('returns 900', () => {
    expect(getBossHp()).toBe(900)
  })
})

describe('createEnemy — colossus with HP override', () => {
  it('uses hpOverride when provided', () => {
    const enemy = createEnemy('b1', WAYPOINTS, 'colossus', 900)
    expect(enemy.hp).toBe(900)
    expect(enemy.maxHp).toBe(900)
    expect(enemy.type).toBe('colossus')
  })

  it('colossus goldReward is 150', () => {
    const enemy = createEnemy('b1', WAYPOINTS, 'colossus')
    expect(enemy.goldReward).toBe(150)
  })

  it('colossus speed is 0.6', () => {
    const enemy = createEnemy('b1', WAYPOINTS, 'colossus')
    expect(enemy.speed).toBe(0.6)
  })
})

describe('getEnemyHpForWave', () => {
  it('grunt wave 1 returns base grunt HP (80)', () => {
    expect(getEnemyHpForWave('grunt', 1)).toBe(80)
  })

  it('tank wave 1 returns base tank HP (300)', () => {
    expect(getEnemyHpForWave('tank', 1)).toBe(300)
  })

  it('armored wave 1 returns base armored HP (600)', () => {
    expect(getEnemyHpForWave('armored', 1)).toBe(600)
  })

  it('grunt wave 2 is 1.4× wave 1 grunt HP', () => {
    expect(getEnemyHpForWave('grunt', 2)).toBe(Math.round(80 * 1.4))
  })

  it('tank wave 5 scales by 1.4^4', () => {
    const expected = Math.round(300 * Math.pow(1.4, 4))
    expect(getEnemyHpForWave('tank', 5)).toBe(expected)
  })

  it('grunt wave 10 HP is much higher than wave 1', () => {
    const wave1Hp = getEnemyHpForWave('grunt', 1)
    const wave10Hp = getEnemyHpForWave('grunt', 10)
    expect(wave10Hp).toBeGreaterThan(wave1Hp * 10)
  })

  it('colossus always returns getBossHp() regardless of wave', () => {
    const bossHp = getBossHp()
    expect(getEnemyHpForWave('colossus', 1)).toBe(bossHp)
    expect(getEnemyHpForWave('colossus', 5)).toBe(bossHp)
    expect(getEnemyHpForWave('colossus', 10)).toBe(bossHp)
  })

  it('unknown type falls back to grunt base HP (80) at wave 1', () => {
    expect(getEnemyHpForWave('unknown', 1)).toBe(80)
  })

  it('HP strictly increases each wave for grunt', () => {
    for (let wave = 1; wave < 10; wave++) {
      expect(getEnemyHpForWave('grunt', wave + 1)).toBeGreaterThan(getEnemyHpForWave('grunt', wave))
    }
  })

  it('higher wave enemies are harder: wave 10 grunt has more HP than wave 1 tank', () => {
    // Ensures scaling makes later-wave weak units genuinely dangerous
    expect(getEnemyHpForWave('grunt', 10)).toBeGreaterThan(getEnemyHpForWave('tank', 1))
  })
})
