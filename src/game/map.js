/**
 * map.js — pure game logic for tile map creation
 * No side effects, no React imports.
 */

const ROWS = 15
const COLS = 20

/**
 * createDefaultMap returns a 15×20 2D array of tile-type strings.
 * Tile types: 'path' | 'grass' | 'tower-slot'
 *
 * The map contains an L-shaped enemy path of at least 12 path tiles
 * forming a corner. All non-path tiles are either 'grass' or 'tower-slot'.
 * Tower slots are placed adjacent to the path for strategic placement.
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
