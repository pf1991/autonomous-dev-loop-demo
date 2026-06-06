import { useState } from 'react'
import GameBoard from './components/GameBoard'
import { createDefaultMap } from './game/map'
import { TOWER_TYPES, createTower, canAfford } from './game/tower'

const INITIAL_MAP = createDefaultMap()

function App() {
  const [gold, setGold] = useState(100)
  const [towers, setTowers] = useState([])

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
      <div className="hud">
        <span>Gold: {gold}</span>
      </div>
      <GameBoard
        tiles={INITIAL_MAP}
        onTileClick={placeTower}
        towers={towers}
      />
    </div>
  )
}

export default App
