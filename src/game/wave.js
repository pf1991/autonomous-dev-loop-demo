/**
 * wave.js — pure game logic for wave spawning.
 * No side effects, no React imports.
 */

/**
 * isBossWave returns true when the given wave number is a boss wave (multiple of 5).
 * @param {number} waveNumber - 1-based wave number
 * @returns {boolean}
 */
export function isBossWave(waveNumber) {
  return waveNumber % 5 === 0
}

/**
 * getWaveEnemyHp returns the HP for enemies in the given wave.
 * Formula: Math.round(100 * 1.4^(wave - 1))
 * wave 1: 100, wave 5: 384, wave 10: 2064
 *
 * Exponential growth ensures enemies remain a genuine threat even against
 * fully-upgraded towers; the old linear formula (+25/wave) was trivially
 * outpaced by tower DPS upgrades.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} HP value
 */
export function getWaveEnemyHp(waveNumber) {
  return Math.round(100 * Math.pow(1.4, waveNumber - 1))
}

/**
 * getWaveEnemyCount returns the number of enemies to spawn in the given wave.
 * Formula: 5 + (wave - 1)
 * wave 1: 5, wave 3: 7, wave 5: 9, wave 9: 13
 *
 * One additional enemy per wave (previously only one extra every two waves)
 * so the total enemy count scales meaningfully alongside HP growth.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} Enemy count
 */
export function getWaveEnemyCount(waveNumber) {
  return 5 + (waveNumber - 1)
}

/**
 * getWaveComposition returns the mix of enemy types for the given wave.
 *
 * Wave composition rules:
 *   Waves 1–2:  Grunts only
 *   Wave  3:    70% Grunts, 30% Speeders  (introduces speeders)
 *   Wave  4:    50% Grunts, 30% Speeders, 20% Tanks
 *   Wave  5:    40% Grunts, 25% Speeders, 20% Tanks, 15% Splitters  (introduces splitters)
 *   Wave  6:    25% Grunts, 25% Speeders, 20% Tanks, 15% Splitters, 15% Healers  (introduces healers)
 *   Wave  7:    15% Grunts, 20% Speeders, 15% Tanks, 15% Armored, 20% Phantoms, 15% Shielded (introduces phantoms, shielded)
 *   Waves 8–10: 10% Grunts, 15% Speeders, 15% Tanks, 15% Armored, 15% Phantoms, 10% Splitters, 10% Healers, 10% Shielded
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {Array<{ type: string, count: number }>}
 */
export function getWaveComposition(waveNumber) {
  const total = getWaveEnemyCount(waveNumber)

  function distribute(fractions) {
    // fractions: array of [type, fraction] pairs; last entry absorbs rounding
    const entries = fractions.filter(([, f]) => f > 0)
    const result = []
    let remaining = total
    for (let i = 0; i < entries.length - 1; i++) {
      const [type, frac] = entries[i]
      const count = Math.round(total * frac)
      if (count > 0) result.push({ type, count })
      remaining -= count
    }
    const [lastType] = entries[entries.length - 1]
    if (remaining > 0) result.push({ type: lastType, count: remaining })
    return result
  }

  // For boss waves, build regular enemies then append the single colossus
  const bossEntry = isBossWave(waveNumber) ? [{ type: 'colossus', count: 1 }] : []

  if (waveNumber <= 2) {
    return [{ type: 'grunt', count: total }, ...bossEntry]
  }

  if (waveNumber === 3) {
    return [...distribute([['grunt', 0.7], ['speeder', 0.3]]), ...bossEntry]
  }

  if (waveNumber === 4) {
    return [...distribute([['grunt', 0.5], ['speeder', 0.3], ['tank', 0.2]]), ...bossEntry]
  }

  if (waveNumber === 5) {
    // Introduces splitters
    return [...distribute([['grunt', 0.4], ['speeder', 0.25], ['tank', 0.2], ['splitter', 0.15]]), ...bossEntry]
  }

  if (waveNumber === 6) {
    // Introduces healers; armored enemies also appear from wave 6 (pre-existing rule)
    return [...distribute([['grunt', 0.2], ['speeder', 0.2], ['tank', 0.15], ['armored', 0.2], ['splitter', 0.1], ['healer', 0.15]]), ...bossEntry]
  }

  if (waveNumber === 7) {
    // Introduces phantoms and shielded
    return [...distribute([['grunt', 0.15], ['speeder', 0.2], ['tank', 0.15], ['armored', 0.15], ['phantom', 0.2], ['shielded', 0.15]]), ...bossEntry]
  }

  // Waves 8–10: full mix
  return [...distribute([['grunt', 0.1], ['speeder', 0.15], ['tank', 0.15], ['armored', 0.15], ['phantom', 0.15], ['splitter', 0.1], ['healer', 0.1], ['shielded', 0.1]]), ...bossEntry]
}

/**
 * createWave creates a wave descriptor for the given wave number.
 * @param {number} waveNumber - 1-based wave number
 * @returns {{ enemies: Array, spawnInterval: number, totalEnemies: number, enemyHp: number }}
 */
