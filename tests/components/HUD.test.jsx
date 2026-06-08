// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import HUD from '../../src/components/HUD.jsx'

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

describe('HUD', () => {
  it('renders correct lives, gold, and wave values from props', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 15,
          gold: 250,
          wave: 3,
          speed: 1,
          onSpeedToggle: vi.fn(),
        })
      )
    })

    expect(container.querySelector('.hud-lives').textContent).toBe('Lives: 15')
    expect(container.querySelector('.hud-gold').textContent).toBe('Gold: 250')
    expect(container.querySelector('.hud-wave').textContent).toBe('Wave: 3')
  })

  it('speed button label updates after each click (1× → 2× → 5× → 1×)', () => {
    const onSpeedToggle = vi.fn()

    act(() => {
      root.render(
        createElement(HUD, { lives: 20, gold: 100, wave: 1, speed: 1, onSpeedToggle })
      )
    })
    expect(container.querySelector('.hud-speed').textContent).toBe('1×')

    // Simulate speed changing to 2 after first click
    act(() => {
      root.render(
        createElement(HUD, { lives: 20, gold: 100, wave: 1, speed: 2, onSpeedToggle })
      )
    })
    expect(container.querySelector('.hud-speed').textContent).toBe('2×')

    // Simulate speed changing to 5 after second click
    act(() => {
      root.render(
        createElement(HUD, { lives: 20, gold: 100, wave: 1, speed: 5, onSpeedToggle })
      )
    })
    expect(container.querySelector('.hud-speed').textContent).toBe('5×')

    // Simulate speed cycling back to 1
    act(() => {
      root.render(
        createElement(HUD, { lives: 20, gold: 100, wave: 1, speed: 1, onSpeedToggle })
      )
    })
    expect(container.querySelector('.hud-speed').textContent).toBe('1×')
  })

  it('onSpeedToggle is called once per click', () => {
    const onSpeedToggle = vi.fn()

    act(() => {
      root.render(
        createElement(HUD, { lives: 20, gold: 100, wave: 1, speed: 1, onSpeedToggle })
      )
    })

    const button = container.querySelector('.hud-speed')

    act(() => { button.click() })
    expect(onSpeedToggle).toHaveBeenCalledTimes(1)

    act(() => { button.click() })
    expect(onSpeedToggle).toHaveBeenCalledTimes(2)
  })

  it('renders a Restart button that calls onRestart when clicked', () => {
    const onRestart = vi.fn()

    act(() => {
      root.render(
        createElement(HUD, { lives: 20, gold: 100, wave: 1, speed: 1, onSpeedToggle: vi.fn(), onRestart })
      )
    })

    const btn = container.querySelector('.hud-restart')
    expect(btn).not.toBeNull()

    act(() => { btn.click() })
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('does not render Next Wave Early button when showNextWave is false', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: false,
        })
      )
    })
    expect(container.querySelector('.hud-next-wave')).toBeNull()
  })

  it('renders Next Wave Early button when showNextWave is true', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: true, earlyWaveDisabled: false, onNextWaveEarly: vi.fn(),
        })
      )
    })
    const btn = container.querySelector('.hud-next-wave')
    expect(btn).not.toBeNull()
    expect(btn.disabled).toBe(false)
  })

  it('Next Wave Early button is disabled when earlyWaveDisabled is true', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: true, earlyWaveDisabled: true, onNextWaveEarly: vi.fn(),
        })
      )
    })
    expect(container.querySelector('.hud-next-wave').disabled).toBe(true)
  })

  it('Next Wave Early button calls onNextWaveEarly when clicked', () => {
    const onNextWaveEarly = vi.fn()
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: true, earlyWaveDisabled: false, onNextWaveEarly,
        })
      )
    })
    act(() => { container.querySelector('.hud-next-wave').click() })
    expect(onNextWaveEarly).toHaveBeenCalledTimes(1)
  })
})
