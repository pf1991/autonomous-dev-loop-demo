import { describe, it, expect } from 'vitest'
import { createDefaultMap, getPathWaypoints } from '../../src/game/map.js'

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
