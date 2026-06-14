import UpgradePanel from './UpgradePanel.jsx'
import WaveCountdownBanner from './WaveCountdownBanner.jsx'
import { getEnemyRadius, isEnemyPoisoned } from '../game/enemy.js'
import { TOWER_TYPES, towerKey } from '../game/tower.js'

// Tile size in pixels — must match the CSS (.tile width/height)
const TILE_PX = 40

/**
 * killBadgeClass — returns the CSS modifier class for the kill-count badge
 * based on the tower's lifetime kill count.
 *
 * Tiers:
 *   1–9   → grey   (.tower-kill-badge--grey)
 *   10–24 → green  (.tower-kill-badge--green)
 *   25–49 → blue   (.tower-kill-badge--blue)
 *   50+   → gold   (.tower-kill-badge--gold)
 */
function killBadgeClass(kills) {
  if (kills >= 50) return 'tower-kill-badge tower-kill-badge--gold'
  if (kills >= 25) return 'tower-kill-badge tower-kill-badge--blue'
  if (kills >= 10) return 'tower-kill-badge tower-kill-badge--green'
  return 'tower-kill-badge tower-kill-badge--grey'
}

/**
 * hexPoints returns an SVG polygon points string for a regular hexagon.
 * @param {number} cx - centre x
 * @param {number} cy - centre y
 * @param {number} r  - radius
 * @returns {string}
 */
function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

/**
 * Render an SVG tower icon based on tower type and upgrade level.
 *
 * BasicTower:  teal diamond; rings added at upgrade levels 1 and 2.
 * SniperTower: red upward-pointing triangle.
 * RapidTower:  orange star/burst — four small diamonds arranged in a cross.
 * CannonTower: dark-grey filled circle with a lighter outer ring at upgrade levels.
 * SlowTower:   blue/cyan hexagon (six-sided polygon).
 *
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

  if (type === 'RapidTower') {
    // Four small rotated squares in a cross pattern — conveying rapid-fire speed
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <rect className="tower-rapid" x="12" y="2"  width="6" height="6"  transform="rotate(45 15 5)"  />
          <rect className="tower-rapid" x="12" y="22" width="6" height="6"  transform="rotate(45 15 25)" />
          <rect className="tower-rapid" x="2"  y="12" width="6" height="6"  transform="rotate(45 5  15)" />
          <rect className="tower-rapid" x="22" y="12" width="6" height="6"  transform="rotate(45 25 15)" />
          <rect className="tower-rapid" x="11" y="11" width="8" height="8"  transform="rotate(45 15 15)" />
        </svg>
      </span>
    )
  }

  if (type === 'CannonTower') {
    // Filled dark circle with optional upgrade rings
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <circle className="tower-cannon" cx="15" cy="15" r="9" />
          {upgradeLevel >= 1 && (
            <circle className="tower-cannon-ring" cx="15" cy="15" r="12" />
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-cannon-ring" cx="15" cy="15" r="14" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'SlowTower') {
    // Hexagon shape — conveys an area/aura effect
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <polygon className="tower-slow" points="15,2 26,8 26,22 15,28 4,22 4,8" />
          {upgradeLevel >= 1 && (
            <polygon className="tower-slow-ring" points="15,0 28,7 28,23 15,30 2,23 2,7" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'MortarTower') {
    // Dark-grey octagon — represents the mortar barrel opening viewed from above
    // An octagon has 8 sides; points computed for a 30×30 viewBox centred at (15,15)
    // with radius 12: offset corners at ±5 and ±12 from centre.
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <polygon
            className="tower-mortar"
            points="10,3 20,3 27,10 27,20 20,27 10,27 3,20 3,10"
          />
          {upgradeLevel >= 1 && (
            <polygon
              className="tower-mortar-ring"
              points="10,1 20,1 29,10 29,20 20,29 10,29 1,20 1,10"
            />
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-mortar-core" cx="15" cy="15" r="4" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'PoisonTower') {
    // Rounded pentagon shape — conveys a biological/poison effect
    // Pentagon points at top, slight rounding via rx/ry on the polygon container
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <polygon className="tower-poison" points="15,2 27,11 22,26 8,26 3,11" />
          {upgradeLevel >= 1 && (
            <circle className="tower-poison-ring" cx="15" cy="16" r="5" />
          )}
          {upgradeLevel >= 2 && (
            <polygon className="tower-poison-ring-outer" points="15,0 29,10 24,28 6,28 1,10" />
          )}
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
 *   powerCrates    — array of { id, row, col } crate objects dropped by boss enemies
 *   onCrateClick   — callback(crateId) invoked when a power crate is clicked
 *   countdownIsBossWave — boolean: true when the upcoming wave is a boss wave
 */