export function createWave(waveNumber) {
  return {
    enemies: [],
    spawnInterval: 500,
    totalEnemies: getWaveEnemyCount(waveNumber),
    enemyHp: getWaveEnemyHp(waveNumber),
  }
}

/**
 * getEndlessWaveEnemyHp returns the HP for enemies in an endless-mode wave.
 *
 * Waves 1–10 use the standard formula.
 * Wave 11+: starts at wave-10 HP (2064) and scales by ×1.15 per wave beyond 10.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} HP value (integer)
 */
export function getEndlessWaveEnemyHp(waveNumber) {
  if (waveNumber <= 10) return getWaveEnemyHp(waveNumber)
  const base = getWaveEnemyHp(10) // 2064 with exponential formula
  return Math.round(base * Math.pow(1.15, waveNumber - 10))
}

/**
 * getEndlessWaveEnemyCount returns the number of enemies in an endless-mode wave.
 *
 * Waves 1–10 use the standard formula.
 * Wave 11+: starts at wave-10 count (14) and adds 1 per 2 extra waves.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {number} Enemy count
 */
export function getEndlessWaveEnemyCount(waveNumber) {
  if (waveNumber <= 10) return getWaveEnemyCount(waveNumber)
  const base = getWaveEnemyCount(10) // 14 with the new per-wave formula
  return base + Math.floor((waveNumber - 10) / 2)
}

/**
 * getEndlessWaveComposition returns the enemy mix for an endless-mode wave.
 *
 * Waves 1–10: use standard composition.
 * Wave 11–15: 10% Grunts, 15% Speeders, 15% Tanks, 30% Armored, 30% Phantoms.
 * Wave 16+:   5% Grunts, 15% Speeders, 10% Tanks, 35% Armored, 35% Phantoms.
 *
 * @param {number} waveNumber - 1-based wave number
 * @returns {Array<{ type: string, count: number }>}
 */
export function getEndlessWaveComposition(waveNumber) {
  if (waveNumber <= 10) return getWaveComposition(waveNumber)

  const total = getEndlessWaveEnemyCount(waveNumber)

  function distribute(fractions) {
    const entries = fractions.filter(([, f]) => f > 0)
    const result = []
    let remaining = total
    for (let i = 0; i < entries.length - 1; i++) {
      const [type, frac] = entries[i]
      const count = Math.round(total * frac)
      if (count > 0) result.push({ type, count })
      remaining -= count
    }
    const [lastType] = entries[entries.length - 1]
    if (remaining > 0) result.push({ type: lastType, count: remaining })
    return result
  }

  const bossEntry = isBossWave(waveNumber) ? [{ type: 'colossus', count: 1 }] : []

  if (waveNumber <= 15) {
    return [...distribute([['grunt', 0.1], ['speeder', 0.15], ['tank', 0.15], ['armored', 0.3], ['phantom', 0.3]]), ...bossEntry]
  }

  return [...distribute([['grunt', 0.05], ['speeder', 0.15], ['tank', 0.1], ['armored', 0.35], ['phantom', 0.35]]), ...bossEntry]
}

/**
 * getWaveEventType returns the special event type for a given wave.
 *
 * Rules:
 *   - Waves 1–3: always 'normal'
 *   - Waves 4+: 20% chance of a special event ('horde', 'elite', or 'stealth')
 *               distributed evenly (~6.67% each); 80% chance of 'normal'
 *
 * Uses a seeded LCG (linear congruential generator) so that the same
 * waveNumber + seed always produces the same result (deterministic replays).
 *
 * @param {number} waveNumber - 1-based wave number
 * @param {number} [seed=12345] - Optional seed for determinism
 * @returns {'normal'|'horde'|'elite'|'stealth'}
 */
export function getWaveEventType(waveNumber, seed = 12345) {
  if (waveNumber < 4) return 'normal'

  // Mulberry32 hash: mix seed and waveNumber into a 32-bit value, then map to [0,1).
  // Using Math.imul for safe 32-bit integer multiplication in all JS environments.
  let a = (seed * 1000 + waveNumber) | 0
  a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296  // 0 ≤ rand < 1

  if (rand < 0.8) return 'normal'
  if (rand < 0.8667) return 'horde'
  if (rand < 0.9333) return 'elite'
  return 'stealth'
}

/**
 * WAVE_EVENT_CONFIG holds display metadata and spawn modifiers for each event type.
 */
