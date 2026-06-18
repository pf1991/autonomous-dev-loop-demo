import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveSession, loadHistory, clearHistory } from '../../src/utils/sessionHistory.js'

// Minimal localStorage mock
let store = {}
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value) },
  removeItem: (key) => { delete store[key] },
  clear: () => { store = {} },
}

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', localStorageMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sessionHistory', () => {
  describe('loadHistory', () => {
    it('returns an empty array when nothing is stored', () => {
      expect(loadHistory()).toEqual([])
    })

    it('returns stored entries', () => {
      const entry = { seed: 1, hash: 'aabbccdd', maxWave: 5, score: 1000, difficulty: 'normal', playedAt: 1000 }
      store['towerDefense_sessionHistory'] = JSON.stringify([entry])
      expect(loadHistory()).toEqual([entry])
    })

    it('returns empty array on malformed JSON', () => {
      store['towerDefense_sessionHistory'] = 'not-json'
      expect(loadHistory()).toEqual([])
    })
  })

  describe('saveSession', () => {
    it('saves a session entry and returns updated history', () => {
      const entry = { seed: 1, hash: 'aabbccdd', maxWave: 3, score: 500, difficulty: 'normal', playedAt: 1000 }
      const result = saveSession(entry)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(entry)
    })

    it('keeps entries sorted by playedAt descending (most recent first)', () => {
      const old = { seed: 1, hash: 'aaaaaaaa', maxWave: 1, score: 100, difficulty: 'normal', playedAt: 1000 }
      const recent = { seed: 2, hash: 'bbbbbbbb', maxWave: 5, score: 500, difficulty: 'normal', playedAt: 2000 }
      saveSession(old)
      const result = saveSession(recent)
      expect(result[0].hash).toBe('bbbbbbbb')
      expect(result[1].hash).toBe('aaaaaaaa')
    })

    it('caps history at 20 entries, dropping the oldest', () => {
      // Fill with 20 old entries
      for (let i = 0; i < 20; i++) {
        saveSession({ seed: i, hash: `entry${i.toString().padStart(2, '0')}aaaa`, maxWave: i, score: i * 10, difficulty: 'normal', playedAt: i })
      }
      // Add one more (newest)
      const newest = { seed: 99, hash: 'newest00', maxWave: 99, score: 9999, difficulty: 'hard', playedAt: 9999 }
      const result = saveSession(newest)
      expect(result).toHaveLength(20)
      expect(result[0].hash).toBe('newest00')
      // The entry with playedAt=0 (oldest) should be dropped
      expect(result.find(e => e.playedAt === 0)).toBeUndefined()
    })

    it('persists to localStorage', () => {
      const entry = { seed: 1, hash: 'aabbccdd', maxWave: 3, score: 500, difficulty: 'normal', playedAt: 1000 }
      saveSession(entry)
      const stored = JSON.parse(store['towerDefense_sessionHistory'])
      expect(stored).toHaveLength(1)
      expect(stored[0].hash).toBe('aabbccdd')
    })
  })

  describe('clearHistory', () => {
    it('removes all entries and returns empty array', () => {
      saveSession({ seed: 1, hash: 'aabbccdd', maxWave: 3, score: 500, difficulty: 'normal', playedAt: 1000 })
      const result = clearHistory()
      expect(result).toEqual([])
      expect(loadHistory()).toEqual([])
    })
  })
})
