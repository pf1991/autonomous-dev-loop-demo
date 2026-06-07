/**
 * GameBoard — CSS-grid tile map component.
 * Renders a 20×15 grid of <div> tiles.
 * Accepts:
 *   tiles          — 2D array (15 rows × 20 cols) of tile-type strings
 *   onTileClick    — callback(row, col) invoked when an empty tower-slot tile is clicked
 *   onTowerClick   — callback(row, col) invoked when a tile with a tower is clicked
 *   towers         — array of tower objects { row, col, type, upgradeLevel, range, damage, fireRate } to render as overlays
 *   enemies        — array of enemy objects { pos: { row, col }, hp, maxHp } to render as overlays
 *   selectedTower  — { row, col } | null — the currently-selected tower for upgrade panel
 *   gold           — current gold (number), used to determine if upgrade button should be enabled
 *   onUpgrade      — callback(row, col) invoked when Upgrade button is clicked
 *   getUpgradeCost — function(tower) returning the upgrade cost (number | null)
 *   canUpgrade     — function(tower) returning boolean
 */
function GameBoard({
  tiles,
  onTileClick,
  onTowerClick,
  towers = [],
  enemies = [],
  selectedTower = null,
  gold = 0,
  onUpgrade,
  getUpgradeCost,
  canUpgrade,
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

  return (
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
                />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

/**
 * UpgradePanel — shown inside a tile when a tower is selected.
 * Displays current stats, next-level stats, and an "Upgrade (N gold)" button.
 */
function UpgradePanel({ tower, gold, onUpgrade, getUpgradeCost, canUpgrade }) {
  const upgradable = canUpgrade ? canUpgrade(tower) : false
  const cost = getUpgradeCost ? getUpgradeCost(tower) : null
  const canAffordUpgrade = upgradable && cost !== null && gold >= cost

  return (
    <div className="upgrade-panel" onClick={e => e.stopPropagation()}>
      <div className="upgrade-panel-header">
        Lv {tower.upgradeLevel} {tower.type}
      </div>
      <div className="upgrade-panel-stats">
        <span>Dmg: {tower.damage}</span>
        <span>Range: {tower.range}</span>
        <span>Rate: {tower.fireRate}</span>
      </div>
      {upgradable && cost !== null && (
        <button
          className="upgrade-panel-btn"
          disabled={!canAffordUpgrade}
          onClick={() => onUpgrade && onUpgrade(tower.row, tower.col)}
        >
          Upgrade ({cost} gold)
        </button>
      )}
      {!upgradable && (
        <div className="upgrade-panel-max">Max Level</div>
      )}
    </div>
  )
}

export default GameBoard
