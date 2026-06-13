import { useState, useCallback, useRef, useEffect } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import GameOver from './components/GameOver'
import NextWave from './components/NextWave'
import TowerPicker from './components/TowerPicker'
import AchievementToast from './components/AchievementToast'
import AchievementModal from './components/AchievementModal'
import DifficultySelector from './components/DifficultySelector'
import { createDefaultMap, getPathWaypoints } from './game/map'
import { TOWER_TYPES, createTower, canAfford, canUpgrade, upgradeTower, getUpgradeCost, getNextUpgradeStats, sellTower, getAdjacentSynergies } from './game/tower'
import { createEnemy, moveEnemy, getEnemyHpForWave } from './game/enemy'
import { processCombat, processEffectTick } from './game/combat'
import { getWaveEnemyHp, getWaveEnemyCount, getWaveComposition, getEarlyWaveBonus, getEndlessWaveEnemyHp, getEndlessWaveEnemyCount, getEndlessWaveComposition, isBossWave, getWaveEventType, WAVE_EVENT_CONFIG } from './game/wave'
import { createPowerCrate, selectCrateReward } from './game/powerCrate'
import { useGameLoop } from './hooks/useGameLoop'
import { computeScore, computeComboBonus, getComboLabel } from './game/score'
import { getDifficultyConfig, applyDifficultyToScore } from './game/difficulty'
import { saveLeaderboardEntry } from './utils/leaderboard'
import { checkAchievements, ACHIEVEMENTS } from './game/achievements'
import { loadUnlockedAchievements, persistNewAchievements } from './utils/achievements'

const INITIAL_MAP = createDefaultMap()
const PATH_WAYPOINTS = getPathWaypoints()

