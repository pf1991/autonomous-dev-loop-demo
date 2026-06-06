/**
 * GameBoard — CSS-grid tile map component.
 * Renders a 20×15 grid of <div> tiles.
 * Accepts:
 *   tiles       — 2D array (15 rows × 20 cols) of tile-type strings
 *   onTileClick — callback(row, col) invoked when a tile is clicked
 *   towers      — array of tower objects { row, col } to render as overlays
 */
function GameBoard({ tiles, onTileClick, towers = [] }) {
  // Build a Set of "row-col" keys for O(1) lookup
  const towerSet = new Set(towers.map(t => `${t.row}-${t.col}`))

  return (
    <div className="game-board">
      {tiles.map((row, rowIndex) =>
        row.map((tileType, colIndex) => {
          const hasTower = towerSet.has(`${rowIndex}-${colIndex}`)
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`tile ${tileType}`}
              onClick={() => onTileClick(rowIndex, colIndex)}
            >
              {hasTower && <span className="tower-icon">🗼</span>}
            </div>
          )
        })
      )}
    </div>
  )
}

export default GameBoard
