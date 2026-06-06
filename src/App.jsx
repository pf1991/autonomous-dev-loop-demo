import { useState, useCallback, useRef, useEffect } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import GameOver from './components/GameOver'
import NextWave from './components/NextWave'
import { createDefaultMap, getPathWaypoints } from './game/map'
import { TOWER_TYPES, createTower, canAfford } from './game/tower'
import { createEnemy, moveEnemy } from './game/enemy'
import { processCombat } from './game/combat'
import { useGameLoop } from './hooks/useGameLoop'

const INITIAL_MAP = createDefaultMap()
const PATH_WAYPOINTS = getPathWaypoints()

// Spawn one enemy every 3 seconds (3000 ms)
const SPAWN_INTERVAL_MS = 3000
// Enemies per wave
const ENEMIES_PER_WAVE = 5
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
  // Accumulated game clock (scaled by speed) — used as nowMs for combat
  const gameClockRef = useRef(0)

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
    if (lives <= 0 && gamePhaseRef.current === 'playing') {
      syncPhase('lose')
    }
  }, [lives])

  const onTick = useCallback((deltaMs) => {
    if (gamePhaseRef.current !== 'playing') return

    // Advance the game clock (scaled delta already applied by useGameLoop)
    gameClockRef.current += deltaMs

    // Accumulate time for spawning
    spawnTimerRef.current += deltaMs
    let newEnemy = null
    if (
      spawnTimerRef.current >= SPAWN_INTERVAL_MS &&
      spawnedInWaveRef.current < ENEMIES_PER_WAVE
    ) {
      spawnTimerRef.current = 0
      newEnemy = createEnemy(nextEnemyIdRef.current++, PATH_WAYPOINTS)
      spawnedInWaveRef.current += 1
    }

    const nowMs = gameClockRef.current

    // Snapshot current enemies to compute the next state outside a functional updater
    // We use a ref snapshot trick: compute all updates synchronously then batch-set them.
    setEnemies(prev => {
      const all = newEnemy ? [...prev, newEnemy] : [...prev]
      const surviving = []
      let livesLost = 0
      let killedNow = 0

      for (const enemy of all) {
        const updated = moveEnemy(enemy, deltaMs, PATH_WAYPOINTS)
        if (updated === null) {
          // Enemy reached the end of the path — lose a life
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

      // Update towers with new lastFiredAt values when any tower fired
      if (towersRef.current.length > 0) {
        towersRef.current = combatResult.towers
        setTowers(combatResult.towers)
      }

      killedInWaveRef.current += killedNow

      // Check wave completion: all enemies spawned and none remaining
      if (
        spawnedInWaveRef.current >= ENEMIES_PER_WAVE &&
        afterCombat.length === 0 &&
        gamePhaseRef.current === 'playing' &&
        livesRef.current > 0
      ) {
        const currentWave = waveRef.current
        if (currentWave >= TOTAL_WAVES) {
          syncPhase('win')
        } else {
          syncPhase('between-waves')
        }
      }

      return afterCombat
    })
  }, [])

  useGameLoop(onTick, speed)

  function handleSpeedToggle() {
    setSpeed(s => (s === 1 ? 2 : 1))
  }

  function placeTower(row, col) {
    const type = 'BasicTower'
    if (!canAfford(gold, type)) return

    // Prevent placing on already-occupied slots
    const occupied = towers.some(t => t.row === row && t.col === col)
    if (occupied) return

    // Only allow placement on tower-slot tiles
    if (INITIAL_MAP[row][col] !== 'tower-slot') return

    const cost = TOWER_TYPES[type].cost
    setGold(g => g - cost)
    setTowers(ts => [...ts, createTower(type, row, col)])
  }

  function handleRestart() {
    setGold(INITIAL_STATE.gold)
    syncLives(INITIAL_STATE.lives)
    syncWave(INITIAL_STATE.wave)
    setSpeed(INITIAL_STATE.speed)
    setTowers(INITIAL_STATE.towers)
    setEnemies(INITIAL_STATE.enemies)
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
      />
      <GameBoard
        tiles={INITIAL_MAP}
        onTileClick={placeTower}
        towers={towers}
        enemies={enemies}
      />
      {gamePhase === 'lose' && (
        <GameOver result="lose" onRestart={handleRestart} />
      )}
      {gamePhase === 'win' && (
        <GameOver result="win" onRestart={handleRestart} />
      )}
      {gamePhase === 'between-waves' && (
        <NextWave wave={wave} onStart={handleNextWaveStart} />
      )}
    </div>
  )
}

export default App
