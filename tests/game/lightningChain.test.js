import { describe, it, expect } from 'vitest'
import { getChainTargets, TOWER_TYPES, createTower } from '../../src/game/tower'

/**
 * Helper to build a minimal enemy object with id and position.
 */
function mkEnemy(id, row, col) {
  return { id, pos: { row, col } }
}

describe('TOWER_TYPES.LightningTower', () => {
  it('exists in TOWER_TYPES', () => {
    expect(TOWER_TYPES.LightningTower).toBeDefined()
  })

  it('has required fields: cost, range, damage, fireRate', () => {
    const lt = TOWER_TYPES.LightningTower
    expect(typeof lt.cost).toBe('number')
    expect(typeof lt.range).toBe('number')
    expect(typeof lt.damage).toBe('number')
    expect(typeof lt.fireRate).toBe('number')
  })

  it('has chainRadius and maxChains', () => {
    const lt = TOWER_TYPES.LightningTower
    expect(typeof lt.chainRadius).toBe('number')
    expect(lt.chainRadius).toBeGreaterThan(0)
    expect(typeof lt.maxChains).toBe('number')
    expect(lt.maxChains).toBeGreaterThan(0)
  })

  it('has at least 1 upgrade level', () => {
    expect(Array.isArray(TOWER_TYPES.LightningTower.upgrades)).toBe(true)
    expect(TOWER_TYPES.LightningTower.upgrades.length).toBeGreaterThan(0)
  })

  it('createTower carries chainRadius and maxChains from type definition', () => {
    const tower = createTower('LightningTower', 5, 5)
    expect(tower.chainRadius).toBe(TOWER_TYPES.LightningTower.chainRadius)
    expect(tower.maxChains).toBe(TOWER_TYPES.LightningTower.maxChains)
  })
})

describe('getChainTargets', () => {
  it('returns empty array when no other enemies exist', () => {
    const primary = mkEnemy('a', 5, 5)
    const result = getChainTargets(primary, [primary], 3, 3)
    expect(result).toEqual([])
  })

  it('returns empty array when no enemies are within chainRadius', () => {
    const primary = mkEnemy('a', 5, 5)
    // Far enemy — 10 tiles away
    const far = mkEnemy('b', 5, 15)
    const result = getChainTargets(primary, [primary, far], 2.5, 3)
    expect(result).toEqual([])
  })

  it('chains to the nearest enemy within chainRadius and stops when none reachable', () => {
    const primary = mkEnemy('a', 5, 5)
    const near = mkEnemy('b', 5, 7)   // distance 2 from primary — within radius 2.5
    const far  = mkEnemy('c', 5, 11)  // distance 4 from near — outside radius 2.5
    const result = getChainTargets(primary, [primary, near, far], 2.5, 3)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('does not return the primary target in the chain', () => {
    const primary = mkEnemy('a', 5, 5)
    const near = mkEnemy('b', 5, 6)
    const result = getChainTargets(primary, [primary, near], 3, 3)
    const ids = result.map(e => e.id)
    expect(ids).not.toContain('a')
  })

  it('does not chain to the same enemy twice', () => {
    const primary = mkEnemy('a', 5, 5)
    const near = mkEnemy('b', 5, 6) // 1 tile away
    // Only one chain-able enemy — should not chain back to primary or re-pick near
    const result = getChainTargets(primary, [primary, near], 3, 3)
    const ids = result.map(e => e.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
    expect(ids).not.toContain('a')
  })

  it('respects maxChains — returns at most maxChains targets', () => {
    const primary = mkEnemy('a', 0, 0)
    // 5 enemies clustered nearby
    const others = ['b', 'c', 'd', 'e', 'f'].map((id, i) => mkEnemy(id, 0, i + 1))
    const result = getChainTargets(primary, [primary, ...others], 2, 3)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('chains hop-by-hop — each hop starts from the previous target position', () => {
    // Line of enemies: primary at col 0, then b at col 2, then c at col 4
    // Each is within chainRadius=2.5 of the next; c is NOT within 2.5 of the primary directly
    const primary = mkEnemy('a', 0, 0)
    const b = mkEnemy('b', 0, 2)
    const c = mkEnemy('c', 0, 4)
    const result = getChainTargets(primary, [primary, b, c], 2.5, 3)
    expect(result.map(e => e.id)).toEqual(['b', 'c'])
  })

  it('returns empty when maxChains is 0', () => {
    const primary = mkEnemy('a', 5, 5)
    const near = mkEnemy('b', 5, 6)
    const result = getChainTargets(primary, [primary, near], 3, 0)
    expect(result).toEqual([])
  })

  it('picks closest enemy at each hop', () => {
    const primary = mkEnemy('a', 5, 5)
    const close  = mkEnemy('b', 5, 6) // distance 1
    const medium = mkEnemy('c', 5, 7) // distance 2
    // Only 1 hop allowed
    const result = getChainTargets(primary, [primary, close, medium], 3, 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })
})
