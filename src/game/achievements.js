/**
 * achievements.js — pure game logic for achievement checking.
 * No side effects, no React imports, no localStorage access.
 *
 * Achievement IDs and conditions:
 *   first_blood    — Kill your first enemy
 *   tower_builder  — Place 10 towers in a single run
 *   golden_hoard   — Accumulate 500 gold at once
 *   untouchable    — Complete a wave without losing a life
 *   flawless       — Win the game with all 20 lives intact
 *   speed_demon    — Win a run entirely on 2× speed or faster
 *   combo_king     — Reach a 5× kill combo (RAMPAGE)
 *   sniper_elite   — Deal 1000 total damage with SniperTower
 *   boss_slayer    — Kill your first boss enemy
 *   endless_10     — Reach wave 10 in endless mode
 *   endless_20     — Reach wave 20 in endless mode
 *   synergy_master — Have 3 active synergy pairs simultaneously
 */

/**
 * All 12 achievement definitions (metadata only — no logic here).
 * @type {Array<{ id: string, name: string, description: string }>}
 */
export const ACHIEVEMENTS = [
  { id: 'first_blood',    name: 'First Blood',     description: 'Kill your first enemy' },
  { id: 'tower_builder',  name: 'Tower Builder',   description: 'Place 10 towers in a single run' },
  { id: 'golden_hoard',   name: 'Golden Hoard',    description: 'Accumulate 500 gold at once' },
  { id: 'untouchable',    name: 'Untouchable',     description: 'Complete a wave without losing a life' },
  { id: 'flawless',       name: 'Flawless Victory',description: 'Win the game with all 20 lives intact' },
  { id: 'speed_demon',    name: 'Speed Demon',     description: 'Win a run entirely on 2× speed or faster' },
  { id: 'combo_king',     name: 'Combo King',      description: 'Reach a 5× kill combo (RAMPAGE)' },
  { id: 'sniper_elite',   name: 'Sniper Elite',    description: 'Deal 1000 total damage with SniperTower' },
  { id: 'boss_slayer',    name: 'Boss Slayer',     description: 'Kill your first boss enemy' },
  { id: 'endless_10',     name: 'Into the Abyss',  description: 'Reach wave 10 in endless mode' },
  { id: 'endless_20',     name: 'No End in Sight', description: 'Reach wave 20 in endless mode' },
  { id: 'synergy_master', name: 'Synergy Master',  description: 'Have 3 active synergy pairs simultaneously' },
]

/** Set of all valid achievement IDs for fast lookup */
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map(a => a.id))

/**
 * checkAchievements — pure function that computes which achievements are newly unlocked.
 *
 * @param {object} gameState
 * @param {number}  gameState.totalKills          — cumulative enemy kills this run
 * @param {number}  gameState.totalTowersPlaced   — cumulative towers placed this run
 * @param {number}  gameState.gold                — current gold balance
 * @param {boolean} gameState.waveCompletedClean  — true if the just-completed wave had 0 life losses
 * @param {boolean} gameState.gameWon             — true when game-phase just became 'win'
 * @param {number}  gameState.livesRemaining      — lives when the game was won
 * @param {boolean} gameState.everUsedHighSpeed   — true if speed was ever ≥ 2 during the run
 * @param {boolean} gameState.wonWithLowSpeed     — true if game won and speed never left 1×
 *   (speed_demon requires winning entirely at ≥ 2×, so we track the negative: never used 1×)
 *   Actually per the issue: "win a run entirely on 2× speed or faster"
 *   Implementation: track `speedDroppedToOne` — if false when win happens, award speed_demon
 * @param {boolean} gameState.speedDroppedToOne   — true if speed ever hit 1× during the run
 * @param {number}  gameState.maxComboReached     — highest combo count reached
 * @param {number}  gameState.sniperDamageDealt   — total damage dealt by all SniperTowers
 * @param {boolean} gameState.bossKilledThisTick  — true if a colossus died this tick
 * @param {number}  gameState.wave                — current wave number
 * @param {boolean} gameState.endlessMode         — whether endless mode is active
 * @param {number}  gameState.activeSynergyPairs  — count of active synergy pairs right now
 *
 * @param {string[]} prevUnlocked — IDs already unlocked (will not be returned again)
 * @returns {string[]} Newly unlocked achievement IDs (may be empty)
 */
export function checkAchievements(gameState, prevUnlocked) {
  const alreadyUnlocked = new Set(prevUnlocked)
  const newlyUnlocked = []

  /**
   * Helper: unlock an achievement if it hasn't been unlocked already.
   * @param {string} id
   * @param {boolean} condition
   */
  function maybeUnlock(id, condition) {
    if (condition && !alreadyUnlocked.has(id) && ACHIEVEMENT_IDS.has(id)) {
      newlyUnlocked.push(id)
      alreadyUnlocked.add(id) // prevent duplicates within this call
    }
  }

  const {
    totalKills = 0,
    totalTowersPlaced = 0,
    gold = 0,
    waveCompletedClean = false,
    gameWon = false,
    livesRemaining = 0,
    speedDroppedToOne = true,
    maxComboReached = 0,
    sniperDamageDealt = 0,
    bossKilledThisTick = false,
    wave = 1,
    endlessMode = false,
    activeSynergyPairs = 0,
  } = gameState

  maybeUnlock('first_blood',    totalKills >= 1)
  maybeUnlock('tower_builder',  totalTowersPlaced >= 10)
  maybeUnlock('golden_hoard',   gold >= 500)
  maybeUnlock('untouchable',    waveCompletedClean)
  maybeUnlock('flawless',       gameWon && livesRemaining >= 20)
  // speed_demon: won a run ENTIRELY on 2× speed or faster (never dropped to 1×)
  maybeUnlock('speed_demon',    gameWon && !speedDroppedToOne)
  maybeUnlock('combo_king',     maxComboReached >= 5)
  maybeUnlock('sniper_elite',   sniperDamageDealt >= 1000)
  maybeUnlock('boss_slayer',    bossKilledThisTick)
  maybeUnlock('endless_10',     endlessMode && wave >= 10)
  maybeUnlock('endless_20',     endlessMode && wave >= 20)
  maybeUnlock('synergy_master', activeSynergyPairs >= 3)

  return newlyUnlocked
}
