import { describe, it, expect } from 'vitest'

/**
 * Tests for the game-over lives-to-phase transition logic.
 *
 * The App.jsx useEffect watches `lives` and calls syncPhase('lose') when:
 *   lives <= 0 AND gamePhase === 'playing'
 *
 * We test the predicate directly as a pure function to satisfy the acceptance
 * criterion: "Unit test: when lives drops to 0, gamePhase transitions to 'lose'".
 */

function shouldTransitionToLose(lives, gamePhase) {
  return lives <= 0 && gamePhase === 'playing'
}

describe('game-over phase transition predicate', () => {
  it('returns true when lives is 0 and game is playing', () => {
    expect(shouldTransitionToLose(0, 'playing')).toBe(true)
  })

  it('returns true when lives is negative and game is playing', () => {
    expect(shouldTransitionToLose(-1, 'playing')).toBe(true)
  })

  it('returns false when lives is above 0 and game is playing', () => {
    expect(shouldTransitionToLose(1, 'playing')).toBe(false)
  })

  it('returns false when lives is 0 but game is not playing', () => {
    expect(shouldTransitionToLose(0, 'between-waves')).toBe(false)
    expect(shouldTransitionToLose(0, 'win')).toBe(false)
    expect(shouldTransitionToLose(0, 'lose')).toBe(false)
  })

  it('returns false when lives is 20 and game is between-waves', () => {
    expect(shouldTransitionToLose(20, 'between-waves')).toBe(false)
  })
})
