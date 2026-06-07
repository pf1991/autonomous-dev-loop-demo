// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import WaveCountdownBanner from '../../src/components/WaveCountdownBanner.jsx'

let container
let root

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => { root.unmount() })
  document.body.removeChild(container)
  container = null
  root = null
  vi.useRealTimers()
})

describe('WaveCountdownBanner', () => {
  it('renders the wave number and initial countdown of 3', () => {
    act(() => {
      root.render(createElement(WaveCountdownBanner, { wave: 2, onStart: vi.fn() }))
    })
    const text = container.querySelector('.wave-countdown-text').textContent
    expect(text).toContain('Wave 2')
    expect(text).toContain('3')
  })

  it('renders a "Start Now" button', () => {
    act(() => {
      root.render(createElement(WaveCountdownBanner, { wave: 2, onStart: vi.fn() }))
    })
    expect(container.querySelector('.wave-countdown-start-now')).not.toBeNull()
  })

  it('calls onStart immediately when "Start Now" is clicked', () => {
    const onStart = vi.fn()
    act(() => {
      root.render(createElement(WaveCountdownBanner, { wave: 2, onStart }))
    })
    act(() => {
      container.querySelector('.wave-countdown-start-now').click()
    })
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('auto-calls onStart after 3 seconds', () => {
    const onStart = vi.fn()
    act(() => {
      root.render(createElement(WaveCountdownBanner, { wave: 2, onStart }))
    })
    // Advance 3 seconds — one second per countdown step
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('does not call onStart twice if Start Now clicked after auto-start fires', () => {
    const onStart = vi.fn()
    act(() => {
      root.render(createElement(WaveCountdownBanner, { wave: 2, onStart }))
    })
    // Advance through each 1-second step individually so chained timeouts fire
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onStart).toHaveBeenCalledTimes(1)
    // Click after countdown finished — should be a no-op due to firedRef guard
    act(() => {
      const btn = container.querySelector('.wave-countdown-start-now')
      if (btn) btn.click()
    })
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('countdown text decrements after each second', () => {
    act(() => {
      root.render(createElement(WaveCountdownBanner, { wave: 3, onStart: vi.fn() }))
    })
    expect(container.querySelector('.wave-countdown-text').textContent).toContain('3')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(container.querySelector('.wave-countdown-text').textContent).toContain('2')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(container.querySelector('.wave-countdown-text').textContent).toContain('1')
  })
})
