/**
 * map.js — pure game logic for tile map creation
 * No side effects, no React imports.
 */

import { makeRng } from './rng.js'

const ROWS = 15
const COLS = 20

/**
 * createDefaultMap returns a 15×20 2D array of tile-type strings.
 * Tile types: 'path' | 'grass' | 'tower-slot'
 *
 * The map contains an L-shaped enemy path of at least 12 path tiles
 * forming a corner. All non-path tiles are either 'grass' or 'tower-slot'.
 * Tower slots are placed adjacent to the path for strategic placement.
 *
 * @deprecated Use generateMap(seed) for seeded procedural maps.
 */
export function createDefaultMap() {
  // Initialise everything as grass
  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'grass')
  )

  // L-shaped path definition:
  // Horizontal segment: row 2, cols 1–14  (14 tiles)
  // Vertical segment: row 2–12, col 14     (11 new tiles, corner shared)
  // Total path tiles: 14 + 11 = 25 (well above the required 12, with a clear corner at row 2 col 14)

  // Horizontal leg
  for (let col = 1; col <= 14; col++) {
    grid[2][col] = 'path'
  }

  // Vertical leg (start from row 3 to avoid double-counting the corner)
  for (let row = 3; row <= 12; row++) {
    grid[row][14] = 'path'
  }

  // Tower slots: tiles adjacent to the path (but not on the path itself)
  // Place tower slots above/below the horizontal leg and left/right of the vertical leg
  for (let col = 1; col <= 13; col++) {
    if (grid[1][col] === 'grass') grid[1][col] = 'tower-slot'
    if (grid[3][col] === 'grass') grid[3][col] = 'tower-slot'
  }
  for (let row = 3; row <= 12; row++) {
    if (grid[row][13] === 'grass') grid[row][13] = 'tower-slot'
    if (row < ROWS - 1 && grid[row][15] === 'grass') grid[row][15] = 'tower-slot'
  }

  return grid
}

/**
 * getPathWaypoints returns the ordered waypoints that define the L-shaped enemy path.
 * Matches the path layout created by createDefaultMap().
 * @returns {Array<{row: number, col: number}>}
 */
export function getPathWaypoints() {
  return [
    { row: 2, col: 1 },   // entry point (left side of horizontal leg)
    { row: 2, col: 14 },  // corner (end of horizontal leg / top of vertical leg)
    { row: 12, col: 14 }, // exit point (bottom of vertical leg)
  ]
}

// ─── Seeded procedural map generation ────────────────────────────────────────

const MIN_PATH_LENGTH = 25
const MAX_PATH_LENGTH = 50
const MIN_TOWER_SLOTS = 15

/**
 * generateMap creates a procedurally generated 15×20 tile grid from a seed.
 *
 * Algorithm: random walk from left-edge entry to right-edge exit biased toward
 * horizontal progress. Regenerates if constraints are not met (path length or
 * minimum tower slots).
 *
 * @param {number} seed - 32-bit integer seed
 * @returns {{ tiles: string[][], waypoints: Array<{row:number,col:number}>, entryPoint: {row:number,col:number}, exitPoint: {row:number,col:number} }}
 */
export function generateMap(seed) {
  const rng = makeRng(seed)

  for (let attempt = 0; attempt < 200; attempt++) {
    const result = tryGenerateMap(rng)
    if (result !== null) return result
  }

  // Fallback: return default map wrapped in the new format
  const tiles = createDefaultMap()
  const waypoints = getPathWaypoints()
  return {
    tiles,
    waypoints,
    entryPoint: waypoints[0],
    exitPoint: waypoints[waypoints.length - 1],
  }
}

/**
 * tryGenerateMap performs a single map generation attempt using the provided rng.
 * Returns null if constraints are not satisfied.
 *
 * @param {() => number} rng
 * @returns {{ tiles, waypoints, entryPoint, exitPoint } | null}
 */
