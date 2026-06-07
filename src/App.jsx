import { useState, useCallback, useRef, useEffect } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import GameOver from './components/GameOver'
import NextWave from './components/NextWave'
import TowerPicker from './components/TowerPicker'
import { createDefaultMap, getPathWaypoints } from './game/map'
import { TOWER_TYPES, createTower, canAfford, canUpgrade, upgradeTower, getUpgradeCost, getNextUpgradeStats, sellTower } from './game/tower'
import { createEnemy, moveEnemy } from './game/enemy'
import { processCombat } from './game/combat'
import { getWaveEnemyHp, getWaveEnemyCount } from './game/wave'
import { useGameLoop } from './hooks/useGameLoop'

const INITIAL_MAP = createDefaultMap()
const PATH_WAYPOINTS = getPathWaypoints()

// Spawn one enemy every 3 seconds (3000 ms)
const SPAWN_INTERVAL_MS = 3000
// Total waves in game
const TOTAL_WAVES = 10

const INITIAL_STATE = {
  lives: 20,
  gold: 100,
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
  const [selectedTowerType, setSelectedTowerType] = useState('BasicTower')
  // { row, col } | null — the tower tile currently selected for upgrade
  const [selectedTower, setSelectedTower] = useState(null)
  // { row, col } | null — the empty tower-slot the player is hovering over
  const [hoveredSlot, setHoveredSlot] = useState(null)
  // 'playing' | 'between-waves' | 'win' | 'lose'
  const [gamePhase, setGamePhase] = useState('between-waves')

  const nextEnemyIdRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const spawnedInWaveRef = useRef(0)
  const killedInWaveRef = useRef(0)
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
      syncPhase('lose')
    }
  }, [lives, gamePhase])

  const onTick = useCallback((deltaMs) => {
    if (gamePhaseRef.current !== 'playing') return

    // Advance the game clock (scaled delta already applied by useGameLoop)
    gameClockRef.current += deltaMs
    spawnTimerRef.current += deltaMs

    const currentWaveNum = waveRef.current
    const enemiesThisWave = getWaveEnemyCount(currentWaveNum)
    const enemyHp = getWaveEnemyHp(currentWaveNum)

    let newEnemy = null
    if (
      spawnTimerRef.current >= SPAWN_INTERVAL_MS &&
      spawnedInWaveRef.current < enemiesThisWave
    ) {
      spawnTimerRef.current = 0
      newEnemy = createEnemy(nextEnemyIdRef.current++, PATH_WAYPOINTS, enemyHp)
      spawnedInWaveRef.current += 1
    }

    const nowMs = gameClockRef.current

    // Read current enemies from ref — avoids functional updater side effects that break
    // under React 18 StrictMode (which double-invokes updater functions to detect impurity)
    const all = newEnemy ? [...enemiesRef.current, newEnemy] : [...enemiesRef.current]
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
    const combatResult = processCombat(towersRef.current, surviving, nowMs)
    const afterCombat = combatResult.enemies
    killedNow += surviving.length - afterCombat.length

    if (combatResult.goldEarned > 0) {
      setGold(g => g + combatResult.goldEarned)
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

    enemiesRef.current = afterCombat
    setEnemies(afterCombat)

    // Check wave completion: all enemies spawned and none remaining
    if (
      spawnedInWaveRef.current >= enemiesThisWave &&
      afterCombat.length === 0 &&
      gamePhaseRef.current === 'playing' &&
      livesRef.current > 0
    ) {
      if (currentWaveNum >= TOTAL_WAVES) {
        syncPhase('win')
      } else {
        syncPhase('between-waves')
      }
    }
  }, [])

  useGameLoop(onTick, speed)

  function handleSpeedToggle() {
    setSpeed(s => (s === 1 ? 2 : 1))
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
    // Deselect upgrade panel when placing a new tower
    setSelectedTower(null)
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
    setSelectedTower(null)
    nextEnemyIdRef.current = 0
    spawnTimerRef.current = 0
    spawnedInWaveRef.current = 0
    killedInWaveRef.current = 0
    gameClockRef.current = 0
    syncPhase('between-waves')
  }

  function handleStartWave() {
    spawnTimerRef.current = 0
    spawnedInWaveRef.current = 0
    killedInWaveRef.current = 0
    syncPhase('playing')
  }

  function handleNextWaveStart() {
    syncWave(waveRef.current + 1)
    handleStartWave()
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
        towers={towers}
        enemies={enemies}
        projectiles={projectiles}
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
        showCountdownBanner={gamePhase === 'between-waves' && wave > 1}
        countdownWave={wave + 1}
        countdownEnemyCount={getWaveEnemyCount(wave + 1)}
        countdownEnemyHp={getWaveEnemyHp(wave + 1)}
        onCountdownStart={handleNextWaveStart}
      />
      {gamePhase === 'lose' && (
        <GameOver result="lose" onRestart={handleRestart} />
      )}
      {gamePhase === 'win' && (
        <GameOver result="win" onRestart={handleRestart} />
      )}
      {gamePhase === 'between-waves' && wave === 1 && (
        <NextWave
          wave={wave}
          enemyCount={getWaveEnemyCount(wave)}
          enemyHp={getWaveEnemyHp(wave)}
          onStart={handleNextWaveStart}
        />
      )}
    </div>
  )
}

export default App
