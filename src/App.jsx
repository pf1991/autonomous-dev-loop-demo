import { useState, useCallback } from 'react'
import GameBoard from './components/GameBoard'
import HUD from './components/HUD'
import { createDefaultMap } from './game/map'
import { TOWER_TYPES, createTower, canAfford } from './game/tower'
import { useGameLoop } from './hooks/useGameLoop'

const INITIAL_MAP = createDefaultMap()

function App() {
  const [gold, setGold] = useState(100)
  const [lives, setLives] = useState(20)
  const [wave, setWave] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [towers, setTowers] = useState([])

  const onTick = useCallback((_deltaMs) => {
    // Placeholder: enemy movement and life-loss logic would go here.
    // When an enemy reaches the end of the path, decrement lives by 1.
    // Example (to be wired to real enemy state):
    // if (enemyReachedEnd) setLives(l => l - 1)
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