function tryGenerateMap(rng) {
  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'grass')
  )

  // Entry: left edge (col 0), random row 1–ROWS-2 (not corners)
  const entryRow = 1 + Math.floor(rng() * (ROWS - 2))
  const entryPoint = { row: entryRow, col: 0 }

  // Exit: right edge (col COLS-1), random row 1–ROWS-2
  const exitRow = 1 + Math.floor(rng() * (ROWS - 2))
  const exitPoint = { row: exitRow, col: COLS - 1 }

  // Random walk from entry to exit
  const pathSet = new Set()
  const pathCoords = []

  const key = (r, c) => `${r},${c}`

  let row = entryRow
  let col = 0
  pathSet.add(key(row, col))
  pathCoords.push({ row, col })

  const MAX_STEPS = MAX_PATH_LENGTH + 20

  for (let step = 0; step < MAX_STEPS; step++) {
    if (row === exitRow && col === COLS - 1) break

    const colsRemaining = (COLS - 1) - col
    const rowDiff = exitRow - row

    // Build list of candidate moves with bias toward horizontal progress
    // Directions: right (+col), up (-row), down (+row)
    const candidates = []

    // Always allow right move if not at right edge
    if (col < COLS - 1) {
      // Bias weight: higher when more columns remain
      const weight = colsRemaining > 5 ? 3 : 2
      candidates.push({ dr: 0, dc: 1, weight })
    }

    // Vertical: allow up/down unless we're at the edge
    if (rowDiff < 0 && row > 1) {
      candidates.push({ dr: -1, dc: 0, weight: 1 })
    }
    if (rowDiff > 0 && row < ROWS - 2) {
      candidates.push({ dr: 1, dc: 0, weight: 1 })
    }
    // If row diff is 0 but we haven't moved right, still allow some vertical wiggle
    if (rowDiff === 0 && col < COLS - 2) {
      if (row > 1) candidates.push({ dr: -1, dc: 0, weight: 1 })
      if (row < ROWS - 2) candidates.push({ dr: 1, dc: 0, weight: 1 })
    }

    if (candidates.length === 0) break

    // Weighted random selection
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0)
    let pick = rng() * totalWeight
    let chosen = candidates[candidates.length - 1]
    for (const c of candidates) {
      pick -= c.weight
      if (pick <= 0) { chosen = c; break }
    }

    const nr = row + chosen.dr
    const nc = col + chosen.dc

    // Reject self-intersections; reject touching the edge except at entry/exit
    if (pathSet.has(key(nr, nc))) continue
    const isEdgeTile = nr === 0 || nr === ROWS - 1 || nc === 0 || nc === COLS - 1
    const isExitTile = nr === exitRow && nc === COLS - 1
    if (isEdgeTile && !isExitTile) continue

    pathSet.add(key(nr, nc))
    pathCoords.push({ row: nr, col: nc })
    row = nr
    col = nc
  }

  // Must end at exit
  if (row !== exitRow || col !== COLS - 1) return null

  const pathLen = pathCoords.length
  if (pathLen < MIN_PATH_LENGTH || pathLen > MAX_PATH_LENGTH) return null

  // Mark path tiles
  for (const { row: r, col: c } of pathCoords) {
    grid[r][c] = 'path'
  }

  // Tower slots: orthogonally adjacent to path, not path/edge
  let slotCount = 0
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (const { row: r, col: c } of pathCoords) {
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      if (grid[nr][nc] === 'grass') {
        grid[nr][nc] = 'tower-slot'
        slotCount++
      }
    }
  }

  if (slotCount < MIN_TOWER_SLOTS) return null

  // Build simplified waypoints: entry, any major direction-change points, exit
  const waypoints = simplifyWaypoints(pathCoords)

  return { tiles: grid, waypoints, entryPoint, exitPoint }
}

/**
 * simplifyWaypoints reduces a dense path coordinate list to key turning points.
 * Keeps first, last, and any tile where the direction changes.
 *
 * @param {Array<{row:number,col:number}>} coords
 * @returns {Array<{row:number,col:number}>}
 */
function simplifyWaypoints(coords) {
  if (coords.length <= 2) return coords
  const result = [coords[0]]
  for (let i = 1; i < coords.length - 1; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const next = coords[i + 1]
    const dr1 = curr.row - prev.row
    const dc1 = curr.col - prev.col
    const dr2 = next.row - curr.row
    const dc2 = next.col - curr.col
    if (dr1 !== dr2 || dc1 !== dc2) {
      result.push(curr)
    }
  }
  result.push(coords[coords.length - 1])
  return result
}
