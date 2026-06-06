import { describe, it, expect } from 'vitest'
import { createEnemy, moveEnemy } from '../../src/game/enemy.js'

const WAYPOINTS = [
  { row: 0, col: 0 },
  { row: 0, col: 5 },
  { row: 5, col: 5 },
]

describe('createEnemy', () => {
  it('creates an enemy with default stats at the first waypoint', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    expect(enemy.id).toBe('e1')
    expect(enemy.hp).toBe(100)
    expect(enemy.maxHp).toBe(100)
    expect(enemy.waypointIndex).toBe(0)
    expect(enemy.speed).toBe(2)
    expect(enemy.pos).toEqual({ row: 0, col: 0 })
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
    // speed=2 tiles/sec; 500ms → 1 tile of movement along col axis
    const result = moveEnemy(enemy, 500, WAYPOINTS)
    expect(result).not.toBeNull()
    // Should have moved right (increasing col)
    expect(result.pos.col).toBeGreaterThan(0)
    expect(result.pos.row).toBeCloseTo(0)
  })

  it('enemy reaches and advances past a waypoint correctly', () => {
    const enemy = createEnemy('e1', WAYPOINTS)
    // 5 cols to next waypoint at speed 2 tiles/sec → 2500ms to reach exactly
    const result = moveEnemy(enemy, 2500, WAYPOINTS)
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
