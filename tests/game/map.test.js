import { describe, it, expect } from 'vitest'
import { createDefaultMap, getPathWaypoints, generateMap } from '../../src/game/map.js'

describe('createDefaultMap', () => {
  it('returns 15 rows', () => {
    const map = createDefaultMap()
    expect(map).toHaveLength(15)
  })

  it('returns 20 cols in every row', () => {
    const map = createDefaultMap()
    for (const row of map) {
      expect(row).toHaveLength(20)
    }
  })

  it('path tiles form a connected sequence of at least 12 tiles', () => {
    const map = createDefaultMap()

    // Collect all path tile coordinates
    const pathTiles = []
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === 'path') {
          pathTiles.push([r, c])
        }
      }
    }

    expect(pathTiles.length).toBeGreaterThanOrEqual(12)

    // BFS/flood-fill to verify all path tiles are connected
    const visited = new Set()
    const key = (r, c) => `${r},${c}`
    const pathSet = new Set(pathTiles.map(([r, c]) => key(r, c)))

    const queue = [pathTiles[0]]
    visited.add(key(pathTiles[0][0], pathTiles[0][1]))

    while (queue.length > 0) {
      const [r, c] = queue.shift()
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr
        const nc = c + dc
        const nk = key(nr, nc)
        if (pathSet.has(nk) && !visited.has(nk)) {
          visited.add(nk)
          queue.push([nr, nc])
        }
      }
    }

    expect(visited.size).toBe(pathTiles.length)
  })

  it('only contains valid tile types', () => {
    const map = createDefaultMap()
    const validTypes = new Set(['path', 'grass', 'tower-slot'])
    for (const row of map) {
      for (const tile of row) {
        expect(validTypes.has(tile)).toBe(true)
      }
    }
  })
})

describe('getPathWaypoints', () => {
  it('returns at least 2 waypoints', () => {
    const waypoints = getPathWaypoints()
    expect(waypoints.length).toBeGreaterThanOrEqual(2)
  })

  it('every waypoint has numeric row and col properties', () => {
    const waypoints = getPathWaypoints()
    for (const wp of waypoints) {
      expect(typeof wp.row).toBe('number')
      expect(typeof wp.col).toBe('number')
    }
  })

  it('first waypoint lies on the path, last waypoint lies on the path', () => {
    const map = createDefaultMap()
    const waypoints = getPathWaypoints()
    const first = waypoints[0]
    const last = waypoints[waypoints.length - 1]
    expect(map[first.row][first.col]).toBe('path')
    expect(map[last.row][last.col]).toBe('path')
  })
})

describe('generateMap', () => {
  // Use a fixed seed so tests are deterministic
  const SEED = 0xdeadbeef

  it('returns tiles, waypoints, entryPoint, and exitPoint', () => {
    const result = generateMap(SEED)
    expect(result).toHaveProperty('tiles')
    expect(result).toHaveProperty('waypoints')
    expect(result).toHaveProperty('entryPoint')
    expect(result).toHaveProperty('exitPoint')
  })

  it('tiles are a 15-row × 20-col grid', () => {
    const { tiles } = generateMap(SEED)
    expect(tiles).toHaveLength(15)
    for (const row of tiles) {
      expect(row).toHaveLength(20)
    }
  })

  it('only contains valid tile types', () => {
    const { tiles } = generateMap(SEED)
    const validTypes = new Set(['path', 'grass', 'tower-slot'])
    for (const row of tiles) {
      for (const tile of row) {
        expect(validTypes.has(tile)).toBe(true)
      }
    }
  })

  it('path is connected', () => {
    const { tiles } = generateMap(SEED)
    const pathTiles = []
    for (let r = 0; r < tiles.length; r++) {
      for (let c = 0; c < tiles[r].length; c++) {
        if (tiles[r][c] === 'path') pathTiles.push([r, c])
      }
    }
    expect(pathTiles.length).toBeGreaterThanOrEqual(25)

    const visited = new Set()
    const key = (r, c) => `${r},${c}`
    const pathSet = new Set(pathTiles.map(([r, c]) => key(r, c)))
    const queue = [pathTiles[0]]
    visited.add(key(pathTiles[0][0], pathTiles[0][1]))
    while (queue.length > 0) {
      const [r, c] = queue.shift()
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nk = key(r + dr, c + dc)
        if (pathSet.has(nk) && !visited.has(nk)) {
          visited.add(nk)
          queue.push([r + dr, c + dc])
        }
      }
    }
    expect(visited.size).toBe(pathTiles.length)
  })

  it('has at least 15 tower-slot tiles', () => {
    const { tiles } = generateMap(SEED)
    let slotCount = 0
    for (const row of tiles) {
      for (const tile of row) {
        if (tile === 'tower-slot') slotCount++
      }
    }
    expect(slotCount).toBeGreaterThanOrEqual(15)
  })

  it('same seed produces the same map (deterministic)', () => {
    const result1 = generateMap(SEED)
    const result2 = generateMap(SEED)
    expect(result1.tiles).toEqual(result2.tiles)
    expect(result1.waypoints).toEqual(result2.waypoints)
  })

  it('different seeds produce different maps', () => {
    const result1 = generateMap(1)
    const result2 = generateMap(2)
    // It is astronomically unlikely that two different seeds produce identical maps
    expect(result1.tiles).not.toEqual(result2.tiles)
  })

  it('waypoints contain valid row/col positions on path tiles', () => {
    const { tiles, waypoints } = generateMap(SEED)
    expect(waypoints.length).toBeGreaterThanOrEqual(2)
    for (const wp of waypoints) {
      expect(typeof wp.row).toBe('number')
      expect(typeof wp.col).toBe('number')
      expect(tiles[wp.row][wp.col]).toBe('path')
    }
  })

  it('entryPoint is on the left edge and on a path tile', () => {
    const { tiles, entryPoint } = generateMap(SEED)
    expect(entryPoint.col).toBe(0)
    expect(tiles[entryPoint.row][entryPoint.col]).toBe('path')
  })

  it('exitPoint is on the right edge and on a path tile', () => {
    const { tiles, exitPoint } = generateMap(SEED)
    expect(exitPoint.col).toBe(19)
    expect(tiles[exitPoint.row][exitPoint.col]).toBe('path')
  })
})
