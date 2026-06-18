// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import HistoryPanel from '../../src/components/HistoryPanel.jsx'

// localStorage mock
let store = {}
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value) },
  removeItem: (key) => { delete store[key] },
  clear: () => { store = {} },
}

let container
let root

beforeEach(() => {
  store = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
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

function seedHistory(entries) {
  store['towerDefense_sessionHistory'] = JSON.stringify(entries)
}

describe('HistoryPanel', () => {
  it('renders the panel title', () => {
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn() }))
    })
    expect(container.querySelector('.history-panel-title').textContent).toBe('Previous Sessions')
  })

  it('shows empty state when no history exists', () => {
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn() }))
    })
    expect(container.querySelector('.history-panel-empty')).not.toBeNull()
    expect(container.querySelector('.history-panel-empty').textContent).toContain('No previous sessions')
  })

  it('renders session rows when history exists', () => {
    seedHistory([
      { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: Date.now() },
      { seed: 2, hash: 'eeff0011', maxWave: 10, score: 2500, difficulty: 'hard', playedAt: Date.now() - 1000 },
    ])
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn() }))
    })
    const rows = container.querySelectorAll('.history-panel-row')
    expect(rows).toHaveLength(2)
  })

  it('displays seed hash in each row', () => {
    seedHistory([
      { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: Date.now() },
    ])
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn() }))
    })
    const hashCell = container.querySelector('.history-panel-cell--hash')
    expect(hashCell.textContent).toContain('aabbccdd')
  })

  it('marks the current session row with a star', () => {
    seedHistory([
      { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: Date.now() },
    ])
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn(), currentHash: 'aabbccdd' }))
    })
    expect(container.querySelector('.history-panel-row--current')).not.toBeNull()
    expect(container.querySelector('.history-panel-current-star')).not.toBeNull()
  })

  it('does not mark row as current when hash differs', () => {
    seedHistory([
      { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: Date.now() },
    ])
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn(), currentHash: '11223344' }))
    })
    expect(container.querySelector('.history-panel-row--current')).toBeNull()
  })

  it('calls onClose when ✕ button is clicked', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(createElement(HistoryPanel, { onClose }))
    })
    act(() => {
      container.querySelector('.history-panel-close').click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(createElement(HistoryPanel, { onClose }))
    })
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('"Play again" button is disabled when no row is selected', () => {
    seedHistory([
      { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: Date.now() },
    ])
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn() }))
    })
    const btn = container.querySelector('.history-panel-play-again')
    expect(btn.disabled).toBe(true)
  })

  it('"Play again" button is enabled after clicking a row', () => {
    seedHistory([
      { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: Date.now() },
    ])
    act(() => {
      root.render(createElement(HistoryPanel, { onClose: vi.fn() }))
    })
    act(() => {
      container.querySelector('.history-panel-row').click()
    })
    const btn = container.querySelector('.history-panel-play-again')
    expect(btn.disabled).toBe(false)
  })
})
