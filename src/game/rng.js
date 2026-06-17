/**
 * rng.js — seeded pseudo-random number generator (pure game logic)
 * No side effects, no React imports.
 *
 * Uses a Mulberry32 LCG that produces deterministic float sequences
 * from a 32-bit integer seed.
 */

/**
 * makeRng creates a seeded PRNG function.
 * Each call to the returned function advances the internal state and
 * returns a float in [0, 1).
 *
 * @param {number} seed - 32-bit integer seed
 * @returns {() => number} - function returning a float in [0, 1)
 */
export function makeRng(seed) {
  let s = seed >>> 0  // ensure 32-bit unsigned integer

  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * seedFromHex parses an 8-character hex string into a 32-bit integer.
 * Returns null if the string is not a valid 8-character hex value.
 *
 * @param {string} hex - 8-character hexadecimal string
 * @returns {number|null}
 */
export function seedFromHex(hex) {
  if (!/^[0-9a-fA-F]{8}$/.test(hex)) return null
  return parseInt(hex, 16)
}

/**
 * seedToHex converts a 32-bit integer seed to an 8-character lowercase hex string.
 *
 * @param {number} seed - 32-bit integer
 * @returns {string} - 8-character hex string
 */
export function seedToHex(seed) {
  return ((seed >>> 0).toString(16)).padStart(8, '0')
}

