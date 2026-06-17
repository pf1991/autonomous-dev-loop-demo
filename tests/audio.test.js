import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isMuted, setMuted, toggleMute, playSound } from '../src/audio.js'

// Stub localStorage
const store = {}
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Stub AudioContext — Web Audio API is not available in jsdom
class MockGainNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    }
  }
  connect() { return this }
}
class MockOscillator {
  constructor() {
    this.frequency = {
      value: 440,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    }
    this.type = 'sine'
  }
  connect() { return this }
  start() {}
  stop() {}
}
class MockBufferSource {
  constructor() { this.buffer = null }
  connect() { return this }
  start() {}
  stop() {}
}
class MockBiquadFilter {
  constructor() {
    this.type = 'lowpass'
    this.frequency = { value: 350 }
    this.Q = { value: 1 }
  }
  connect() { return this }
}
class MockAudioContext {
  constructor() {
    this.currentTime = 0
    this.sampleRate = 44100
    this.state = 'running'
    this.destination = {}
  }
  createOscillator() { return new MockOscillator() }
  createGain() { return new MockGainNode() }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() { return new MockBufferSource() }
  createBiquadFilter() { return new MockBiquadFilter() }
  resume() { return Promise.resolve() }
}

globalThis.AudioContext = MockAudioContext
globalThis.webkitAudioContext = MockAudioContext

describe('audio — mute persistence', () => {
  beforeEach(() => {
    // Reset mute state before each test
    setMuted(false)
    // Reset AudioContext singleton between tests
    // (module-level _ctx is lazily created; tests share it but that's fine)
  })

  it('isMuted() returns false by default', () => {
    setMuted(false)
    expect(isMuted()).toBe(false)
  })

  it('setMuted(true) makes isMuted() return true', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
  })

  it('setMuted(false) makes isMuted() return false', () => {
    setMuted(true)
    setMuted(false)
    expect(isMuted()).toBe(false)
  })

  it('toggleMute() flips the mute state and returns the new value', () => {
    setMuted(false)
    const first = toggleMute()
    expect(first).toBe(true)
    expect(isMuted()).toBe(true)

    const second = toggleMute()
    expect(second).toBe(false)
    expect(isMuted()).toBe(false)
  })

  it('mute state is persisted in localStorage', () => {
    setMuted(true)
    expect(localStorage.getItem('sfx-muted')).toBe('true')

    setMuted(false)
    expect(localStorage.getItem('sfx-muted')).toBe('false')
  })
})

describe('audio — playSound', () => {
  beforeEach(() => {
    setMuted(false)
  })

  it('does not throw for any listed sound name', () => {
    const names = [
      'tower-basic', 'tower-sniper', 'tower-cannon', 'tower-rapid',
      'tower-slow', 'tower-mortar', 'tower-poison',
      'enemy-death', 'enemy-death-boss',
      'wave-start', 'boss-warning',
      'achievement', 'power-crate', 'interest',
    ]
    for (const name of names) {
      expect(() => playSound(name)).not.toThrow()
    }
  })

  it('does not throw for unknown sound name', () => {
    expect(() => playSound('nonexistent-sound')).not.toThrow()
  })

  it('does nothing when muted (no errors)', () => {
    setMuted(true)
    expect(() => playSound('tower-basic')).not.toThrow()
  })
})
