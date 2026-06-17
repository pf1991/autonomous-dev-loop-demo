import { useState, useCallback, useRef, useEffect } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import GameOver from './components/GameOver'
import NextWave from './components/NextWave'
import TowerPicker from './components/TowerPicker'
import AchievementToast from './components/AchievementToast'
import AchievementModal from './components/AchievementModal'
import DifficultySelector from './components/DifficultySelector'
import WavePreviewPanel from './components/WavePreviewPanel'
import { generateMap } from './game/map'
import { generateSeed, seedFromHex, seedToHex } from './game/rng'
import { TOWER_TYPES, createTower, canAfford, canUpgrade, upgradeTower, getUpgradeCost, getNextUpgradeStats, sellTower, getAdjacentSynergies, getSynergyPartners } from './game/tower'
import { createEnemy, moveEnemy, getEnemyHpForWave, tickHealerAbilities } from './game/enemy'
import { processCombat, processEffectTick } from './game/combat'
import { getWaveEnemyHp, getWaveEnemyCount, getWaveComposition, getEarlyWaveBonus, isBossWave, getWaveEventType, WAVE_EVENT_CONFIG, getWavePreview } from './game/wave'
import { createPowerCrate, selectCrateReward } from './game/powerCrate'
import { useGameLoop } from './hooks/useGameLoop'
import { computeScore, computeComboBonus, getComboLabel, computeInterest } from './game/score'
import { getDifficultyConfig, applyDifficultyToScore, DIFFICULTY_MODES } from './game/difficulty'
import { saveLeaderboardEntry } from './utils/leaderboard'
import { checkAchievements, ACHIEVEMENTS } from './game/achievements'
import { loadUnlockedAchievements, persistNewAchievements } from './utils/achievements'
import { getPrestigeBonus, MAX_PRESTIGE_STARS } from './game/prestige'
import { loadPrestigeStars, savePrestigeStars } from './utils/prestige'

/**
 * readOrCreateSeed reads the level seed from the URL hash (#seed=XXXXXXXX).
 * If absent, generates a new random seed and writes it to the hash.
 * Returns the numeric seed.
 */
