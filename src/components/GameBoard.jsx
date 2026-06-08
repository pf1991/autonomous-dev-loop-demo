import UpgradePanel from './UpgradePanel.jsx'
import WaveCountdownBanner from './WaveCountdownBanner.jsx'
import { getEnemyRadius } from '../game/enemy.js'
import { TOWER_TYPES } from '../game/tower.js'

// Tile size in pixels — must match the CSS (.tile width/height)
const TILE_PX = 40

/**
 * Render an SVG tower icon based on tower type and upgrade level.
 * BasicTower: filled teal square (28×28) rotated 45° (diamond).
 *   level 1 adds an inner ring, level 2 adds a second ring.
 * SniperTower: filled red upward-pointing triangle (SVG polygon, 30 px tall).
 * The container keeps .tower-icon for E2E selector compatibility.
 */
function TowerSVG({ type, upgradeLevel }) {
  if (type === 'SniperTower') {
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <polygon className="tower-sniper" points="15,2 28,28 2,28" />
        </svg>
      </span>
    )
  }
  // BasicTower — teal diamond with optional inner rings for upgrade levels
  return (
    <span className="tower-icon">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect className="tower-basic" x="7" y="7" width="16" height="16" transform="rotate(45 15 15)" />
        {upgradeLevel >= 1 && (
          <rect className="tower-basic-ring" x="4" y="4" width="22" height="22" transform="rotate(45 15 15)" />
        )}
        {upgradeLevel >= 2 && (
          <rect className="tower-basic-ring" x="1" y="1" width="28" height="28" transform="rotate(45 15 15)" />
        )}
      </svg>
    </span>
  )
}

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
  hoveredSlot = null,
  onHoverSlot,
  selectedTowerType = 'BasicTower',
  gold = 0,
  onUpgrade,
  onSell,
  getUpgradeCost,
  canUpgrade,
  getNextUpgradeStats,
  sellTower,
  showCountdownBanner = false,
  countdownWave = 2,
  countdownEnemyCount = 5,
  countdownEnemyHp = 100,
  onCountdownStart,
}) {
  // Build a map from "row-col" key to tower object for O(1) lookup
  const towerMap = {}
  for (const t of towers) {
    towerMap[`${t.row}-${t.col}`] = t
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
            const showPanel = hasTower && isSelectedTower(rowIndex, colIndex)

            const handleClick = () => {
              if (hasTower) {
                if (onTowerClick) onTowerClick(rowIndex, colIndex)
              } else {
                onTileClick(rowIndex, colIndex)
              }
            }

            const isTowerSlot = tileType === 'tower-slot'
            const handleMouseEnter = () => {
              if (isTowerSlot && !hasTower && onHoverSlot) {
                onHoverSlot({ row: rowIndex, col: colIndex })
              }
            }
            const handleMouseLeave = () => {
              if (isTowerSlot && !hasTower && onHoverSlot) {
                onHoverSlot(null)
              }
            }

            return (
              <div
                key={key}
                className={`tile ${tileType}`}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {hasTower && <TowerSVG type={tower.type} upgradeLevel={tower.upgradeLevel} />}
                {showPanel && (
                  <UpgradePanel
                    tower={tower}
                    gold={gold}
                    onUpgrade={onUpgrade}
                    onSell={onSell}
                    getUpgradeCost={getUpgradeCost}
                    canUpgrade={canUpgrade}
                    getNextUpgradeStats={getNextUpgradeStats}
                    sellTower={sellTower}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
      {(() => {
        // Determine range ring parameters:
        // 1. Hover ring — empty tower-slot hovered: use selected tower type's range
        // 2. Selected tower ring — a placed tower is selected: use tower.range
        let ringCx = null
        let ringCy = null
        let ringR = null

        if (hoveredSlot !== null) {
          const typeDef = TOWER_TYPES[selectedTowerType]
          if (typeDef) {
            ringCx = (hoveredSlot.col + 0.5) * TILE_PX
            ringCy = (hoveredSlot.row + 0.5) * TILE_PX
            ringR = typeDef.range * TILE_PX
          }
        } else if (selectedTower !== null) {
          const key = `${selectedTower.row}-${selectedTower.col}`
          const t = towerMap[key]
          if (t) {
            ringCx = (t.col + 0.5) * TILE_PX
            ringCy = (t.row + 0.5) * TILE_PX
            ringR = t.range * TILE_PX
          }
        }

        const showSvg = projectiles.length > 0 || ringR !== null
        if (!showSvg) return null

        return (
          <svg
            className="projectile-layer"
            width={COLS * TILE_PX}
            height={ROWS * TILE_PX}
            aria-hidden="true"
          >
            {ringR !== null && (
              <circle
                className="range-preview-ring"
                cx={ringCx}
                cy={ringCy}
                r={ringR}
              />
            )}
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
        )
      })()}
      {enemies.length > 0 && (
        <div className="enemy-layer" aria-hidden="true">
          {enemies.map(enemy => {
            const radius = getEnemyRadius(enemy.hp, enemy.maxHp)
            const left = (enemy.pos.col + 0.5) * TILE_PX - radius
            const top = (enemy.pos.row + 0.5) * TILE_PX - radius
            const diameter = radius * 2
            return (
              <div
                key={enemy.id}
                className="enemy"
                style={{ left, top, width: diameter, height: diameter }}
              >
                <div
                  className="enemy-hp-bar"
                  style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
      )}
      {showCountdownBanner && (
        <WaveCountdownBanner
          wave={countdownWave}
          enemyCount={countdownEnemyCount}
          enemyHp={countdownEnemyHp}
          onStart={onCountdownStart}
        />
      )}
    </div>
  )
}

export default GameBoard
