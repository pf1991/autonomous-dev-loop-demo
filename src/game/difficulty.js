/**
 * difficulty.js — Pure functions for difficulty configuration.
 * No side effects, no React imports.
 */

/**
 * All supported difficulty modes.
 */
export const DIFFICULTY_MODES = ['easy', 'normal', 'hard', 'nightmare']

/**
 * getDifficultyConfig returns the modifier object for a given difficulty mode.
 *
 * Modifier object shape:
 *   startingGold   — gold the player begins with
 *   startingLives  — lives the player begins with
 *   enemyHpMult    — multiplier applied to all enemy HP values
 *   enemySpeedMult — multiplier applied to all enemy speed values
 *   goldPerKillMult— multiplier applied to all gold earned from kills
 *   scoreMultiplier— multiplier applied to the final computed score
 *   label          — display name
 *   flavour        — short flavour text shown in the selector UI
 *   color          — CSS colour used for the HUD difficulty pill
 *
 * @param {'easy'|'normal'|'hard'|'nightmare'} mode
 * @returns {{ startingGold: number, startingLives: number, enemyHpMult: number, enemySpeedMult: number, goldPerKillMult: number, scoreMultiplier: number, label: string, flavour: string, color: string }}
 */
export function getDifficultyConfig(mode) {
  switch (mode) {
    case 'easy':
      return {
        startingGold: 150,
        startingLives: 30,
        enemyHpMult: 0.7,
        enemySpeedMult: 0.85,
        goldPerKillMult: 1.3,
        scoreMultiplier: 0.5,
        label: 'Easy',
        flavour: 'Sit back and enjoy the show.',
        color: '#4ecca3',
      }
    case 'normal':
      return {
        startingGold: 100,
        startingLives: 20,
        enemyHpMult: 1.0,
        enemySpeedMult: 1.0,
        goldPerKillMult: 1.0,
        scoreMultiplier: 1.0,
        label: 'Normal',
        flavour: 'The classic experience.',
        color: '#e0e0e0',
      }
    case 'hard':
      return {
        startingGold: 75,
        startingLives: 15,
        enemyHpMult: 1.3,
        enemySpeedMult: 1.2,
        goldPerKillMult: 0.9,
        scoreMultiplier: 1.5,
        label: 'Hard',
        flavour: 'For veterans who want a real fight.',
        color: '#e94560',
      }
    case 'veteran':
      return {
        startingGold: 60,
        startingLives: 12,
        enemyHpMult: 1.5,
        enemySpeedMult: 1.3,
        goldPerKillMult: 0.85,
        scoreMultiplier: 2.0,
        label: 'Veteran',
        flavour: 'Prestige unlocked — prove your mastery.',
        color: '#c084fc',
      }
    case 'nightmare':
      return {
        startingGold: 50,
        startingLives: 10,
        enemyHpMult: 1.8,
        enemySpeedMult: 1.4,
        goldPerKillMult: 0.75,
        scoreMultiplier: 2.5,
        label: 'Nightmare',
        flavour: 'You will not survive.',
        color: '#ff00ff',
      }
    default:
      return getDifficultyConfig('normal')
  }
}

/**
 * applyDifficultyToScore multiplies the raw score by the difficulty's score multiplier.
 *
 * @param {number} rawScore — score before multiplier
 * @param {'easy'|'normal'|'hard'|'nightmare'} mode
 * @returns {number} Final integer score with difficulty multiplier applied
 */
export function applyDifficultyToScore(rawScore, mode) {
  const cfg = getDifficultyConfig(mode)
  return Math.round(rawScore * cfg.scoreMultiplier)
}
