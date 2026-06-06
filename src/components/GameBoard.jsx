/**
 * GameBoard — CSS-grid tile map component.
 * Renders a 20×15 grid of <div> tiles.
 * Accepts:
 *   tiles       — 2D array (15 rows × 20 cols) of tile-type strings
 *   onTileClick — callback(row, col) invoked when a tile is clicked
 */
function GameBoard({ tiles, onTileClick }) {
  return (
    <div className="game-board">
      {tiles.map((row, rowIndex) =>
        row.map((tileType, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={`tile ${tileType}`}
            onClick={() => onTileClick(rowIndex, colIndex)}
          />
        ))
      )}
    </div>
  )
}

export default GameBoard