function GameBoard({
  tiles,
  onTileClick,
  onTowerClick,
  onDeselect,
  towers = [],
  enemies = [],
  projectiles = [],
  deathAnimations = [],
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
  adjacencySynergies = null,
  powerCrates = [],
  onCrateClick,
  showCountdownBanner = false,
  countdownWave = 2,
  countdownEnemyCount = 5,
  countdownEnemyHp = 100,
  countdownIsBossWave = false,
  countdownEventType = 'normal',
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
                if (onDeselect) onDeselect()
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
                {hasTower && tower.upgradeLevel > 0 && (
                  <span className="tower-level-badge">
                    {tower.upgradeLevel === 1 ? 'I' : 'II'}
                  </span>
                )}
                {hasTower && (tower.kills ?? 0) >= 1 && (
                  <span className={killBadgeClass(tower.kills)}>
                    &#x2694;&#xFE0E; {tower.kills}
                  </span>
                )}
                {hasTower && (() => {
                  const synergies = adjacencySynergies ? (adjacencySynergies.get(towerKey(tower)) ?? []) : []
                  return synergies.length > 0 ? (
                    <span className="tower-synergy-badge" title={synergies.map(s => s.description).join('; ')}>
                      &#x26A1;
                    </span>
                  ) : null
                })()}
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
                    synergies={adjacencySynergies ? (adjacencySynergies.get(towerKey(tower)) ?? []) : []}
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
        // 2. Fire-radius ring — a placed tower is selected: use tower.range (orange-red "fire" colour)
        let hoverCx = null
        let hoverCy = null
        let hoverR = null
        let fireCx = null
        let fireCy = null
        let fireR = null

        if (hoveredSlot !== null) {
          const typeDef = TOWER_TYPES[selectedTowerType]
          if (typeDef) {
            hoverCx = (hoveredSlot.col + 0.5) * TILE_PX
            hoverCy = (hoveredSlot.row + 0.5) * TILE_PX
            hoverR = typeDef.range * TILE_PX
          }
        }

        if (selectedTower !== null) {
          const key = `${selectedTower.row}-${selectedTower.col}`
          const t = towerMap[key]
          if (t) {
            fireCx = (t.col + 0.5) * TILE_PX
            fireCy = (t.row + 0.5) * TILE_PX
            fireR = t.range * TILE_PX
          }
        }

        const showSvg = projectiles.length > 0 || hoverR !== null || fireR !== null
        if (!showSvg) return null

        return (
          <svg
            className="projectile-layer"
            width={COLS * TILE_PX}
            height={ROWS * TILE_PX}
            aria-hidden="true"
          >
            {hoverR !== null && (
              <circle
                className="range-preview-ring"
                cx={hoverCx}
                cy={hoverCy}
                r={hoverR}
              />
            )}
            {fireR !== null && (
              <circle
                className="fire-radius-ring"
                cx={fireCx}
                cy={fireCy}
                r={fireR}
              />
            )}
            {projectiles.map(p => {
              const typeSlug = p.towerType
                ? p.towerType.replace('Tower', '').toLowerCase()
                : 'basic'
              const lvl = p.upgradeLevel ?? 0
              const levelSuffix = lvl >= 2 ? '-lv2' : lvl >= 1 ? '-lv1' : ''

              // MortarTower: render as an orange filled circle that expands to the splash radius
              if (p.towerType === 'MortarTower') {
                const cx = (p.toCol + 0.5) * TILE_PX
                const cy = (p.toRow + 0.5) * TILE_PX
                const splashPx = (p.splashRadius ?? 1.5) * TILE_PX
                return (
                  <circle
                    key={p.id}
                    className={`projectile-mortar-shell${levelSuffix}`}
                    cx={cx}
                    cy={cy}
                    r={splashPx}
                  />
                )
              }

              const className = `projectile projectile-${typeSlug}${levelSuffix}`
              return (
                <line
                  key={p.id}
                  className={className}
                  x1={(p.fromCol + 0.5) * TILE_PX}
                  y1={(p.fromRow + 0.5) * TILE_PX}
                  x2={(p.toCol + 0.5) * TILE_PX}
                  y2={(p.toRow + 0.5) * TILE_PX}
                />
              )
            })}
          </svg>
        )
      })()}
      {enemies.length > 0 && (
        <div className="enemy-layer" aria-hidden="true">
          {enemies.map(enemy => {
            const radius = getEnemyRadius(enemy.hp, enemy.maxHp, enemy.type)
            const left = (enemy.pos.col + 0.5) * TILE_PX - radius
            const top = (enemy.pos.row + 0.5) * TILE_PX - radius
            const diameter = radius * 2
            if (enemy.type === 'colossus') {
              // Colossus: purple hexagon SVG with skull overlay and thick HP bar
              const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100)
              return (
                <div
                  key={enemy.id}
                  className="enemy-colossus-wrapper"
                  style={{ left, top, width: diameter, height: diameter }}
                >
                  <svg
                    className="enemy-colossus"
                    width={diameter}
                    height={diameter}
                    viewBox={`0 0 ${diameter} ${diameter}`}
                    aria-hidden="true"
                  >
                    <polygon
                      className="enemy-colossus-hex"
                      points={hexPoints(diameter / 2, diameter / 2, diameter / 2 - 2)}
                    />
                    <text
                      className="enemy-colossus-skull"
                      x={diameter / 2}
                      y={diameter / 2 + 6}
                      textAnchor="middle"
                    >&#x2620;</text>
                  </svg>
                  <div className="enemy-colossus-hp-bar-bg">
                    <div
                      className="enemy-colossus-hp-bar"
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                </div>
              )
            }

            const typeClassMap = {
              grunt: 'enemy-grunt',
              tank: 'enemy-tank',
              speeder: 'enemy-speeder',
              armored: 'enemy-armored',
              phantom: 'enemy-phantom',
              healer: 'enemy-healer',
              splitter: 'enemy-splitter',
              shielded: 'enemy-shielded',
            }
            const typeClass = typeClassMap[enemy.type] ?? 'enemy-grunt'
            const isSlowed = enemy.slowUntil != null
            const isPoisoned = isEnemyPoisoned(enemy)
            const stealthClass = enemy.stealth ? ' enemy-stealth' : ' enemy-visible'
            const statusClass = (isSlowed ? ' enemy-slowed' : isPoisoned ? ' enemy-poisoned' : '') + stealthClass
            return (
              <div
                key={enemy.id}
                className={`enemy ${typeClass}${statusClass}`}
                style={{ left, top, width: diameter, height: diameter }}
              >
                <div
                  className={isPoisoned ? 'enemy-hp-bar enemy-hp-bar--poisoned' : 'enemy-hp-bar'}
                  style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }}
                />
                {enemy.type === 'healer' && (
                  <svg className="enemy-ability-overlay" width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} aria-hidden="true">
                    <text className="enemy-healer-cross" x={diameter / 2} y={diameter / 2 - diameter * 0.35} textAnchor="middle" dominantBaseline="central" fontSize={diameter * 0.45} fontWeight="bold">+</text>
                  </svg>
                )}
                {enemy.type === 'splitter' && (
                  <svg className="enemy-ability-overlay" width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} aria-hidden="true">
                    <line className="enemy-splitter-line" x1={diameter * 0.25} y1={diameter * 0.25} x2={diameter * 0.75} y2={diameter * 0.75} />
                  </svg>
                )}
                {enemy.type === 'shielded' && (
                  <svg className="enemy-ability-overlay" width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} aria-hidden="true">
                    <path className="enemy-shielded-icon" d={`M${diameter/2},${diameter*0.15} L${diameter*0.75},${diameter*0.3} L${diameter*0.75},${diameter*0.55} Q${diameter/2},${diameter*0.85} ${diameter*0.25},${diameter*0.55} L${diameter*0.25},${diameter*0.3} Z`} />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      )}
      {deathAnimations.length > 0 && (
        <div className="death-animation-layer" aria-hidden="true">
          {deathAnimations.map(anim => (
            <div
              key={anim.id}
              className="death-gold-label"
              style={{
                left: (anim.col + 0.5) * TILE_PX,
                top: (anim.row + 0.5) * TILE_PX,
              }}
            >
              +{anim.gold}
            </div>
          ))}
        </div>
      )}
      {powerCrates.length > 0 && (
        <div className="power-crate-layer" aria-label="power crates">
          {powerCrates.map(crate => (
            <div
              key={crate.id}
              className="power-crate"
              style={{
                left: (crate.col + 0.5) * TILE_PX,
                top: (crate.row + 0.5) * TILE_PX,
              }}
              onClick={() => onCrateClick && onCrateClick(crate.id)}
              role="button"
              aria-label="power crate"
            />
          ))}
        </div>
      )}
      {showCountdownBanner && (
        <WaveCountdownBanner
          wave={countdownWave}
          enemyCount={countdownEnemyCount}
          enemyHp={countdownEnemyHp}
          isBossWave={countdownIsBossWave}
          eventType={countdownEventType}
          onStart={onCountdownStart}
        />
      )}
    </div>
  )
}

export default GameBoard
