// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import GameBoard from '../../src/components/GameBoard.jsx'
import { createDefaultMap } from '../../src/game/map.js'
import { createTower, canUpgrade, getUpgradeCost } from '../../src/game/tower.js'

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

  it('calls onTileClick with correct (row, col) when an empty tile is clicked', () => {
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

  it('calls onTowerClick (not onTileClick) when a tile with a tower is clicked', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const onTowerClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, onTowerClick, towers })
      )
    })

    const tileDivs = container.querySelectorAll('.tile')
    const targetTile = tileDivs[3 * 20 + 7]

    act(() => {
      targetTile.click()
    })

    expect(onTowerClick).toHaveBeenCalledWith(3, 7)
    expect(onTileClick).not.toHaveBeenCalled()
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

  it('renders .upgrade-panel when selectedTower matches a tower tile', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const onTowerClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]
    const selectedTower = { row: 3, col: 7 }

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, {
          tiles,
          onTileClick,
          onTowerClick,
          towers,
          selectedTower,
          gold: 200,
          onUpgrade: vi.fn(),
          getUpgradeCost,
          canUpgrade,
        })
      )
    })

    const panel = container.querySelector('.upgrade-panel')
    expect(panel).not.toBeNull()
  })

  it('does not render .upgrade-panel when no tower is selected', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, selectedTower: null })
      )
    })

    const panel = container.querySelector('.upgrade-panel')
    expect(panel).toBeNull()
  })

  it('renders a .projectile SVG line for each projectile in the projectiles prop', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const projectiles = [
      { id: 'p1', fromRow: 1, fromCol: 1, toRow: 2, toCol: 3 },
      { id: 'p2', fromRow: 3, fromCol: 2, toRow: 4, toCol: 5 },
    ]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, projectiles })
      )
    })

    const lines = container.querySelectorAll('.projectile')
    expect(lines.length).toBe(2)
  })

  it('renders no projectile SVG when projectiles prop is empty', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, projectiles: [] })
      )
    })

    const lines = container.querySelectorAll('.projectile')
    expect(lines.length).toBe(0)
  })

  it('upgrade button is disabled when player cannot afford upgrade', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]
    const selectedTower = { row: 3, col: 7 }

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, {
          tiles,
          onTileClick,
          towers,
          selectedTower,
          gold: 0, // cannot afford
          onUpgrade: vi.fn(),
          getUpgradeCost,
          canUpgrade,
        })
      )
    })

    const btn = container.querySelector('.upgrade-panel-btn')
    expect(btn).not.toBeNull()
    expect(btn.disabled).toBe(true)
  })
})