export const WAVE_EVENT_CONFIG = {
  normal: {
    label: null,
    goldMultiplier: 1,
    countMultiplier: 1,
    hpMultiplier: 1,
    speedMultiplier: 1,
    forceType: null,
  },
  horde: {
    label: '⚡ HORDE WAVE — Brace yourself!',
    color: 'orange',
    goldMultiplier: 1.2,
    countMultiplier: 2.5,
    hpMultiplier: 1,
    speedMultiplier: 1,
    forceType: 'grunt',
  },
  elite: {
    label: '💀 ELITE WAVE — Hardened enemies incoming',
    color: 'red',
    goldMultiplier: 1.5,
    countMultiplier: 1,
    hpMultiplier: 1.5,
    speedMultiplier: 1.25,
    forceType: null,
  },
  stealth: {
    label: '👁 STEALTH WAVE — You can\'t see them... but they\'re there',
    color: 'purple',
    goldMultiplier: 1,
    countMultiplier: 1,
    hpMultiplier: 1,
    speedMultiplier: 1,
    forceType: null,
    stealthDurationMs: 5000,
  },
}

/**
 * ENEMY_DISPLAY_INFO maps each enemy type to a human-readable label and emoji
 * used by WavePreviewPanel.  Kept here (not in a React component) so it stays
 * in the pure-game layer alongside the composition functions.
 */
export const ENEMY_DISPLAY_INFO = {
  grunt:    { label: 'Grunts',    icon: '👾' },
  speeder:  { label: 'Speeders',  icon: '💨' },
  tank:     { label: 'Tanks',     icon: '🛡' },
  armored:  { label: 'Armored',   icon: '🔩' },
  splitter: { label: 'Splitters', icon: '🔀' },
  healer:   { label: 'Healers',   icon: '💚' },
  phantom:  { label: 'Phantoms',  icon: '👻' },
  shielded: { label: 'Shielded',  icon: '🛡️' },
  colossus: { label: 'BOSS',      icon: '💀' },
}

/**
 * WAVE_TIPS is a static lookup table indexed by composition flags.
 * Keys are checked in order; first match wins.
 *
 * Flags:
 *   hasColossus  — wave has a boss enemy
 *   hasHealer    — wave has healers
 *   hasTank      — wave has tanks or armored enemies
 *   isGruntHeavy — >50% of non-boss enemies are grunts or speeders
 */
export const WAVE_TIPS = [
  { flag: 'hasColossus',  message: 'Boss drops a power crate — keep lives spare.' },
  { flag: 'hasHealer',    message: 'Kill the healer first!' },
  { flag: 'hasTank',      message: 'Tanks absorb heavy damage — use Snipers.' },
  { flag: 'isGruntHeavy', message: 'Fast enemies! Prioritize fire rate.' },
  { flag: 'default',      message: 'Spread towers across the path.' },
]

/**
 * getWavePreview returns a preview descriptor for the upcoming wave.
 *
 * @param {number} waveNumber - 1-based upcoming wave number
 * @param {boolean} [endlessMode=false] - whether endless mode is active
 * @returns {{ enemies: Array<{ type: string, count: number, hp: number }>, isBoss: boolean, tip: string }}
 */
export function getWavePreview(waveNumber, endlessMode = false) {
  const composition = endlessMode
    ? getEndlessWaveComposition(waveNumber)
    : getWaveComposition(waveNumber)

  const hp = endlessMode
    ? getEndlessWaveEnemyHp(waveNumber)
    : getWaveEnemyHp(waveNumber)

  const boss = isBossWave(waveNumber)

  const enemies = composition.map(({ type, count }) => ({
    type,
    count,
    hp: type === 'colossus' ? Math.round(hp * 3) : hp,
  }))

  // Determine tip based on composition flags (first match wins)
  const hasColossus  = composition.some(e => e.type === 'colossus')
  const hasHealer    = composition.some(e => e.type === 'healer')
  const hasTank      = composition.some(e => e.type === 'tank' || e.type === 'armored')
  const totalNonBoss = composition.filter(e => e.type !== 'colossus').reduce((s, e) => s + e.count, 0)
  const gruntCount   = composition
    .filter(e => e.type === 'grunt' || e.type === 'speeder')
    .reduce((s, e) => s + e.count, 0)
  const isGruntHeavy = totalNonBoss > 0 && gruntCount / totalNonBoss > 0.5

  const flags = { hasColossus, hasHealer, hasTank, isGruntHeavy }
  const tipEntry = WAVE_TIPS.find(t => t.flag === 'default' || flags[t.flag])
  const tip = tipEntry ? tipEntry.message : ''

  return { enemies, isBoss: boss, tip }
}

/**
 * getEarlyWaveBonus returns the gold-per-kill multiplier granted when the player
 * calls the next wave early.
 *
 * Formula: 1 + (earlierWaveNumber / (currentWaveNumber + earlierWaveNumber))
 *   where earlierWaveNumber = how many waves early the player called it (≥ 1)
 *         currentWaveNumber = the wave number currently being played (≥ 1)
 *
 * @param {number} earlierWaveNumber - Waves called ahead of schedule (≥ 1)
 * @param {number} currentWaveNumber - The wave number that was active when early was called (≥ 1)
 * @returns {number} Multiplier ≥ 1.0
 */
export function getEarlyWaveBonus(earlierWaveNumber, currentWaveNumber) {
  return 1 + earlierWaveNumber / (currentWaveNumber + earlierWaveNumber)
}
