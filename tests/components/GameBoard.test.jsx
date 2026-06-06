// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import GameBoard from '../../src/components/GameBoard.jsx'
import { createDefaultMap } from '../../src/game/map.js'

let container

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('GameBoard', () => {
  it('renders 300 tiles total', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick }))
    })

    const tileDivs = container.querySelectorAll('.tile')
    expect(tileDivs.length).toBe(300)
  })

  it('applies correct CSS class per tile type', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick }))
    })

    const tileDivs = container.querySelectorAll('.tile')
    const validTypes = ['path', 'grass', 'tower-slot']

    tileDivs.forEach(div => {
      const hasValid = validTypes.some(type => div.classList.contains(type))
      expect(hasValid).toBe(true)
    })
  })

  it('calls onTileClick with correct (row, col) when a tile is clicked', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick }))
    })

    // Click the tile at row=3, col=7 (index = 3*20 + 7 = 67)
    const tileDivs = container.querySelectorAll('.tile')
    const targetTile = tileDivs[3 * 20 + 7]

    act(() => {
      targetTile.click()
    })

    expect(onTileClick).toHaveBeenCalledWith(3, 7)
    expect(onTileClick).toHaveBeenCalledTimes(1)
  })

  it('renders one .enemy div when one enemy is passed with a matching tile position', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const enemies = [
      { id: 1, pos: { row: 2, col: 3 }, hp: 80, maxHp: 100 }
    ]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, enemies })
      )
    })

    const enemyDivs = container.querySelectorAll('.enemy')
    expect(enemyDivs.length).toBe(1)
  })

  it('.enemy-hp-bar width reflects hp/maxHp ratio', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const enemies = [
      { id: 1, pos: { row: 2, col: 3 }, hp: 50, maxHp: 100 }
    ]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, enemies })
      )
    })

    const hpBar = container.querySelector('.enemy-hp-bar')
    expect(hpBar).not.toBeNull()
    // width style should be '50%'
    expect(hpBar.style.width).toBe('50%')
  })
})
