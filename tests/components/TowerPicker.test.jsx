// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import TowerPicker from '../../src/components/TowerPicker.jsx'
import { TOWER_TYPES } from '../../src/game/tower'

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => { root.unmount() })
  document.body.removeChild(container)
  container = null
  root = null
})

describe('TowerPicker', () => {
  it('renders a button for every tower type', () => {
    act(() => {
      root.render(
        createElement(TowerPicker, {
          selectedType: 'BasicTower',
          gold: 200,
          onSelect: vi.fn(),
        })
      )
    })
    const buttons = container.querySelectorAll('.tower-picker button')
    expect(buttons.length).toBe(Object.keys(TOWER_TYPES).length)
  })

  it('highlights the selected tower type with class "selected"', () => {
    act(() => {
      root.render(
        createElement(TowerPicker, {
          selectedType: 'SniperTower',
          gold: 200,
          onSelect: vi.fn(),
        })
      )
    })
    const buttons = container.querySelectorAll('.tower-picker button')
    const names = Array.from(buttons).map(b => b.querySelector('.tower-picker-name').textContent)
    const sniperIndex = names.indexOf('SniperTower')
    expect(sniperIndex).toBeGreaterThanOrEqual(0)
    expect(buttons[sniperIndex].classList.contains('selected')).toBe(true)
  })

  it('does not add "selected" class to non-selected types', () => {
    act(() => {
      root.render(
        createElement(TowerPicker, {
          selectedType: 'BasicTower',
          gold: 200,
          onSelect: vi.fn(),
        })
      )
    })
    const buttons = container.querySelectorAll('.tower-picker button')
    const names = Array.from(buttons).map(b => b.querySelector('.tower-picker-name').textContent)
    const sniperIndex = names.indexOf('SniperTower')
    expect(buttons[sniperIndex].classList.contains('selected')).toBe(false)
  })

  it('disables buttons for tower types the player cannot afford', () => {
    act(() => {
      root.render(
        createElement(TowerPicker, {
          selectedType: 'BasicTower',
          gold: 50, // can afford BasicTower (50) but not SniperTower (100)
          onSelect: vi.fn(),
        })
      )
    })
    const buttons = container.querySelectorAll('.tower-picker button')
    const names = Array.from(buttons).map(b => b.querySelector('.tower-picker-name').textContent)
    const basicIndex = names.indexOf('BasicTower')
    const sniperIndex = names.indexOf('SniperTower')
    expect(buttons[basicIndex].disabled).toBe(false)
    expect(buttons[sniperIndex].disabled).toBe(true)
  })

  it('does not disable buttons the player can afford', () => {
    act(() => {
      root.render(
        createElement(TowerPicker, {
          selectedType: 'BasicTower',
          gold: 200,
          onSelect: vi.fn(),
        })
      )
    })
    const buttons = container.querySelectorAll('.tower-picker button')
    for (const btn of buttons) {
      expect(btn.disabled).toBe(false)
    }
  })

  it('calls onSelect with the tower type when a button is clicked', () => {
    const onSelect = vi.fn()
    act(() => {
      root.render(
        createElement(TowerPicker, {
          selectedType: 'BasicTower',
          gold: 200,
          onSelect,
        })
      )
    })
    const buttons = container.querySelectorAll('.tower-picker button')
    const names = Array.from(buttons).map(b => b.querySelector('.tower-picker-name').textContent)
    const sniperIndex = names.indexOf('SniperTower')
    act(() => { buttons[sniperIndex].click() })
    expect(onSelect).toHaveBeenCalledWith('SniperTower')
  })
})
