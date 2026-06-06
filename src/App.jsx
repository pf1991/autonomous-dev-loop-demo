import { useState, useCallback, useRef } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import { createDefaultMap, getPathWaypoints } from './game/map'
import { TOWER_TYPES, createTower, canAfford } from './game/tower'
import { createEnemy, moveEnemy } from './game/enemy'
import { useGameLoop } from './hooks/useGameLoop'

const INITIAL_MAP = createDefaultMap()
const PATH_WAYPOINTS = getPathWaypoints()

// Spawn one enemy every 3 seconds (3000 ms)
const SPAWN_INTERVAL_MS = 3000

function App() {
  const [gold, setGold] = useState(100)
  const [lives, setLives] = useState(20)
  const [wave] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [towers, setTowers] = useState([])
  const [enemies, setEnemies] = useState([])

  const nextEnemyIdRef = useRef(0)
  const spawnTimerRef = useRef(0)

  const onTick = useCallback((deltaMs) => {
    // Accumulate time for spawning
    spawnTimerRef.current += deltaMs
    let newEnemy = null
    if (spawnTimerRef.current >= SPAWN_INTERVAL_MS) {
      spawnTimerRef.current = 0
      newEnemy = createEnemy(nextEnemyIdRef.current++, PATH_WAYPOINTS)
    }

    // Move all enemies along the path; collect those that exit (reached the end)
    setEnemies(prev => {
      const all = newEnemy ? [...prev, newEnemy] : [...prev]
      const surviving = []
      let livesLost = 0

      for (const enemy of all) {
        const updated = moveEnemy(enemy, deltaMs, PATH_WAYPOINTS)
        if (updated === null) {
          // Enemy reached the end of the path — lose a life
          livesLost++
        } else {
          surviving.push(updated)
        }
      }

      if (livesLost > 0) {
        setLives(l => Math.max(0, l - livesLost))
      }

      return surviving
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
      />
    </div>
  )
}

export default App
