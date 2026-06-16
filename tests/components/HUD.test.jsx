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

  it('renders Next Wave Early button when showNextWave is true (inside burger menu)', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: true, earlyWaveDisabled: false, onNextWaveEarly: vi.fn(),
          onShowSynergiesToggle: vi.fn(), onAchievementClick: vi.fn(),
          initialMenuOpen: true,
        })
      )
    })
    const btn = container.querySelector('.hud-next-wave')
    expect(btn).not.toBeNull()
    expect(btn.disabled).toBe(false)
  })

  it('Next Wave Early button is disabled when earlyWaveDisabled is true (inside burger menu)', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: true, earlyWaveDisabled: true, onNextWaveEarly: vi.fn(),
          onShowSynergiesToggle: vi.fn(), onAchievementClick: vi.fn(),
          initialMenuOpen: true,
        })
      )
    })
    expect(container.querySelector('.hud-next-wave').disabled).toBe(true)
  })

  it('Next Wave Early button calls onNextWaveEarly when clicked (inside burger menu)', () => {
    const onNextWaveEarly = vi.fn()
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 3, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          showNextWave: true, earlyWaveDisabled: false, onNextWaveEarly,
          onShowSynergiesToggle: vi.fn(), onAchievementClick: vi.fn(),
          initialMenuOpen: true,
        })
      )
    })
    act(() => { container.querySelector('.hud-next-wave').click() })
    expect(onNextWaveEarly).toHaveBeenCalledTimes(1)
  })

  it('does not render combo banner when comboVisible is false', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 1, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          comboCount: 3, comboLabel: 'TRIPLE KILL', comboBonus: 5, comboVisible: false,
        })
      )
    })
    expect(container.querySelector('.combo-banner')).toBeNull()
  })

  it('does not render combo banner when comboCount is 1 (no bonus tier)', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 1, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          comboCount: 1, comboLabel: '', comboBonus: 0, comboVisible: true,
        })
      )
    })
    expect(container.querySelector('.combo-banner')).toBeNull()
  })

  it('renders combo banner with correct text for a Triple Kill', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 1, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          comboCount: 3, comboLabel: 'TRIPLE KILL', comboBonus: 5, comboVisible: true,
        })
      )
    })
    const banner = container.querySelector('.combo-banner')
    expect(banner).not.toBeNull()
    expect(banner.textContent).toContain('3×')
    expect(banner.textContent).toContain('TRIPLE KILL')
    expect(banner.textContent).toContain('+5g')
  })

  it('renders combo banner with rampage modifier class at 5+ kills', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 1, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          comboCount: 5, comboLabel: 'RAMPAGE', comboBonus: 20, comboVisible: true,
        })
      )
    })
    const banner = container.querySelector('.combo-banner')
    expect(banner).not.toBeNull()
    expect(banner.classList.contains('combo-banner--rampage')).toBe(true)
    expect(banner.textContent).toContain('RAMPAGE')
    expect(banner.textContent).toContain('+20g')
  })

  it('renders combo banner without rampage class for Quad Kill (4 kills)', () => {
    act(() => {
      root.render(
        createElement(HUD, {
          lives: 20, gold: 100, wave: 1, speed: 1,
          onSpeedToggle: vi.fn(), onRestart: vi.fn(),
          comboCount: 4, comboLabel: 'QUAD KILL', comboBonus: 10, comboVisible: true,
        })
      )
    })
    const banner = container.querySelector('.combo-banner')
    expect(banner).not.toBeNull()
    expect(banner.classList.contains('combo-banner--rampage')).toBe(false)
    expect(banner.textContent).toContain('QUAD KILL')
    expect(banner.textContent).toContain('+10g')
  })
})
