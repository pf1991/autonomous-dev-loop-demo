/**
 * GameBoard — CSS-grid tile map component.
 * Renders a 20×15 grid of <div> tiles.
 * Accepts:
 *   tiles       — 2D array (15 rows × 20 cols) of tile-type strings
 *   onTileClick — callback(row, col) invoked when a tile is clicked
 *   towers      — array of tower objects { row, col } to render as overlays
 *   enemies     — array of enemy objects { pos: { row, col }, hp, maxHp } to render as overlays
 */
function GameBoard({ tiles, onTileClick, towers = [], enemies = [] }) {
  // Build a Set of "row-col" keys for O(1) lookup
  const towerSet = new Set(towers.map(t => `${t.row}-${t.col}`))

  // Build a map from "row-col" key to array of enemies on that tile
  const enemyMap = {}
  for (const enemy of enemies) {
    const r = Math.round(enemy.pos.row)
    const c = Math.round(enemy.pos.col)
    const key = `${r}-${c}`
    if (!enemyMap[key]) enemyMap[key] = []
    enemyMap[key].push(enemy)
  }

  return (
    <div className="game-board">
      {tiles.map((row, rowIndex) =>
        row.map((tileType, colIndex) => {
          const hasTower = towerSet.has(`${rowIndex}-${colIndex}`)
          const tileEnemies = enemyMap[`${rowIndex}-${colIndex}`] || []
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`tile ${tileType}`}
              onClick={() => onTileClick(rowIndex, colIndex)}
            >
              {hasTower && <span className="tower-icon">🗼</span>}
              {tileEnemies.map(enemy => (
                <div key={enemy.id} className="enemy">
                  <div
                    className="enemy-hp-bar"
                    style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

export default GameBoard