function readOrCreateSeed() {
  const match = window.location.hash.match(/[#&]seed=([0-9a-fA-F]{8})/)
  if (match) {
    const parsed = seedFromHex(match[1])
    if (parsed !== null) return parsed
  }
  const fresh = generateSeed()
  window.location.hash = `seed=${seedToHex(fresh)}`
  return fresh
}

const LEVEL_SEED = readOrCreateSeed()
const GENERATED_MAP = generateMap(LEVEL_SEED)
const INITIAL_MAP = GENERATED_MAP.tiles
const PATH_WAYPOINTS = GENERATED_MAP.waypoints
const LEVEL_HASH = seedToHex(LEVEL_SEED)

// Spawn one enemy every 3 seconds (3000 ms)
const SPAWN_INTERVAL_MS = 3000

const INITIAL_GOLD = 100

const INITIAL_STATE = {
  lives: 20,
  gold: INITIAL_GOLD,
  wave: 1,
  towers: [],
  enemies: [],
  speed: 1,
}

function App() {
  // difficultyMode: null = show selector; string = mode chosen for this run
  const [difficultyMode, setDifficultyMode] = useState(null)
  const difficultyModeRef = useRef(null)

  const [gold, setGold] = useState(INITIAL_STATE.gold)
  const [lives, setLives] = useState(INITIAL_STATE.lives)
  const [wave, setWave] = useState(INITIAL_STATE.wave)
  const [speed, setSpeed] = useState(INITIAL_STATE.speed)
  const [towers, setTowers] = useState(INITIAL_STATE.towers)
  const [enemies, setEnemies] = useState(INITIAL_STATE.enemies)
  const [projectiles, setProjectiles] = useState([])
  // Death animations: list of { id, row, col, gold, createdAt } for floating "+N gold" labels
  const [deathAnimations, setDeathAnimations] = useState([])
  const deathAnimationsRef = useRef([])
  // Death burst particles: list of { id, row, col, createdAt } — 4-6 dots expanding radially on enemy death
  const [deathParticles, setDeathParticles] = useState([])
  const deathParticlesRef = useRef([])
  // Floating damage numbers: list of { id, value, row, col, expiresAt } for crit hit labels
  const [damageNumbers, setDamageNumbers] = useState([])
  const damageNumbersRef = useRef([])
  // Poison puff particles: list of { id, row, col, createdAt } — green puff on each poison tick
  const [poisonPuffs, setPoisonPuffs] = useState([])
  const poisonPuffsRef = useRef([])
  // Placement pulses: list of { id, row, col, createdAt } — ripple ring when a tower is placed
  const [placementPulses, setPlacementPulses] = useState([])
  const placementPulsesRef = useRef([])
  // Screen shake: true for 400ms when a Colossus (boss) is killed
  const [screenShakeActive, setScreenShakeActive] = useState(false)
  const [selectedTowerType, setSelectedTowerType] = useState('BasicTower')
  // { row, col } | null — the tower tile currently selected for upgrade
  const [selectedTower, setSelectedTower] = useState(null)
  // { row, col } | null — the empty tower-slot the player is hovering over
  const [hoveredSlot, setHoveredSlot] = useState(null)
  // 'playing' | 'between-waves' | 'lose'
  const [gamePhase, setGamePhase] = useState('between-waves')
  // Score tracking
  const [finalScore, setFinalScore] = useState(null)

  // Power crates dropped by boss enemies on death
  const [powerCrates, setPowerCrates] = useState([])
  const powerCratesRef = useRef([])
  const nextCrateIdRef = useRef(0)
  // Tower overcharge: when active, towers fire at 1.5× rate until overchargeUntilRef passes
  const [overchargeActive, setOverchargeActive] = useState(false)
  const overchargeUntilRef = useRef(0)
  const overchargeActiveRef = useRef(false)

  // Interest timer — real-time (wall-clock), not scaled by speed multiplier.
  // interestRealTimeRef: accumulated real-time ms since last interest payout
  // Interest fires every 10 s of real time, but not in the first 30 s of the game.
  // gameStartRealTimeRef: Date.now() captured when the first wave starts.
  const interestRealTimeRef = useRef(0)
  const gameStartRealTimeRef = useRef(0)
  const lastInterestWallRef = useRef(0) // Date.now() at the previous tick (for delta calculation)
  // interestFlash: { amount, key } | null — triggers a brief "+Xg interest" flash in the HUD
  const [interestFlash, setInterestFlash] = useState(null)
  // interestCountdown: seconds until next interest payout (shown in HUD ticker)
  const [interestCountdown, setInterestCountdown] = useState(10)
  const interestCountdownRef = useRef(10)
  // goldRef: mirror of gold state so the interest timer (real-time) can read it without stale closure
  const goldRef = useRef(INITIAL_STATE.gold)

  // Achievement tracking
  // unlockedAchievements: array of unlocked achievement IDs, loaded from localStorage on mount
  const [unlockedAchievements, setUnlockedAchievements] = useState(() => loadUnlockedAchievements())
  const unlockedAchievementsRef = useRef(loadUnlockedAchievements())
  // Achievement toast notifications: array of { id, name, dismissAt }
  const [achievementToasts, setAchievementToasts] = useState([])
  const achievementToastsRef = useRef([])
  // Achievement modal visibility
  const [achievementModalOpen, setAchievementModalOpen] = useState(false)

  // Prestige system
  // prestigeStars: current star count loaded from localStorage; drives HUD display and run bonuses
  const [prestigeStars, setPrestigeStars] = useState(() => loadPrestigeStars())
  // wavesReachedRef: highest wave completed in the current run (used by Game Over to gate prestige button)
  const wavesReachedRef = useRef(0)
  const [wavesReached, setWavesReached] = useState(0)
  // Per-run tracking refs for achievement conditions
  const totalTowersPlacedRef = useRef(0)
  const maxComboReachedRef = useRef(0)
  const sniperDamageDealtRef = useRef(0)
  const livesAtWaveStartRef = useRef(20)
  const activeSynergyPairsRef = useRef(0)
  // Track whether speed was ever lowered to 1x after being set higher
  // speed_demon: never drop to 1× during the entire run
  // We'll set speedDroppedToOne = false initially and flip to true if speed goes to 1× after being 2×+
  // Actually: initialize as false (didn't drop yet); set true if speed hits 1× while already ≥2×
  // But we need to know if the run started at 2× — simplify: track "was speed ever 1× during the run"
  // speedWasOneRef: if player ever had speed=1 during the run after the run started, disqualify
  const speedWasOneRef = useRef(false)

  // Combo kill-streak tracking
  // comboCount: how many kills in the current 2s window
  // comboWindowExpiry: game-clock ms when the combo window expires (0 = inactive)
  // comboBannerUntil: game-clock ms until the HUD banner should stay visible
  const comboCountRef = useRef(0)
  const comboWindowExpiryRef = useRef(0)
  const comboBannerUntilRef = useRef(0)
  const [comboDisplay, setComboDisplay] = useState({ count: 0, label: '', bonus: 0, visible: false })

  // Adjacency synergies — recomputed whenever towers change
  const [adjacencySynergies, setAdjacencySynergies] = useState(() => new Map())
  const adjacencySynergiesRef = useRef(new Map())
  // Synergy partner positions for visual line rendering — recomputed with towers
  const [synergyPartners, setSynergyPartners] = useState(() => new Map())
  // Global synergy overlay toggle (HUD "Show Synergies" button)
  const [showSynergies, setShowSynergies] = useState(false)

  const nextEnemyIdRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const spawnedInWaveRef = useRef(0)
  const killedInWaveRef = useRef(0)
  // Cumulative run-level score tracking
  const totalKillsRef = useRef(0)
  const totalGoldEarnedRef = useRef(0)
  const wavesCompletedRef = useRef(0)
  // Ordered list of enemy types to spawn this wave (shuffled at wave start)
  const spawnQueueRef = useRef([])
  // Early-wave call: when player presses "Next Wave Early" during a wave,
  // we append the next wave's enemies to spawnQueue and apply a bonus multiplier.
  // earlyWaveCountRef: how many extra waves have been called early this wave (≥ 0)
  // earlyWaveBonusRef: current gold-per-kill multiplier (≥ 1.0)
  // earlyWaveCalledRef: true once player used the early-call button this wave
  // totalEnemiesToSpawnRef: total enemy count to spawn this wave (includes early-called extras)
  const earlyWaveCountRef = useRef(0)
  const earlyWaveBonusRef = useRef(1)
  const earlyWaveCalledRef = useRef(false)
  const totalEnemiesToSpawnRef = useRef(0)
  const [earlyWaveCalled, setEarlyWaveCalled] = useState(false)
  // How many extra waves were called early last round (used to advance wave counter correctly)
  const [pendingWaveAdvance, setPendingWaveAdvance] = useState(0)
  // Special wave event type for the current wave: 'normal' | 'horde' | 'elite' | 'stealth'
  // waveEventSeedRef: seed used for deterministic event generation (randomised once per run)
  const waveEventSeedRef = useRef(Math.floor(Math.random() * 100000))
  const [currentWaveEventType, setCurrentWaveEventType] = useState('normal')
  const currentWaveEventTypeRef = useRef('normal')
  // Separate ref to track the event-type gold multiplier for the current wave.
  // earlyWaveBonusRef tracks the early-call multiplier; the two are composed at gold-award time.
  const eventGoldMultiplierRef = useRef(1)
  // For stealth waves: the game-clock time when enemies should become visible
  const stealthRevealAtRef = useRef(0)
  const livesRef = useRef(INITIAL_STATE.lives)
  const waveRef = useRef(INITIAL_STATE.wave)
  const gamePhaseRef = useRef('between-waves')
  // Mirror towers in a ref so onTick can read latest towers without a stale closure
  const towersRef = useRef(INITIAL_STATE.towers)
  // Mirror enemies in a ref so onTick can read latest state without a functional updater
  const enemiesRef = useRef(INITIAL_STATE.enemies)
  // Mirror projectiles in a ref so onTick can merge/expire them without a functional updater
  const projectilesRef = useRef([])
  // Accumulated game clock (scaled by speed) — used as nowMs for combat
  const gameClockRef = useRef(0)
  const PROJECTILE_LIFETIME_MS = 200

  function syncLives(val) {
    livesRef.current = val
    setLives(val)
  }

  // Achievement checking helper — called each tick with current game state snapshot.
  // Side-effect boundary: persists to localStorage and updates React state.
  function triggerAchievementCheck(snapshot) {
    const newIds = checkAchievements(snapshot, unlockedAchievementsRef.current)
    if (newIds.length === 0) return
    const merged = persistNewAchievements(newIds)
    unlockedAchievementsRef.current = merged
    setUnlockedAchievements(merged)
    // Build toast entries (dismissed after 3s via real-time animation)
    const now = Date.now()
    const newToasts = newIds.map(id => {
      const meta = ACHIEVEMENTS.find(a => a.id === id)
      return { id: `toast-${id}-${now}`, name: meta ? meta.name : id }
    })
    const nextToasts = [...achievementToastsRef.current, ...newToasts]
    achievementToastsRef.current = nextToasts
    setAchievementToasts(nextToasts)
    // Schedule auto-dismiss after 3.2s (a little buffer over the 3s CSS animation)
    setTimeout(() => {
      achievementToastsRef.current = achievementToastsRef.current.filter(
        t => !newToasts.some(nt => nt.id === t.id)
      )
      setAchievementToasts(prev => prev.filter(t => !newToasts.some(nt => nt.id === t.id)))
    }, 3200)
  }

  function syncWave(val) {
    waveRef.current = val
    setWave(val)
  }

  function syncPhase(val) {
    gamePhaseRef.current = val
    setGamePhase(val)
  }

  // Called when the player picks a difficulty from the DifficultySelector overlay.
  function handleSelectDifficulty(mode) {
    const cfg = getDifficultyConfig(mode)
    difficultyModeRef.current = mode
    setDifficultyMode(mode)
    // Apply starting gold and lives — prestige bonuses stack on top of difficulty base values
    const prestige = getPrestigeBonus(loadPrestigeStars())
    setGold(cfg.startingGold + prestige.bonusGold)
    syncLives(cfg.startingLives + prestige.bonusLives)
  }

  // Keep towersRef in sync with towers state so onTick always sees the latest tower list.
  // Also recompute adjacency synergies and synergy partner map whenever the tower list changes.
  useEffect(() => {
    towersRef.current = towers
    const synergies = getAdjacentSynergies(towers)
    adjacencySynergiesRef.current = synergies
    setAdjacencySynergies(synergies)
    setSynergyPartners(getSynergyPartners(towers))
  }, [towers])

  // Mirror gold state into goldRef so the interest real-time interval can read it without
  // a stale closure — the interval callback captures goldRef, not gold.
  useEffect(() => {
    goldRef.current = gold
  }, [gold])

  // Real-time interest ticker — fires independent of speed multiplier.
  // Runs a 250 ms interval while 'playing'; accumulates wall-clock ms and pays
  // interest every 10 000 ms, but only after the first 30 000 ms of the run.
  useEffect(() => {
    if (gamePhase !== 'playing') return

    const INTEREST_INTERVAL_MS = 10000   // 10 real-time seconds
    const WARMUP_MS = 30000              // no interest in first 30 s
    const TICK_MS = 250                  // poll every 250 ms

    lastInterestWallRef.current = Date.now()

    const id = setInterval(() => {
      const now = Date.now()
      const wallDelta = now - lastInterestWallRef.current
      lastInterestWallRef.current = now

      // Only accumulate time after the 30-second warmup has elapsed
      const elapsed = now - gameStartRealTimeRef.current
      if (elapsed < WARMUP_MS) {
        // Still in warmup — snap countdown to remaining warmup + 10s
        const warmupRemaining = WARMUP_MS - elapsed
        const nextPayout = warmupRemaining + INTEREST_INTERVAL_MS
        const secs = Math.ceil(nextPayout / 1000)
        if (secs !== interestCountdownRef.current) {
          interestCountdownRef.current = secs
          setInterestCountdown(secs)
        }
        return
      }

      interestRealTimeRef.current += wallDelta
      const secs = Math.ceil((INTEREST_INTERVAL_MS - interestRealTimeRef.current) / 1000)
      const clampedSecs = Math.max(0, secs)
      if (clampedSecs !== interestCountdownRef.current) {
        interestCountdownRef.current = clampedSecs
        setInterestCountdown(clampedSecs)
      }

      if (interestRealTimeRef.current >= INTEREST_INTERVAL_MS) {
        interestRealTimeRef.current -= INTEREST_INTERVAL_MS
        const prestigeBonus = getPrestigeBonus(loadPrestigeStars())
        const amount = Math.round(computeInterest(goldRef.current) * prestigeBonus.interestRateMult)
        if (amount > 0) {
          setGold(g => g + amount)
          totalGoldEarnedRef.current += amount
          // Trigger flash animation in HUD
          setInterestFlash({ amount, key: now })
          // Auto-clear flash after 1.8s (slightly longer than the 1.5s animation)
          setTimeout(() => setInterestFlash(null), 1800)
          // Reset countdown display
          interestCountdownRef.current = 10
          setInterestCountdown(10)
        }
      }
    }, TICK_MS)

    return () => clearInterval(id)
  }, [gamePhase])

  // Transition to 'lose' when lives hit 0 — scheduled outside setEnemies callback
  useEffect(() => {
    if (lives <= 0 && gamePhase === 'playing') {
      const rawScore = computeScore({
        kills: totalKillsRef.current,
        goldEarned: totalGoldEarnedRef.current,
        livesRemaining: 0,
        wavesCompleted: wavesCompletedRef.current,
      })
      const score = applyDifficultyToScore(rawScore, difficultyMode ?? 'normal')
      const entry = { score, date: new Date().toLocaleDateString(), result: 'lose', difficulty: difficultyMode ?? 'normal' }
      saveLeaderboardEntry(entry)
      setFinalScore(score)
      syncPhase('lose')
    }
  }, [lives, gamePhase, difficultyMode])

  const onTick = useCallback((deltaMs) => {
    if (gamePhaseRef.current !== 'playing') return

    // Advance the game clock (scaled delta already applied by useGameLoop)
    gameClockRef.current += deltaMs
    spawnTimerRef.current += deltaMs

    const currentWaveNum = waveRef.current
    // Total enemies to spawn this wave — set at wave start and extended when early wave is called.
    const enemiesThisWave = totalEnemiesToSpawnRef.current

    let newEnemy = null
    if (
      spawnTimerRef.current >= SPAWN_INTERVAL_MS &&
      spawnedInWaveRef.current < enemiesThisWave
    ) {
      spawnTimerRef.current = 0
      const enemyType = spawnQueueRef.current[spawnedInWaveRef.current] ?? 'grunt'
      // Scale every enemy type's HP by the wave multiplier so later waves are genuinely harder.
      // getEnemyHpForWave returns getBossHp() for 'colossus' and base×1.4^(wave-1) for others.
      let hpOverride = getEnemyHpForWave(enemyType, currentWaveNum)

      // Apply difficulty HP multiplier
      const diffCfg = getDifficultyConfig(difficultyModeRef.current ?? 'normal')
      if (diffCfg.enemyHpMult !== 1 && enemyType !== 'colossus') {
        hpOverride = Math.round(hpOverride * diffCfg.enemyHpMult)
      }

      // Apply elite wave modifiers: +50% HP, +25% speed
      const waveEvtType = currentWaveEventTypeRef.current
      const waveEvtCfg = WAVE_EVENT_CONFIG[waveEvtType] ?? WAVE_EVENT_CONFIG.normal
      if (waveEvtCfg.hpMultiplier !== 1 && enemyType !== 'colossus') {
        hpOverride = Math.round(hpOverride * waveEvtCfg.hpMultiplier)
      }

      newEnemy = createEnemy(nextEnemyIdRef.current++, PATH_WAYPOINTS, enemyType, hpOverride)

      // Apply difficulty speed multiplier
      if (diffCfg.enemySpeedMult !== 1 && enemyType !== 'colossus') {
        newEnemy = { ...newEnemy, speed: newEnemy.speed * diffCfg.enemySpeedMult }
      }

      // Apply elite speed multiplier
      if (waveEvtCfg.speedMultiplier !== 1 && enemyType !== 'colossus') {
        newEnemy = { ...newEnemy, speed: newEnemy.speed * waveEvtCfg.speedMultiplier }
      }

      // Apply stealth: enemies spawn invisible for the first 5 seconds
      if (waveEvtType === 'stealth' && stealthRevealAtRef.current > 0 && gameClockRef.current < stealthRevealAtRef.current) {
        newEnemy = { ...newEnemy, stealth: true }
      }

      spawnedInWaveRef.current += 1
    }

    const nowMs = gameClockRef.current

    // Read current enemies from ref — avoids functional updater side effects that break
    // under React 18 StrictMode (which double-invokes updater functions to detect impurity).
    // Expire any slow debuffs whose duration has elapsed before movement/combat.
    const rawAll = newEnemy ? [...enemiesRef.current, newEnemy] : [...enemiesRef.current]
    const all = rawAll.map(e => {
      // Expire slow debuffs
      let updated = e
      if (updated.slowUntil != null && nowMs >= updated.slowUntil) {
        const { slowUntil, speedMult, ...rest } = updated
        updated = rest
      }
      // Reveal stealth enemies after the stealth window expires
      if (updated.stealth && stealthRevealAtRef.current > 0 && nowMs >= stealthRevealAtRef.current) {
        const { stealth: _stealth, ...rest } = updated
        updated = rest
      }
      return updated
    })
    const surviving = []
    let livesLost = 0
    let killedNow = 0

    for (const enemy of all) {
      const updated = moveEnemy(enemy, deltaMs, PATH_WAYPOINTS)
      if (updated === null) {
        livesLost++
        killedNow++
      } else {
        surviving.push(updated)
      }
    }

    if (livesLost > 0) {
      const newLives = Math.max(0, livesRef.current - livesLost)
      livesRef.current = newLives
      setLives(newLives)
    }

    // Run combat: towers fire at surviving enemies; dead enemies removed; gold awarded
    // When overcharge is active, boost each tower's fireRate by 50% for this tick only
    const combatTowers = overchargeActiveRef.current
      ? towersRef.current.map(t => ({ ...t, fireRate: t.fireRate * 1.5 }))
      : towersRef.current
    const combatResult = processCombat(combatTowers, surviving, nowMs, adjacencySynergiesRef.current)

    // Splitter death: spawn 2 grunts (50% HP, 0 gold) at the splitter's last position
    let afterSplitter = combatResult.enemies
    if (combatResult.splitterSpawns && combatResult.splitterSpawns.length > 0) {
      const spawnedGrunts = []
      for (const spawn of combatResult.splitterSpawns) {
        for (let i = 0; i < 2; i++) {
          const gruntId = `sp-${nextEnemyIdRef.current++}`
          const grunt = {
            ...createEnemy(gruntId, PATH_WAYPOINTS, 'grunt', spawn.hp),
            pos: { row: spawn.row, col: spawn.col },
            waypointIndex: spawn.waypointIndex,
            goldReward: 0,
          }
          spawnedGrunts.push(grunt)
        }
      }
      afterSplitter = [...combatResult.enemies, ...spawnedGrunts]
    }

    // Process DoT effect ticks (poison) — pure function, runs after combat each tick
    const effectResult = processEffectTick(afterSplitter, nowMs)
    // Process healer abilities — healers restore HP to nearby allies every 3s
    const healerResult = tickHealerAbilities(effectResult.enemies, nowMs)
    const afterCombat = healerResult.enemies
    killedNow += surviving.length - combatResult.enemies.length  // killed by towers (includes splitters)
    killedNow += afterSplitter.length - effectResult.enemies.length // killed by DoT

    // Merge killedEnemies from both combat and effect ticks
    const allKilledEnemies = [
      ...(combatResult.killedEnemies ?? []),
      ...(effectResult.killedEnemies ?? []),
    ]

    // Spawn power crate on colossus death
    const bossKilled = allKilledEnemies.filter(k => k.type === 'colossus')
    if (bossKilled.length > 0) {
      const newCrates = bossKilled.map(k =>
        createPowerCrate(`crate-${nextCrateIdRef.current++}`, Math.round(k.row), Math.round(k.col))
      )
      const nextCrates = [...powerCratesRef.current, ...newCrates]
      powerCratesRef.current = nextCrates
      setPowerCrates(nextCrates)
      // Boss death screen shake — apply for 400ms
      setScreenShakeActive(true)
      setTimeout(() => setScreenShakeActive(false), 400)
    }

    // Death burst particles — emit 5 dots per killed enemy, expire after 300ms
    const DEATH_PARTICLE_LIFETIME_MS = 300
    if (allKilledEnemies.length > 0) {
      const newParticles = allKilledEnemies.flatMap((k, ki) =>
        Array.from({ length: 5 }, (_, pi) => ({
          id: `dp-${k.id}-${ki}-${pi}-${nowMs}`,
          row: k.row,
          col: k.col,
          angle: (pi / 5) * Math.PI * 2,
          createdAt: nowMs,
        }))
      )
      const aliveParticles = deathParticlesRef.current.filter(
        p => nowMs - p.createdAt < DEATH_PARTICLE_LIFETIME_MS
      )
      const nextParticles = [...aliveParticles, ...newParticles]
      deathParticlesRef.current = nextParticles
      setDeathParticles(nextParticles)
    } else if (deathParticlesRef.current.length > 0) {
      const aliveParticles = deathParticlesRef.current.filter(
        p => nowMs - p.createdAt < DEATH_PARTICLE_LIFETIME_MS
      )
      if (aliveParticles.length !== deathParticlesRef.current.length) {
        deathParticlesRef.current = aliveParticles
        setDeathParticles(aliveParticles)
      }
    }

    // Poison puff particles — derived from poisonTickHits returned by processEffectTick.
    // Visual particle objects (id, createdAt) are created here in the React layer,
    // keeping animation concerns out of src/game/. Particles expire after 400ms.
    const POISON_PUFF_LIFETIME_MS = 400
    const newPoisonPuffs = (effectResult.poisonTickHits ?? []).map(hit => ({
      id: `pp-${hit.enemyId}-${nowMs}`,
      row: hit.row,
      col: hit.col,
      createdAt: nowMs,
    }))
    if (newPoisonPuffs.length > 0 || poisonPuffsRef.current.length > 0) {
      const alivePuffs = poisonPuffsRef.current.filter(
        p => nowMs - p.createdAt < POISON_PUFF_LIFETIME_MS
      )
      const nextPuffs = [...alivePuffs, ...newPoisonPuffs]
      poisonPuffsRef.current = nextPuffs
      setPoisonPuffs(nextPuffs)
    }

    // Placement pulses — expire after 400ms
    const PULSE_LIFETIME_MS = 400
    if (placementPulsesRef.current.length > 0) {
      const now = Date.now()
      const alivePulses = placementPulsesRef.current.filter(
        p => now - p.createdAt < PULSE_LIFETIME_MS
      )
      if (alivePulses.length !== placementPulsesRef.current.length) {
        placementPulsesRef.current = alivePulses
        setPlacementPulses(alivePulses)
      }
    }

    // Expire overcharge when timer is up
    if (overchargeUntilRef.current > 0 && nowMs >= overchargeUntilRef.current) {
      overchargeUntilRef.current = 0
      overchargeActiveRef.current = false
      setOverchargeActive(false)
    }

    // --- Combo kill-streak tracking ---
    // Process each killed enemy through the combo window
    const COMBO_WINDOW_MS = 2000
    const COMBO_BANNER_DURATION_MS = 1500
    let comboBonusGoldThisTick = 0
    if (allKilledEnemies.length > 0) {
      for (let i = 0; i < allKilledEnemies.length; i++) {
        // Reset combo if window expired before this kill
        if (nowMs > comboWindowExpiryRef.current) {
          comboCountRef.current = 0
        }
        comboCountRef.current += 1
        comboWindowExpiryRef.current = nowMs + COMBO_WINDOW_MS
        const bonus = computeComboBonus(comboCountRef.current)
        comboBonusGoldThisTick += bonus
      }
      // Update the HUD banner for the highest combo count this tick
      const latestCount = comboCountRef.current
      if (latestCount >= 2) {
        comboBannerUntilRef.current = nowMs + COMBO_BANNER_DURATION_MS
        setComboDisplay({
          count: latestCount,
          label: getComboLabel(latestCount),
          bonus: computeComboBonus(latestCount),
          visible: true,
        })
      }
    }
    // Hide banner when it has expired
    if (comboBannerUntilRef.current > 0 && nowMs > comboBannerUntilRef.current) {
      comboBannerUntilRef.current = 0
      setComboDisplay(prev => ({ ...prev, visible: false }))
    }
    // Expire combo window when no kill in last 2s
    if (comboWindowExpiryRef.current > 0 && nowMs > comboWindowExpiryRef.current) {
      comboWindowExpiryRef.current = 0
      comboCountRef.current = 0
    }

    const totalGoldThisTick = combatResult.goldEarned + effectResult.goldEarned
    if (totalGoldThisTick > 0 || comboBonusGoldThisTick > 0) {
      // Compose the early-call multiplier, event-type gold multiplier, and difficulty gold multiplier.
      const diffGoldMult = getDifficultyConfig(difficultyModeRef.current ?? 'normal').goldPerKillMult
      const bonusMultiplier = earlyWaveBonusRef.current * eventGoldMultiplierRef.current * diffGoldMult
      const bonusGold = Math.round(totalGoldThisTick * bonusMultiplier) + comboBonusGoldThisTick
      setGold(g => g + bonusGold)
      totalGoldEarnedRef.current += bonusGold

      // Spawn floating "+N gold" death animations for each killed enemy
      if (allKilledEnemies.length > 0) {
        const newAnims = allKilledEnemies.map(k => ({
          id: `da-${k.id}-${nowMs}`,
          row: k.row,
          col: k.col,
          gold: Math.round(k.gold * bonusMultiplier),
          createdAt: nowMs,
        }))
        const DEATH_ANIM_LIFETIME_MS = 1200
        const aliveAnims = deathAnimationsRef.current.filter(
          a => nowMs - a.createdAt < DEATH_ANIM_LIFETIME_MS
        )
        const nextAnims = [...aliveAnims, ...newAnims]
        deathAnimationsRef.current = nextAnims
        setDeathAnimations(nextAnims)
      }
    } else {
      // Still expire old death animations even when no gold earned this tick
      const DEATH_ANIM_LIFETIME_MS = 1200
      if (deathAnimationsRef.current.length > 0) {
        const aliveAnims = deathAnimationsRef.current.filter(
          a => nowMs - a.createdAt < DEATH_ANIM_LIFETIME_MS
        )
        if (aliveAnims.length !== deathAnimationsRef.current.length) {
          deathAnimationsRef.current = aliveAnims
          setDeathAnimations(aliveAnims)
        }
      }
    }

    // Keep projectiles alive for PROJECTILE_LIFETIME_MS so they are visible to the player
    const aliveProjectiles = projectilesRef.current.filter(
      p => nowMs - p.createdAt < PROJECTILE_LIFETIME_MS
    )
    const nextProjectiles = [...aliveProjectiles, ...combatResult.projectiles]
    projectilesRef.current = nextProjectiles
    setProjectiles(nextProjectiles)

    // Floating crit damage numbers — expire when expiresAt passes (700 ms lifetime)
    const aliveDamageNumbers = damageNumbersRef.current.filter(dn => nowMs < dn.expiresAt)
    const newDamageNumbers = combatResult.damageNumbers ?? []
    if (aliveDamageNumbers.length !== damageNumbersRef.current.length || newDamageNumbers.length > 0) {
      const nextDamageNumbers = [...aliveDamageNumbers, ...newDamageNumbers]
      damageNumbersRef.current = nextDamageNumbers
      setDamageNumbers(nextDamageNumbers)
    }

    // Update towers with new lastFiredAt / kills values when any tower fired.
    // When overcharge was active, combatTowers had a temporary fireRate * 1.5 applied.
    // We must NOT store those inflated values back — only copy lastFiredAt and kills from
    // the combat result onto the original (non-boosted) towers, to prevent fireRate from
    // compounding on every tick while overcharge is active.
    const sourceTowers = overchargeActiveRef.current
      ? towersRef.current.map((t, i) => ({
          ...t,
          lastFiredAt: combatResult.towers[i]?.lastFiredAt ?? t.lastFiredAt,
          kills: combatResult.towers[i]?.kills ?? t.kills,
        }))
      : combatResult.towers
    const anyFired = sourceTowers.some(
      (t, i) => t.lastFiredAt !== towersRef.current[i]?.lastFiredAt
    )
    if (anyFired) {
      towersRef.current = sourceTowers
      setTowers(sourceTowers)
    } else if (towersRef.current.length > 0) {
      towersRef.current = sourceTowers
    }

    killedInWaveRef.current += killedNow
    totalKillsRef.current += killedNow

    // Track per-achievement metrics
    // Update max combo reached
    if (comboCountRef.current > maxComboReachedRef.current) {
      maxComboReachedRef.current = comboCountRef.current
    }
    // Track sniper damage from this tick: sum damage of SniperTowers that fired this tick
    const sniperDamageThisTick = combatResult.towers
      .filter(t => t.type === 'SniperTower' && t.lastFiredAt === nowMs)
      .reduce((sum, t) => sum + (t.damage ?? 0), 0)
    sniperDamageDealtRef.current += sniperDamageThisTick
    // Track active synergy pairs
    activeSynergyPairsRef.current = adjacencySynergiesRef.current.size

    // Check achievements each tick when kills happen or relevant state changes
    const bossKilledThisTick = allKilledEnemies.some(k => k.type === 'colossus')
    if (killedNow > 0 || bossKilledThisTick || sniperDamageThisTick > 0) {
      const currentGold = gold  // NOTE: gold state is read from closure; good enough for threshold checks
      triggerAchievementCheck({
        totalKills: totalKillsRef.current,
        totalTowersPlaced: totalTowersPlacedRef.current,
        gold: currentGold,
        waveCompletedClean: false,
        gameWon: false,
        livesRemaining: livesRef.current,
        speedDroppedToOne: speedWasOneRef.current,
        maxComboReached: maxComboReachedRef.current,
        sniperDamageDealt: sniperDamageDealtRef.current,
        bossKilledThisTick,
        wave: currentWaveNum,
        endlessMode: true,
        activeSynergyPairs: activeSynergyPairsRef.current,
      })
    }

    enemiesRef.current = afterCombat
    setEnemies(afterCombat)

    // Check wave completion: all enemies spawned and none remaining
    if (
      spawnedInWaveRef.current >= enemiesThisWave &&
      afterCombat.length === 0 &&
      gamePhaseRef.current === 'playing' &&
      livesRef.current > 0
    ) {
      // When early wave was called we effectively completed an extra wave
      const wavesJustCompleted = 1 + earlyWaveCountRef.current
      wavesCompletedRef.current += wavesJustCompleted

      // Achievement: untouchable — completed wave with no life losses
      const waveWasClean = livesRef.current >= livesAtWaveStartRef.current
      triggerAchievementCheck({
        totalKills: totalKillsRef.current,
        totalTowersPlaced: totalTowersPlacedRef.current,
        gold: 0,
        waveCompletedClean: waveWasClean,
        gameWon: false,
        livesRemaining: livesRef.current,
        speedDroppedToOne: speedWasOneRef.current,
        maxComboReached: maxComboReachedRef.current,
        sniperDamageDealt: sniperDamageDealtRef.current,
        bossKilledThisTick: false,
        wave: currentWaveNum,
        endlessMode: true,
        activeSynergyPairs: activeSynergyPairsRef.current,
      })

      // Track highest wave reached for prestige eligibility
      if (currentWaveNum > wavesReachedRef.current) {
        wavesReachedRef.current = currentWaveNum
        setWavesReached(currentWaveNum)
      }

      syncPhase('between-waves')
    }
  }, [gold])

  useGameLoop(onTick, speed)

  /**
   * handleNewMap navigates to the bare URL (clears hash) so a fresh seed is
   * generated on reload, producing a brand-new map.
   */
  function handleNewMap() {
    window.location.hash = ''
    window.location.reload()
  }

  function handleSpeedToggle() {
    setSpeed(s => {
      const next = s === 1 ? 2 : s === 2 ? 5 : 1
      // speed_demon: track if speed ever dropped back to 1× during the run
      if (next === 1) {
        speedWasOneRef.current = true
      }
      return next
    })
  }

  function placeTower(row, col) {
    const type = selectedTowerType
    if (!canAfford(gold, type)) return

    // Prevent placing on already-occupied slots
    const occupied = towers.some(t => t.row === row && t.col === col)
    if (occupied) return

    // Only allow placement on tower-slot tiles
    if (INITIAL_MAP[row][col] !== 'tower-slot') return

    const cost = TOWER_TYPES[type].cost
    setGold(g => g - cost)
    setTowers(ts => [...ts, createTower(type, row, col)])
    // Emit a placement pulse ripple at the tower tile
    const pulse = { id: `pulse-${row}-${col}-${Date.now()}`, row, col, createdAt: Date.now() }
    const nextPulses = [...placementPulsesRef.current, pulse]
    placementPulsesRef.current = nextPulses
    setPlacementPulses(nextPulses)
    // Auto-select the newly placed tower so its fire radius ring is visible immediately
    setSelectedTower({ row, col })
    // Achievement: tower_builder — track cumulative placements in this run
    totalTowersPlacedRef.current += 1
    // Check tower_builder immediately
    triggerAchievementCheck({
      totalKills: totalKillsRef.current,
      totalTowersPlaced: totalTowersPlacedRef.current,
      gold: gold - cost,
      waveCompletedClean: false,
      gameWon: false,
      livesRemaining: livesRef.current,
      speedDroppedToOne: speedWasOneRef.current,
      maxComboReached: maxComboReachedRef.current,
      sniperDamageDealt: sniperDamageDealtRef.current,
      bossKilledThisTick: false,
      wave: waveRef.current,
      endlessMode: true,
      activeSynergyPairs: activeSynergyPairsRef.current,
    })
  }

  function handleTowerClick(row, col) {
    // Toggle: clicking the already-selected tower deselects it
    setSelectedTower(prev =>
      prev && prev.row === row && prev.col === col ? null : { row, col }
    )
  }

  function handleUpgrade(row, col) {
    const tower = towers.find(t => t.row === row && t.col === col)
    if (!tower) return
    const baseCost = getUpgradeCost(tower)
    if (baseCost === null) return
    const prestige = getPrestigeBonus(prestigeStars)
    const cost = Math.round(baseCost * prestige.upgradeCostMult)
    if (gold < cost) return
    setGold(g => g - cost)
    setTowers(ts =>
      ts.map(t => (t.row === row && t.col === col ? upgradeTower(t) : t))
    )
  }

  function handleSell(row, col) {
    const tower = towers.find(t => t.row === row && t.col === col)
    if (!tower) return
    const { refund } = sellTower(tower)
    setGold(g => g + refund)
    setTowers(ts => ts.filter(t => !(t.row === row && t.col === col)))
    setSelectedTower(null)
  }

  function handleCrateClick(crateId) {
    // Remove the crate
    const nextCrates = powerCratesRef.current.filter(c => c.id !== crateId)
    powerCratesRef.current = nextCrates
    setPowerCrates(nextCrates)

    // Apply a random reward
    const reward = selectCrateReward()
    if (reward.id === 'lives') {
      syncLives(Math.min(livesRef.current + 3, 99))
    } else if (reward.id === 'gold') {
      setGold(g => g + 200)
    } else if (reward.id === 'overcharge') {
      const OVERCHARGE_DURATION_MS = 15000
      overchargeUntilRef.current = gameClockRef.current + OVERCHARGE_DURATION_MS
      overchargeActiveRef.current = true
      setOverchargeActive(true)
    }
  }

  function handlePrestige() {
    // Award one prestige star (capped at MAX_PRESTIGE_STARS) and return to the main menu
    const current = loadPrestigeStars()
    const next = Math.min(current + 1, MAX_PRESTIGE_STARS)
    savePrestigeStars(next)
    setPrestigeStars(next)
    handleRestart()
  }

  function handleRestart() {
    // Reset difficulty: show selector again on next render
    difficultyModeRef.current = null
    setDifficultyMode(null)
    setGold(INITIAL_STATE.gold)
    syncLives(INITIAL_STATE.lives)
    syncWave(INITIAL_STATE.wave)
    setSpeed(INITIAL_STATE.speed)
    towersRef.current = INITIAL_STATE.towers
    setTowers(INITIAL_STATE.towers)
    adjacencySynergiesRef.current = new Map()
    setAdjacencySynergies(new Map())
    setSynergyPartners(new Map())
    enemiesRef.current = INITIAL_STATE.enemies
    setEnemies(INITIAL_STATE.enemies)
    projectilesRef.current = []
    setProjectiles([])
    deathAnimationsRef.current = []
    setDeathAnimations([])
    deathParticlesRef.current = []
    setDeathParticles([])
    damageNumbersRef.current = []
    setDamageNumbers([])
    poisonPuffsRef.current = []
    setPoisonPuffs([])
    placementPulsesRef.current = []
    setPlacementPulses([])
    setScreenShakeActive(false)
    setSelectedTower(null)
    nextEnemyIdRef.current = 0
    spawnTimerRef.current = 0
    spawnedInWaveRef.current = 0
    killedInWaveRef.current = 0
    spawnQueueRef.current = []
    gameClockRef.current = 0
    totalKillsRef.current = 0
    totalGoldEarnedRef.current = 0
    wavesCompletedRef.current = 0
    totalEnemiesToSpawnRef.current = 0
    earlyWaveCountRef.current = 0
    earlyWaveBonusRef.current = 1
    earlyWaveCalledRef.current = false
    setEarlyWaveCalled(false)
    setPendingWaveAdvance(0)
    setFinalScore(null)
    powerCratesRef.current = []
    setPowerCrates([])
    nextCrateIdRef.current = 0
    overchargeUntilRef.current = 0
    setOverchargeActive(false)
    currentWaveEventTypeRef.current = 'normal'
    setCurrentWaveEventType('normal')
    stealthRevealAtRef.current = 0
    eventGoldMultiplierRef.current = 1
    waveEventSeedRef.current = Math.floor(Math.random() * 100000)
    // Reset interest timer
    interestRealTimeRef.current = 0
    gameStartRealTimeRef.current = 0
    lastInterestWallRef.current = 0
    interestCountdownRef.current = 10
    setInterestCountdown(10)
    setInterestFlash(null)
    comboCountRef.current = 0
    comboWindowExpiryRef.current = 0
    comboBannerUntilRef.current = 0
    setComboDisplay({ count: 0, label: '', bonus: 0, visible: false })
    // Reset per-run achievement tracking refs
    totalTowersPlacedRef.current = 0
    maxComboReachedRef.current = 0
    sniperDamageDealtRef.current = 0
    livesAtWaveStartRef.current = INITIAL_STATE.lives
    speedWasOneRef.current = false
    activeSynergyPairsRef.current = 0
    wavesReachedRef.current = 0
    setWavesReached(0)
    // Re-read prestige stars in case they changed
    setPrestigeStars(loadPrestigeStars())
    syncPhase('between-waves')
  }

  // Scaling helpers — use the unified wave functions (always endless)
  function waveEnemyHp(waveNumber) {
    return getWaveEnemyHp(waveNumber)
  }
  function waveEnemyCount(waveNumber) {
    return getWaveEnemyCount(waveNumber)
  }
  function waveComposition(waveNumber) {
    return getWaveComposition(waveNumber)
  }

  function buildSpawnQueue(waveNumber, eventType = 'normal') {
    const eventCfg = WAVE_EVENT_CONFIG[eventType] ?? WAVE_EVENT_CONFIG.normal
    let composition = waveComposition(waveNumber)

    if (eventCfg.forceType) {
      // Horde: replace all non-colossus enemies with the forced type
      const total = composition.reduce((s, e) => e.type === 'colossus' ? s : s + e.count, 0)
      const hordeCount = Math.round(total * eventCfg.countMultiplier)
      const bossEntry = composition.filter(e => e.type === 'colossus')
      composition = [{ type: eventCfg.forceType, count: hordeCount }, ...bossEntry]
    } else if (eventCfg.countMultiplier !== 1) {
      // Scale counts but keep composition (used if we ever add count-only variants)
      composition = composition.map(e =>
        e.type === 'colossus' ? e : { ...e, count: Math.round(e.count * eventCfg.countMultiplier) }
      )
    }

    // Flatten into an ordered array of type strings
    const types = []
    for (const { type, count } of composition) {
      for (let i = 0; i < count; i++) types.push(type)
    }
    // Fisher-Yates shuffle for randomised spawn order (colossus stays last for boss waves)
    const regular = types.filter(t => t !== 'colossus')
    const bosses = types.filter(t => t === 'colossus')
    for (let i = regular.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[regular[i], regular[j]] = [regular[j], regular[i]]
    }
    return [...regular, ...bosses]
  }

  function handleStartWave() {
    spawnTimerRef.current = 0
    spawnedInWaveRef.current = 0
    killedInWaveRef.current = 0
    earlyWaveCountRef.current = 0
    earlyWaveBonusRef.current = 1
    earlyWaveCalledRef.current = false
    setEarlyWaveCalled(false)
    setPendingWaveAdvance(0)
    // Reset combo streak between waves
    comboCountRef.current = 0
    comboWindowExpiryRef.current = 0
    comboBannerUntilRef.current = 0
    setComboDisplay({ count: 0, label: '', bonus: 0, visible: false })
    // Record lives at wave start for untouchable achievement
    livesAtWaveStartRef.current = livesRef.current

    // Determine special event type for this wave
    const eventType = getWaveEventType(waveRef.current, waveEventSeedRef.current)
    currentWaveEventTypeRef.current = eventType
    setCurrentWaveEventType(eventType)

    // Stealth: record reveal time (game clock + 5s); reset to 0 for non-stealth
    const stealthDuration = WAVE_EVENT_CONFIG[eventType]?.stealthDurationMs ?? 0
    stealthRevealAtRef.current = stealthDuration > 0 ? gameClockRef.current + stealthDuration : 0

    // Store event-type gold multiplier separately so it is not overwritten
    // if the player triggers an early wave call during this wave.
    const eventCfg = WAVE_EVENT_CONFIG[eventType] ?? WAVE_EVENT_CONFIG.normal
    eventGoldMultiplierRef.current = eventCfg.goldMultiplier

    const queue = buildSpawnQueue(waveRef.current, eventType)
    spawnQueueRef.current = queue
    totalEnemiesToSpawnRef.current = queue.length

    // Record the wall-clock start of this run on the first wave start (wave 1).
    // This anchors the 30-second warmup window for the interest system.
    if (waveRef.current === 1 && gameStartRealTimeRef.current === 0) {
      gameStartRealTimeRef.current = Date.now()
    }
    // Reset the real-time interest accumulator each time a wave starts so the 10-second
    // clock is fresh and countdown is accurate.
    interestRealTimeRef.current = 0
    interestCountdownRef.current = 10
    setInterestCountdown(10)
    lastInterestWallRef.current = Date.now()

    syncPhase('playing')
  }

  function handleNextWaveStart() {
    // Advance by 1 for the normal next wave, plus any extra waves called early last round.
    const advance = 1 + earlyWaveCountRef.current
    syncWave(waveRef.current + advance)
    handleStartWave()
  }

  function handleCallNextWaveEarly() {
    // Guard: only one early call per wave
    if (earlyWaveCalledRef.current) return

    earlyWaveCalledRef.current = true
    earlyWaveCountRef.current = 1

    // Compute and store the bonus multiplier for this wave's kills
    earlyWaveBonusRef.current = getEarlyWaveBonus(1, waveRef.current)

    // Append the next wave's enemies to the spawn queue
    const nextWaveNum = waveRef.current + 1
    const extraQueue = buildSpawnQueue(nextWaveNum)
    spawnQueueRef.current = [...spawnQueueRef.current, ...extraQueue]
    totalEnemiesToSpawnRef.current = spawnQueueRef.current.length

    setEarlyWaveCalled(true)
    setPendingWaveAdvance(1)
  }

  return (
    <div id="game">
      <HUD
        lives={lives}
        gold={gold}
        wave={wave}
        speed={speed}
        onSpeedToggle={handleSpeedToggle}
        onRestart={handleRestart}
        showNextWave={gamePhase === 'playing'}
        earlyWaveDisabled={earlyWaveCalled}
        onNextWaveEarly={handleCallNextWaveEarly}
        comboCount={comboDisplay.count}
        comboLabel={comboDisplay.label}
        comboBonus={comboDisplay.bonus}
        comboVisible={comboDisplay.visible}
        unlockedAchievements={unlockedAchievements}
        totalAchievements={ACHIEVEMENTS.length}
        onAchievementClick={() => setAchievementModalOpen(true)}
        difficultyLabel={difficultyMode ? getDifficultyConfig(difficultyMode).label : ''}
        difficultyColor={difficultyMode ? getDifficultyConfig(difficultyMode).color : '#e0e0e0'}
        interestCountdown={gamePhase === 'playing' ? interestCountdown : null}
        interestFlash={interestFlash}
        prestigeStars={prestigeStars}
        showSynergies={showSynergies}
        onShowSynergiesToggle={() => setShowSynergies(v => !v)}
        levelHash={LEVEL_HASH}
        onNewMap={handleNewMap}
      />
      <div className="game-area">
        <TowerPicker
          selectedType={selectedTowerType}
          gold={gold}
          onSelect={setSelectedTowerType}
        />
      <GameBoard
        tiles={INITIAL_MAP}
        onTileClick={placeTower}
        onTowerClick={handleTowerClick}
        onDeselect={() => setSelectedTower(null)}
        towers={towers}
        enemies={enemies}
        projectiles={projectiles}
        deathAnimations={deathAnimations}
        deathParticles={deathParticles}
        damageNumbers={damageNumbers}
        poisonPuffs={poisonPuffs}
        placementPulses={placementPulses}
        screenShakeActive={screenShakeActive}
        selectedTower={selectedTower}
        hoveredSlot={hoveredSlot}
        onHoverSlot={setHoveredSlot}
        selectedTowerType={selectedTowerType}
        gold={gold}
        onUpgrade={handleUpgrade}
        onSell={handleSell}
        getUpgradeCost={getUpgradeCost}
        canUpgrade={canUpgrade}
        getNextUpgradeStats={getNextUpgradeStats}
        sellTower={sellTower}
        adjacencySynergies={adjacencySynergies}
        synergyPartners={synergyPartners}
        showSynergies={showSynergies}
        powerCrates={powerCrates}
        onCrateClick={handleCrateClick}
        overchargeActive={overchargeActive}
        showCountdownBanner={gamePhase === 'between-waves' && wave > 1}
        countdownWave={wave + 1 + pendingWaveAdvance}
        countdownEnemyCount={(() => {
          const nextWave = wave + 1 + pendingWaveAdvance
          const nextEvt = getWaveEventType(nextWave, waveEventSeedRef.current)
          const nextEvtCfg = WAVE_EVENT_CONFIG[nextEvt] ?? WAVE_EVENT_CONFIG.normal
          return Math.round(waveEnemyCount(nextWave) * nextEvtCfg.countMultiplier)
        })()}
        countdownEnemyHp={waveEnemyHp(wave + 1 + pendingWaveAdvance)}
        countdownIsBossWave={isBossWave(wave + 1 + pendingWaveAdvance)}
        countdownEventType={getWaveEventType(wave + 1 + pendingWaveAdvance, waveEventSeedRef.current)}
        onCountdownStart={handleNextWaveStart}
      />
      </div>
      {gamePhase === 'lose' && (
        <GameOver
          score={finalScore}
          onRestart={handleRestart}
          wavesReached={wavesReached}
          prestigeStars={prestigeStars}
          onPrestige={handlePrestige}
          levelHash={LEVEL_HASH}
        />
      )}
      {/* Difficulty selector: shown before the player picks a mode (fresh game or after restart) */}
      {difficultyMode === null && (
        <DifficultySelector
          onSelect={handleSelectDifficulty}
          availableModes={getPrestigeBonus(prestigeStars).unlockVeteran
            ? [...DIFFICULTY_MODES.slice(0, 3), 'veteran', DIFFICULTY_MODES[3]]
            : DIFFICULTY_MODES
          }
        />
      )}
      {gamePhase === 'between-waves' && wave === 1 && difficultyMode !== null && (
        <NextWave
          wave={wave}
          enemyCount={waveEnemyCount(wave)}
          enemyHp={waveEnemyHp(wave)}
          onStart={handleNextWaveStart}
        />
      )}
      {wave > 1 && difficultyMode !== null && (
        <WavePreviewPanel
          visible={gamePhase === 'between-waves'}
          waveNumber={wave + 1 + pendingWaveAdvance}
          preview={getWavePreview(wave + 1 + pendingWaveAdvance)}
          onStart={handleNextWaveStart}
        />
      )}
      <AchievementToast toasts={achievementToasts} />
      {achievementModalOpen && (
        <AchievementModal
          unlocked={unlockedAchievements}
          onClose={() => setAchievementModalOpen(false)}
        />
      )}
    </div>
  )
}

export default App
