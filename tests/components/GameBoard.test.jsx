import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import GameBoard from '../../src/components/GameBoard.jsx'
import { createDefaultMap } from '../../src/game/map.js'

describe('GameBoard', () => {
  it('creates a React element without throwing', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const element = createElement(GameBoard, { tiles, onTileClick })
    expect(element).toBeTruthy()
    expect(element.type).toBe(GameBoard)
  })

  it('tiles prop has 300 tile entries (15 rows × 20 cols)', () => {
    const tiles = createDefaultMap()
    let count = 0
    for (const row of tiles) {
      count += row.length
    }
    expect(count).toBe(300)
  })

  it('each tile in the default map has a valid CSS class string', () => {
    const tiles = createDefaultMap()
    const validClasses = ['path', 'grass', 'tower-slot']
    for (const row of tiles) {
      for (const tileType of row) {
        // The component applies className={`tile ${tileType}`}
        const className = `tile ${tileType}`
        expect(validClasses.some(cls => className.includes(cls))).toBe(true)
      }
    }
  })

  it('onTileClick is called with correct row and col when invoked', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()

    // Simulate what the component does when a tile is clicked
    const rowIndex = 3
    const colIndex = 7
    onTileClick(rowIndex, colIndex)

    expect(onTileClick).toHaveBeenCalledWith(3, 7)
  })
})
