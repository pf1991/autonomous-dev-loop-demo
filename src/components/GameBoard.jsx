import UpgradePanel from './UpgradePanel.jsx'

// Tile size in pixels — must match the CSS (.tile width/height)
const TILE_PX = 40

/**
 * GameBoard — CSS-grid tile map component.
 * Renders a 20×15 grid of <div> tiles.
 * Accepts:
 *   tiles          — 2D array (15 rows × 20 cols) of tile-type strings
 *   onTileClick    — callback(row, col) invoked when an empty tower-slot tile is clicked
 *   onTowerClick   — callback(row, col) invoked when a tile with a tower is clicked
 *   towers         — array of tower objects { row, col, type, upgradeLevel, range, damage, fireRate } to render as overlays
 *   enemies        — array of enemy objects { pos: { row, col }, hp, maxHp } to render as overlays
 *   projectiles    — array of projectile objects { id, fromRow, fromCol, toRow, toCol } to render as shot lines
 *   selectedTower  — { row, col } | null — the currently-selected tower for upgrade panel
 *   gold           — current gold (number), used to determine if upgrade button should be enabled
 *   onUpgrade      — callback(row, col) invoked when Upgrade button is clicked
 *   getUpgradeCost      — function(tower) returning the upgrade cost (number | null)
 *   canUpgrade          — function(tower) returning boolean
 *   getNextUpgradeStats — function(tower) returning next level stats object or null
 */
function GameBoard({
  tiles,
  onTileClick,
  onTowerClick,
  towers = [],
  enemies = [],
  projectiles = [],
  selectedTower = null,
  gold = 0,
  onUpgrade,
  getUpgradeCost,
  canUpgrade,
  getNextUpgradeStats,
}) {
  // Build a map from "row-col" key to tower object for O(1) lookup
  const towerMap = {}
  for (const t of towers) {
    towerMap[`${t.row}-${t.col}`] = t
  }

  // Build a map from "row-col" key to array of enemies on that tile
  const enemyMap = {}
  for (const enemy of enemies) {
    const r = Math.round(enemy.pos.row)
    const c = Math.round(enemy.pos.col)
    const key = `${r}-${c}`
    if (!enemyMap[key]) enemyMap[key] = []
    enemyMap[key].push(enemy)
  }

  const isSelectedTower = (rowIndex, colIndex) =>
    selectedTower !== null &&
    selectedTower.row === rowIndex &&
    selectedTower.col === colIndex

  const COLS = tiles[0]?.length ?? 20
  const ROWS = tiles.length

  return (
    <div className="game-board-wrapper">
      <div className="game-board">
        {tiles.map((row, rowIndex) =>
          row.map((tileType, colIndex) => {
            const key = `${rowIndex}-${colIndex}`
            const tower = towerMap[key]
            const hasTower = Boolean(tower)
            const tileEnemies = enemyMap[key] || []
            const showPanel = hasTower && isSelectedTower(rowIndex, colIndex)

            const handleClick = () => {
              if (hasTower) {
                if (onTowerClick) onTowerClick(rowIndex, colIndex)
              } else {
                onTileClick(rowIndex, colIndex)
              }
            }

            return (
              <div
                key={key}
                className={`tile ${tileType}`}
                onClick={handleClick}
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
                {showPanel && (
                  <UpgradePanel
                    tower={tower}
                    gold={gold}
                    onUpgrade={onUpgrade}
                    getUpgradeCost={getUpgradeCost}
                    canUpgrade={canUpgrade}
                    getNextUpgradeStats={getNextUpgradeStats}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
      {projectiles.length > 0 && (
        <svg
          className="projectile-layer"
          width={COLS * TILE_PX}
          height={ROWS * TILE_PX}
          aria-hidden="true"
        >
          {projectiles.map(p => (
            <line
              key={p.id}
              className="projectile"
              x1={(p.fromCol + 0.5) * TILE_PX}
              y1={(p.fromRow + 0.5) * TILE_PX}
              x2={(p.toCol + 0.5) * TILE_PX}
              y2={(p.toRow + 0.5) * TILE_PX}
            />
          ))}
        </svg>
      )}
    </div>
  )
}

export default GameBoard
