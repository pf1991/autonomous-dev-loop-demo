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
  it('renders correct message for result="win"', () => {
    act(() => {
      root.render(createElement(GameOver, { result: 'win', onRestart: vi.fn() }))
    })
    expect(container.querySelector('.game-over-message').textContent).toBe('You Win! 🎉')
  })

  it('renders correct message for result="lose"', () => {
    act(() => {
      root.render(createElement(GameOver, { result: 'lose', onRestart: vi.fn() }))
    })
    expect(container.querySelector('.game-over-message').textContent).toBe('Game Over 💀')
  })

  it('calls onRestart when Restart button is clicked', () => {
    const onRestart = vi.fn()
    act(() => {
      root.render(createElement(GameOver, { result: 'lose', onRestart }))
    })
    act(() => {
      container.querySelector('.game-over-restart').click()
    })
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})
