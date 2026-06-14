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

  it('projectile line gets a type-specific class for a SniperTower base-level projectile', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const projectiles = [
      { id: 'p1', fromRow: 1, fromCol: 1, toRow: 2, toCol: 3, towerType: 'SniperTower', upgradeLevel: 0 },
    ]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, projectiles })
      )
    })

    const line = container.querySelector('.projectile')
    expect(line).not.toBeNull()
    expect(line.classList.contains('projectile-sniper')).toBe(true)
    expect(line.classList.contains('projectile-sniper-lv1')).toBe(false)
  })

  it('projectile line gets a level-1 class for a level-1 tower projectile', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const projectiles = [
      { id: 'p1', fromRow: 1, fromCol: 1, toRow: 2, toCol: 3, towerType: 'BasicTower', upgradeLevel: 1 },
    ]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, projectiles })
      )
    })

    const line = container.querySelector('.projectile')
    expect(line).not.toBeNull()
    expect(line.classList.contains('projectile-basic-lv1')).toBe(true)
  })

  it('projectile line gets a level-2 class for a level-2 tower projectile', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const projectiles = [
      { id: 'p1', fromRow: 1, fromCol: 1, toRow: 2, toCol: 3, towerType: 'CannonTower', upgradeLevel: 2 },
    ]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, projectiles })
      )
    })

    const line = container.querySelector('.projectile')
    expect(line).not.toBeNull()
    expect(line.classList.contains('projectile-cannon-lv2')).toBe(true)
  })

  it('renders .fire-radius-ring SVG circle when a placed tower is selected', () => {
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
          gold: 200,
          onUpgrade: vi.fn(),
          getUpgradeCost,
          canUpgrade,
        })
      )
    })

    const ring = container.querySelector('.fire-radius-ring')
    expect(ring).not.toBeNull()
  })

  it('does not render .fire-radius-ring when no tower is selected', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, selectedTower: null })
      )
    })

    const ring = container.querySelector('.fire-radius-ring')
    expect(ring).toBeNull()
  })

  it('calls onDeselect when clicking a non-tower tile', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const onDeselect = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, onDeselect, towers })
      )
    })

    // Click a tile that has no tower (row=0, col=0 is a path tile)
    const tileDivs = container.querySelectorAll('.tile')
    const emptyTile = tileDivs[0]

    act(() => {
      emptyTile.click()
    })

    expect(onDeselect).toHaveBeenCalledTimes(1)
  })

  it('does not call onDeselect when clicking a tower tile', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const onTowerClick = vi.fn()
    const onDeselect = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, onTowerClick, onDeselect, towers })
      )
    })

    // Click the tower tile at row=3, col=7
    const tileDivs = container.querySelectorAll('.tile')
    const towerTile = tileDivs[3 * 20 + 7]

    act(() => {
      towerTile.click()
    })

    expect(onDeselect).not.toHaveBeenCalled()
    expect(onTowerClick).toHaveBeenCalledWith(3, 7)
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

  it('does not render .tower-kill-badge when tower has kills === 0', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = { ...createTower('BasicTower', 3, 7), kills: 0 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick, towers }))
    })

    const badge = container.querySelector('.tower-kill-badge')
    expect(badge).toBeNull()
  })

  it('renders .tower-kill-badge when tower.kills >= 1', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = { ...createTower('BasicTower', 3, 7), kills: 1 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick, towers }))
    })

    const badge = container.querySelector('.tower-kill-badge')
    expect(badge).not.toBeNull()
  })

  it('kill badge has grey tier class when kills is 1-9', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = { ...createTower('BasicTower', 3, 7), kills: 5 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick, towers }))
    })

    const badge = container.querySelector('.tower-kill-badge')
    expect(badge).not.toBeNull()
    expect(badge.classList.contains('tower-kill-badge--grey')).toBe(true)
  })

  it('kill badge has green tier class when kills is 10-24', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = { ...createTower('BasicTower', 3, 7), kills: 15 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick, towers }))
    })

    const badge = container.querySelector('.tower-kill-badge')
    expect(badge).not.toBeNull()
    expect(badge.classList.contains('tower-kill-badge--green')).toBe(true)
  })

  it('kill badge has blue tier class when kills is 25-49', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = { ...createTower('BasicTower', 3, 7), kills: 30 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick, towers }))
    })

    const badge = container.querySelector('.tower-kill-badge')
    expect(badge).not.toBeNull()
    expect(badge.classList.contains('tower-kill-badge--blue')).toBe(true)
  })

  it('kill badge has gold tier class when kills is 50+', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = { ...createTower('BasicTower', 3, 7), kills: 55 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(createElement(GameBoard, { tiles, onTileClick, towers }))
    })

    const badge = container.querySelector('.tower-kill-badge')
    expect(badge).not.toBeNull()
    expect(badge.classList.contains('tower-kill-badge--gold')).toBe(true)
  })

  it('renders .tower-cooldown-bar for each placed tower', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, nowMs: 1000 })
      )
    })

    const bar = container.querySelector('.tower-cooldown-bar')
    expect(bar).not.toBeNull()
  })

  it('cooldown bar has the type-specific colour class for BasicTower', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = createTower('BasicTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, nowMs: 1000 })
      )
    })

    const bar = container.querySelector('.tower-cooldown-bar')
    expect(bar.classList.contains('tower-cooldown-bar--basic')).toBe(true)
  })

  it('cooldown bar has the type-specific colour class for SniperTower', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    const tower = createTower('SniperTower', 3, 7)
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, nowMs: 1000 })
      )
    })

    const bar = container.querySelector('.tower-cooldown-bar')
    expect(bar.classList.contains('tower-cooldown-bar--sniper')).toBe(true)
  })

  it('cooldown bar shows idle class when nowMs is far past lastFiredAt (bar full)', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    // lastFiredAt=0, nowMs=5000 — well past the fire interval (1000ms for BasicTower)
    const tower = { ...createTower('BasicTower', 3, 7), lastFiredAt: 0 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, nowMs: 5000 })
      )
    })

    const bar = container.querySelector('.tower-cooldown-bar')
    expect(bar).not.toBeNull()
    expect(bar.classList.contains('tower-cooldown-bar--idle')).toBe(true)
  })

  it('cooldown bar does not have idle class when tower just fired (fraction < 1)', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    // BasicTower fireRate=1 => interval=1000ms; lastFiredAt=4900, nowMs=5000 => fraction=0.1
    const tower = { ...createTower('BasicTower', 3, 7), lastFiredAt: 4900 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, nowMs: 5000 })
      )
    })

    const bar = container.querySelector('.tower-cooldown-bar')
    expect(bar).not.toBeNull()
    expect(bar.classList.contains('tower-cooldown-bar--idle')).toBe(false)
  })

  it('cooldown bar width reflects fraction of fire interval elapsed', () => {
    const tiles = createDefaultMap()
    const onTileClick = vi.fn()
    // BasicTower fireRate=1 => interval=1000ms; lastFiredAt=4500, nowMs=5000 => fraction=0.5
    const tower = { ...createTower('BasicTower', 3, 7), lastFiredAt: 4500 }
    const towers = [tower]

    act(() => {
      createRoot(container).render(
        createElement(GameBoard, { tiles, onTileClick, towers, nowMs: 5000 })
      )
    })

    const bar = container.querySelector('.tower-cooldown-bar')
    expect(bar).not.toBeNull()
    // 50% fraction × 80% max-width = 40%
    expect(bar.style.width).toBe('40%')
  })
})