// Spawn one enemy every 3 seconds (3000 ms)
const SPAWN_INTERVAL_MS = 3000
// Total waves in game
const TOTAL_WAVES = 10

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
  const [selectedTowerType, setSelectedTowerType] = useState('BasicTower')
  // { row, col } | null — the tower tile currently selected for upgrade
  const [selectedTower, setSelectedTower] = useState(null)
  // { row, col } | null — the empty tower-slot the player is hovering over
  const [hoveredSlot, setHoveredSlot] = useState(null)
  // 'playing' | 'between-waves' | 'win' | 'lose'
  const [gamePhase, setGamePhase] = useState('between-waves')
  // Endless mode — when true the game never ends at wave 10; difficulty scales infinitely
  const [endlessMode, setEndlessMode] = useState(false)
  const endlessModeRef = useRef(false)
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

  // Achievement tracking
  // unlockedAchievements: array of unlocked achievement IDs, loaded from localStorage on mount
  const [unlockedAchievements, setUnlockedAchievements] = useState(() => loadUnlockedAchievements())
  const unlockedAchievementsRef = useRef(loadUnlockedAchievements())
  // Achievement toast notifications: array of { id, name, dismissAt }
  const [achievementToasts, setAchievementToasts] = useState([])
  const achievementToastsRef = useRef([])
  // Achievement modal visibility
  const [achievementModalOpen, setAchievementModalOpen] = useState(false)
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
    // Apply starting gold and lives
    setGold(cfg.startingGold)
    syncLives(cfg.startingLives)
  }

  // Keep towersRef in sync with towers state so onTick always sees the latest tower list.
  // Also recompute adjacency synergies whenever the tower list changes.
  useEffect(() => {
    towersRef.current = towers
    const synergies = getAdjacentSynergies(towers)
    adjacencySynergiesRef.current = synergies
    setAdjacencySynergies(synergies)
  }, [towers])

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
    // Process DoT effect ticks (poison) — pure function, runs after combat each tick
    const effectResult = processEffectTick(combatResult.enemies, nowMs)
    const afterCombat = effectResult.enemies
    killedNow += surviving.length - combatResult.enemies.length  // killed by towers
    killedNow += combatResult.enemies.length - afterCombat.length // killed by DoT

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

    // Update towers with new lastFiredAt values when any tower fired.
    // Only call setTowers when a tower actually fired to avoid a re-render every tick.
    const anyFired = combatResult.towers.some(
      (t, i) => t.lastFiredAt !== towersRef.current[i]?.lastFiredAt
    )
    if (anyFired) {
      towersRef.current = combatResult.towers
      setTowers(combatResult.towers)
    } else if (towersRef.current.length > 0) {
      towersRef.current = combatResult.towers
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
        endlessMode: endlessModeRef.current,
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
        endlessMode: endlessModeRef.current,
        activeSynergyPairs: activeSynergyPairsRef.current,
      })

      // In endless mode the game never ends on wave 10 — keep going
      if (currentWaveNum >= TOTAL_WAVES && !endlessModeRef.current) {
        const rawScore = computeScore({
          kills: totalKillsRef.current,
          goldEarned: totalGoldEarnedRef.current,
          livesRemaining: livesRef.current,
          wavesCompleted: wavesCompletedRef.current,
        })
        const score = applyDifficultyToScore(rawScore, difficultyModeRef.current ?? 'normal')
        const entry = { score, date: new Date().toLocaleDateString(), result: 'win', difficulty: difficultyModeRef.current ?? 'normal' }
        saveLeaderboardEntry(entry)
        setFinalScore(score)
        // Achievement: flawless, speed_demon — on win
        triggerAchievementCheck({
          totalKills: totalKillsRef.current,
          totalTowersPlaced: totalTowersPlacedRef.current,
          gold: 0,
          waveCompletedClean: false,
          gameWon: true,
          livesRemaining: livesRef.current,
          speedDroppedToOne: speedWasOneRef.current,
          maxComboReached: maxComboReachedRef.current,
          sniperDamageDealt: sniperDamageDealtRef.current,
          bossKilledThisTick: false,
          wave: currentWaveNum,
          endlessMode: endlessModeRef.current,
          activeSynergyPairs: activeSynergyPairsRef.current,
        })
        syncPhase('win')
      } else {
        syncPhase('between-waves')
      }
    }
  }, [gold])

  useGameLoop(onTick, speed)

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
      endlessMode: endlessModeRef.current,
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
    const cost = getUpgradeCost(tower)
    if (cost === null || gold < cost) return
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

  function handleToggleEndless() {
    // Only toggleable on the pre-wave-1 screen (wave hasn't started yet)
    const next = !endlessModeRef.current
    endlessModeRef.current = next
    setEndlessMode(next)
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
    enemiesRef.current = INITIAL_STATE.enemies
    setEnemies(INITIAL_STATE.enemies)
    projectilesRef.current = []
    setProjectiles([])
    deathAnimationsRef.current = []
    setDeathAnimations([])
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
    endlessModeRef.current = false
    setEndlessMode(false)
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
    syncPhase('between-waves')
  }

  // Endless-aware helpers — route to the appropriate scaling functions
  function waveEnemyHp(waveNumber) {
    return endlessModeRef.current ? getEndlessWaveEnemyHp(waveNumber) : getWaveEnemyHp(waveNumber)
  }
  function waveEnemyCount(waveNumber) {
    return endlessModeRef.current ? getEndlessWaveEnemyCount(waveNumber) : getWaveEnemyCount(waveNumber)
  }
  function waveComposition(waveNumber) {
    return endlessModeRef.current ? getEndlessWaveComposition(waveNumber) : getWaveComposition(waveNumber)
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
    syncPhase('playing')
  }

  function handleNextWaveStart() {
    // Advance by 1 for the normal next wave, plus any extra waves called early last round.
    const advance = 1 + earlyWaveCountRef.current
    syncWave(waveRef.current + advance)
    handleStartWave()
  }

  function handleCallNextWaveEarly() {
    // Guard: only one early call per wave, and not on the final wave (unless endless mode)
    if (earlyWaveCalledRef.current) return
    if (!endlessModeRef.current && waveRef.current >= TOTAL_WAVES) return

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
        showNextWave={gamePhase === 'playing' && (endlessMode || wave < TOTAL_WAVES)}
        endlessMode={endlessMode}
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
      />
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
      {gamePhase === 'lose' && (
        <GameOver result="lose" score={finalScore} onRestart={handleRestart} />
      )}
      {gamePhase === 'win' && (
        <GameOver result="win" score={finalScore} onRestart={handleRestart} />
      )}
      {/* Difficulty selector: shown before the player picks a mode (fresh game or after restart) */}
      {difficultyMode === null && (
        <DifficultySelector onSelect={handleSelectDifficulty} />
      )}
      {gamePhase === 'between-waves' && wave === 1 && difficultyMode !== null && (
        <NextWave
          wave={wave}
          enemyCount={waveEnemyCount(wave)}
          enemyHp={waveEnemyHp(wave)}
          onStart={handleNextWaveStart}
          endlessMode={endlessMode}
          onToggleEndless={handleToggleEndless}
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
