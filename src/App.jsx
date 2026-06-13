import { useState, useCallback, useRef, useEffect } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import GameOver from './components/GameOver'
import NextWave from './components/NextWave'
import TowerPicker from './components/TowerPicker'
import { createDefaultMap, getPathWaypoints } from './game/map'
import { TOWER_TYPES, createTower, canAfford, canUpgrade, upgradeTower, getUpgradeCost, getNextUpgradeStats, sellTower } from './game/tower'
import { createEnemy, moveEnemy, getBossHp } from './game/enemy'
import { processCombat } from './game/combat'
import { getWaveEnemyHp, getWaveEnemyCount, getWaveComposition, getEarlyWaveBonus, getEndlessWaveEnemyHp, getEndlessWaveEnemyCount, getEndlessWaveComposition, isBossWave } from './game/wave'
import { createPowerCrate, selectCrateReward } from './game/powerCrate'
import { useGameLoop } from './hooks/useGameLoop'
import { computeScore } from './game/score'
import { saveLeaderboardEntry } from './utils/leaderboard'

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

  function syncWave(val) {
    waveRef.current = val
    setWave(val)
  }

  function syncPhase(val) {
    gamePhaseRef.current = val
    setGamePhase(val)
  }

  // Keep towersRef in sync with towers state so onTick always sees the latest tower list
  useEffect(() => {
    towersRef.current = towers
  }, [towers])

  // Transition to 'lose' when lives hit 0 — scheduled outside setEnemies callback
  useEffect(() => {
    if (lives <= 0 && gamePhase === 'playing') {
      const score = computeScore({
        kills: totalKillsRef.current,
        goldEarned: totalGoldEarnedRef.current,
        livesRemaining: 0,
        wavesCompleted: wavesCompletedRef.current,
      })
      const entry = { score, date: new Date().toLocaleDateString(), result: 'lose' }
      saveLeaderboardEntry(entry)
      setFinalScore(score)
      syncPhase('lose')
    }
  }, [lives, gamePhase])

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
      const hpOverride = enemyType === 'colossus' ? getBossHp() : undefined
      newEnemy = createEnemy(nextEnemyIdRef.current++, PATH_WAYPOINTS, enemyType, hpOverride)
      spawnedInWaveRef.current += 1
    }

    const nowMs = gameClockRef.current

    // Read current enemies from ref — avoids functional updater side effects that break
    // under React 18 StrictMode (which double-invokes updater functions to detect impurity).
    // Expire any slow debuffs whose duration has elapsed before movement/combat.
    const rawAll = newEnemy ? [...enemiesRef.current, newEnemy] : [...enemiesRef.current]
    const all = rawAll.map(e => {
      if (e.slowUntil != null && nowMs >= e.slowUntil) {
        const { slowUntil, speedMult, ...rest } = e
        return rest
      }
      return e
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
    const combatResult = processCombat(combatTowers, surviving, nowMs)
    const afterCombat = combatResult.enemies
    killedNow += surviving.length - afterCombat.length

    // Spawn power crate on colossus death
    const bossKilled = combatResult.killedEnemies?.filter(k => k.type === 'colossus') ?? []
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

    if (combatResult.goldEarned > 0) {
      const bonusMultiplier = earlyWaveBonusRef.current
      const bonusGold = Math.round(combatResult.goldEarned * bonusMultiplier)
      setGold(g => g + bonusGold)
      totalGoldEarnedRef.current += bonusGold

      // Spawn floating "+N gold" death animations for each killed enemy
      if (combatResult.killedEnemies && combatResult.killedEnemies.length > 0) {
        const newAnims = combatResult.killedEnemies.map(k => ({
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

      // In endless mode the game never ends on wave 10 — keep going
      if (currentWaveNum >= TOTAL_WAVES && !endlessModeRef.current) {
        const score = computeScore({
          kills: totalKillsRef.current,
          goldEarned: totalGoldEarnedRef.current,
          livesRemaining: livesRef.current,
          wavesCompleted: wavesCompletedRef.current,
        })
        const entry = { score, date: new Date().toLocaleDateString(), result: 'win' }
        saveLeaderboardEntry(entry)
        setFinalScore(score)
        syncPhase('win')
      } else {
        syncPhase('between-waves')
      }
    }
  }, [])

  useGameLoop(onTick, speed)

  function handleSpeedToggle() {
    setSpeed(s => (s === 1 ? 2 : s === 2 ? 5 : 1))
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
    setGold(INITIAL_STATE.gold)
    syncLives(INITIAL_STATE.lives)
    syncWave(INITIAL_STATE.wave)
    setSpeed(INITIAL_STATE.speed)
    towersRef.current = INITIAL_STATE.towers
    setTowers(INITIAL_STATE.towers)
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

  function buildSpawnQueue(waveNumber) {
    const composition = waveComposition(waveNumber)
    // Flatten into an ordered array of type strings
    const types = []
    for (const { type, count } of composition) {
      for (let i = 0; i < count; i++) types.push(type)
    }
    // Fisher-Yates shuffle for randomised spawn order
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[types[i], types[j]] = [types[j], types[i]]
    }
    return types
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
    const queue = buildSpawnQueue(waveRef.current)
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
        powerCrates={powerCrates}
        onCrateClick={handleCrateClick}
        overchargeActive={overchargeActive}
        showCountdownBanner={gamePhase === 'between-waves' && wave > 1}
        countdownWave={wave + 1 + pendingWaveAdvance}
        countdownEnemyCount={waveEnemyCount(wave + 1 + pendingWaveAdvance)}
        countdownEnemyHp={waveEnemyHp(wave + 1 + pendingWaveAdvance)}
        countdownIsBossWave={isBossWave(wave + 1 + pendingWaveAdvance)}
        onCountdownStart={handleNextWaveStart}
      />
      {gamePhase === 'lose' && (
        <GameOver result="lose" score={finalScore} onRestart={handleRestart} />
      )}
      {gamePhase === 'win' && (
        <GameOver result="win" score={finalScore} onRestart={handleRestart} />
      )}
      {gamePhase === 'between-waves' && wave === 1 && (
        <NextWave
          wave={wave}
          enemyCount={waveEnemyCount(wave)}
          enemyHp={waveEnemyHp(wave)}
          onStart={handleNextWaveStart}
          endlessMode={endlessMode}
          onToggleEndless={handleToggleEndless}
        />
      )}
    </div>
  )
}

export default App
