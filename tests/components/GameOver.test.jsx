// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import GameOver from '../../src/components/GameOver.jsx'

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

describe('GameOver', () => {
  it('renders "Game Over" message', () => {
    act(() => {
      root.render(createElement(GameOver, { onRestart: vi.fn() }))
    })
    expect(container.querySelector('.game-over-message').textContent).toBe('Game Over 💀')
  })

  it('renders waves survived count', () => {
    act(() => {
      root.render(createElement(GameOver, { onRestart: vi.fn(), wavesReached: 7 }))
    })
    expect(container.querySelector('.game-over-waves').textContent).toContain('7')
  })

  it('renders "wave" (singular) when wavesReached is 1', () => {
    act(() => {
      root.render(createElement(GameOver, { onRestart: vi.fn(), wavesReached: 1 }))
    })
    expect(container.querySelector('.game-over-waves').textContent).toContain('wave')
    expect(container.querySelector('.game-over-waves').textContent).not.toContain('waves')
  })

  it('renders "waves" (plural) when wavesReached is not 1', () => {
    act(() => {
      root.render(createElement(GameOver, { onRestart: vi.fn(), wavesReached: 5 }))
    })
    expect(container.querySelector('.game-over-waves').textContent).toContain('waves')
  })

  it('calls onRestart when Restart button is clicked', () => {
    const onRestart = vi.fn()
    act(() => {
      root.render(createElement(GameOver, { onRestart }))
    })
    act(() => {
      container.querySelector('.game-over-restart').click()
    })
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('does not show prestige button when wavesReached < 20', () => {
    act(() => {
      root.render(createElement(GameOver, { onRestart: vi.fn(), wavesReached: 15, prestigeStars: 0 }))
    })
    expect(container.querySelector('.prestige-btn')).toBeNull()
  })

  it('shows prestige button when wavesReached >= 20 and stars < 5', () => {
    act(() => {
      root.render(createElement(GameOver, { onRestart: vi.fn(), wavesReached: 20, prestigeStars: 0, onPrestige: vi.fn() }))
    })
    expect(container.querySelector('.prestige-btn')).not.toBeNull()
  })
})
