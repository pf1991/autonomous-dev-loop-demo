// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import NextWave from '../../src/components/NextWave.jsx'

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

describe('NextWave', () => {
  it('renders correct wave number', () => {
    act(() => {
      root.render(createElement(NextWave, { wave: 3, onStart: vi.fn() }))
    })
    expect(container.querySelector('.next-wave-message').textContent).toBe('Wave 3 incoming')
  })

  it('renders correct wave number for wave 1', () => {
    act(() => {
      root.render(createElement(NextWave, { wave: 1, onStart: vi.fn() }))
    })
    expect(container.querySelector('.next-wave-message').textContent).toBe('Wave 1 incoming')
  })

  it('calls onStart when Start button is clicked', () => {
    const onStart = vi.fn()
    act(() => {
      root.render(createElement(NextWave, { wave: 1, onStart }))
    })
    act(() => {
      container.querySelector('.next-wave-start').click()
    })
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('does not render an endless mode toggle', () => {
    act(() => {
      root.render(createElement(NextWave, { wave: 1, onStart: vi.fn() }))
    })
    expect(container.querySelector('.endless-mode-toggle')).toBeNull()
    expect(container.querySelector('.endless-mode-checkbox')).toBeNull()
  })
})
