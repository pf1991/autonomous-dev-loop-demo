import { useState } from 'react'
import UpgradePanel from './UpgradePanel.jsx'
import WaveCountdownBanner from './WaveCountdownBanner.jsx'
import { getEnemyRadius, isEnemyPoisoned, isEnemyFrozen, isEnemySlowed } from '../game/enemy.js'
import { TOWER_TYPES, towerKey } from '../game/tower.js'

// Default tile size in pixels — overridden by the tileSize prop from App.jsx
const DEFAULT_TILE_PX = 40

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
 * Each tower has a unique, recognisable silhouette — identifiable without colour:
 *
 * BasicTower:  short cannon barrel pointing right (rect body + wider muzzle)
 * SniperTower: long thin rifle barrel with a circular scope
 * RapidTower:  three parallel barrels in a gatling configuration
 * CannonTower: wide-mouthed artillery piece — squat body + wide flared muzzle
 * SlowTower:   snowflake / ice crystal (six radiating arms)
 * MortarTower: angled mortar tube with a rectangular base plate
 * PoisonTower: flask / beaker with dripping liquid (rounded body, narrow neck)
 *
 * The container keeps .tower-icon for E2E selector compatibility.
 * Upgrade level indicators (rings/highlights) remain to show progression.
 */
function TowerSVG({ type, upgradeLevel }) {
  if (type === 'BasicTower') {
    // Short cannon: square base + barrel pointing right
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Base / body */}
          <rect className="tower-basic" x="6" y="11" width="12" height="8" rx="1" />
          {/* Barrel pointing right */}
          <rect className="tower-basic" x="16" y="13" width="9" height="4" rx="1" />
          {/* Muzzle tip */}
          <rect className="tower-basic-muzzle" x="24" y="12" width="2" height="6" rx="1" />
          {/* Upgrade ring — glowing outline at L1 */}
          {upgradeLevel >= 1 && (
            <rect className="tower-basic-ring" x="5" y="10" width="21" height="10" rx="2" />
          )}
          {/* Second upgrade ring at L2 */}
          {upgradeLevel >= 2 && (
            <circle className="tower-basic-ring" cx="15" cy="15" r="13" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'SniperTower') {
    // Long thin rifle: narrow barrel + circular scope + small stock
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Long barrel */}
          <rect className="tower-sniper" x="4" y="14" width="22" height="2" rx="1" />
          {/* Scope circle (sits above barrel) */}
          <circle className="tower-sniper" cx="18" cy="11" r="4" />
          <circle className="tower-sniper-lens" cx="18" cy="11" r="2" />
          {/* Stock / grip below barrel */}
          <rect className="tower-sniper" x="6" y="16" width="5" height="5" rx="1" />
          {/* Upgrade: cross-hairs inside scope at L1+ */}
          {upgradeLevel >= 1 && (
            <>
              <line className="tower-sniper-crosshair" x1="18" y1="8" x2="18" y2="14" />
              <line className="tower-sniper-crosshair" x1="15" y1="11" x2="21" y2="11" />
            </>
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-sniper-ring" cx="18" cy="11" r="5.5" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'RapidTower') {
    // Gatling: three thin parallel barrels pointing right from a central hub
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Hub */}
          <circle className="tower-rapid-hub" cx="10" cy="15" r="5" />
          {/* Top barrel */}
          <rect className="tower-rapid" x="10" y="8"  width="16" height="3" rx="1" />
          {/* Middle barrel */}
          <rect className="tower-rapid" x="10" y="13" width="18" height="3" rx="1" />
          {/* Bottom barrel */}
          <rect className="tower-rapid" x="10" y="18" width="16" height="3" rx="1" />
          {/* Upgrade: muzzle highlights at L1+ */}
          {upgradeLevel >= 1 && (
            <>
              <rect className="tower-rapid-muzzle" x="25" y="8"  width="2" height="3" rx="1" />
              <rect className="tower-rapid-muzzle" x="27" y="13" width="2" height="3" rx="1" />
              <rect className="tower-rapid-muzzle" x="25" y="18" width="2" height="3" rx="1" />
            </>
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-rapid-ring" cx="10" cy="15" r="7" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'CannonTower') {
    // Wide-mouthed artillery: squat round body + very wide flared muzzle
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Round body */}
          <circle className="tower-cannon" cx="12" cy="15" r="8" />
          {/* Barrel */}
          <rect className="tower-cannon" x="17" y="13" width="7" height="4" rx="1" />
          {/* Wide flared muzzle */}
          <path className="tower-cannon-muzzle" d="M23,11 L27,11 L28,19 L23,19 Z" />
          {upgradeLevel >= 1 && (
            <circle className="tower-cannon-ring" cx="12" cy="15" r="10" />
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-cannon-ring" cx="12" cy="15" r="12" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'SlowTower') {
    // Snowflake / ice crystal: six radiating arms with small tips
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Central circle */}
          <circle className="tower-slow" cx="15" cy="15" r="3" />
          {/* Six arms at 0°, 60°, 120°, 180°, 240°, 300° */}
          <line className="tower-slow-arm" x1="15" y1="15" x2="15" y2="4" />
          <line className="tower-slow-arm" x1="15" y1="15" x2="15" y2="26" />
          <line className="tower-slow-arm" x1="15" y1="15" x2="24.5" y2="9.5" />
          <line className="tower-slow-arm" x1="15" y1="15" x2="5.5" y2="20.5" />
          <line className="tower-slow-arm" x1="15" y1="15" x2="5.5" y2="9.5" />
          <line className="tower-slow-arm" x1="15" y1="15" x2="24.5" y2="20.5" />
          {/* Tip diamonds */}
          <rect className="tower-slow" x="13.5" y="2.5" width="3" height="3" transform="rotate(45 15 4)" />
          <rect className="tower-slow" x="13.5" y="24.5" width="3" height="3" transform="rotate(45 15 26)" />
          <rect className="tower-slow" x="22.5" y="7.5" width="3" height="3" transform="rotate(45 24 9.5)" />
          <rect className="tower-slow" x="3.5" y="18.5" width="3" height="3" transform="rotate(45 5 20.5)" />
          <rect className="tower-slow" x="3.5" y="7.5" width="3" height="3" transform="rotate(45 5 9.5)" />
          <rect className="tower-slow" x="22.5" y="18.5" width="3" height="3" transform="rotate(45 24 20.5)" />
          {upgradeLevel >= 1 && (
            <circle className="tower-slow-ring" cx="15" cy="15" r="13" />
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-slow-ring" cx="15" cy="15" r="14.5" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'MortarTower') {
    // Angled mortar tube: rectangular base plate + angled barrel tube
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Base plate */}
          <rect className="tower-mortar" x="4" y="22" width="22" height="5" rx="1" />
          {/* Angled barrel (rotated ~45° pointing upper-right) */}
          <rect className="tower-mortar" x="12" y="7" width="5" height="16" rx="2" transform="rotate(-30 14 15)" />
          {/* Barrel opening circle */}
          <circle className="tower-mortar-opening" cx="20" cy="7" r="3" />
          {upgradeLevel >= 1 && (
            <circle className="tower-mortar-ring" cx="20" cy="7" r="5" />
          )}
          {upgradeLevel >= 2 && (
            <circle className="tower-mortar-core" cx="14" cy="21" r="3" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'PoisonTower') {
    // Flask / beaker: rounded body, narrow neck, drip drops
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Flask body */}
          <ellipse className="tower-poison" cx="15" cy="20" rx="9" ry="8" />
          {/* Neck */}
          <rect className="tower-poison" x="12" y="8" width="6" height="8" rx="1" />
          {/* Stopper / rim */}
          <rect className="tower-poison-stopper" x="10" y="6" width="10" height="3" rx="1" />
          {/* Drip drop */}
          <ellipse className="tower-poison-drop" cx="15" cy="28" rx="2" ry="2.5" />
          {upgradeLevel >= 1 && (
            <>
              <ellipse className="tower-poison-drop" cx="9" cy="27" rx="1.5" ry="2" />
              <ellipse className="tower-poison-drop" cx="21" cy="27" rx="1.5" ry="2" />
            </>
          )}
          {upgradeLevel >= 2 && (
            <ellipse className="tower-poison-ring" cx="15" cy="20" rx="11" ry="10" />
          )}
        </svg>
      </span>
    )
  }

  if (type === 'LightningTower') {
    // Lightning bolt: jagged downward-pointing bolt with an orb at the top emitter
    return (
      <span className="tower-icon">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          {/* Emitter orb */}
          <circle className="tower-lightning-orb" cx="15" cy="7" r="4" />
          {/* Jagged lightning bolt pointing downward */}
          <polyline
            className="tower-lightning-bolt"
            points="15,11 10,17 14,17 9,25 20,16 15,16 20,11"
          />
          {/* Upgrade: outer glow ring at L1 */}
          {upgradeLevel >= 1 && (
            <circle className="tower-lightning-ring" cx="15" cy="7" r="6" />
          )}
          {/* Second ring at L2 */}
          {upgradeLevel >= 2 && (
            <circle className="tower-lightning-ring" cx="15" cy="7" r="8" />
          )}
        </svg>
      </span>
    )
  }

  // Fallback — should never reach here
  return (
    <span className="tower-icon">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect className="tower-basic" x="7" y="7" width="16" height="16" rx="2" />
      </svg>
    </span>
  )
}

/**
 * cooldownBarClass — returns the CSS colour modifier for a tower's cooldown bar.
 * @param {string} type - tower type string
 * @returns {string}
 */
function cooldownBarClass(type) {
  const map = {
    BasicTower:     'tower-cooldown-bar--basic',
    SniperTower:    'tower-cooldown-bar--sniper',
    RapidTower:     'tower-cooldown-bar--rapid',
    CannonTower:    'tower-cooldown-bar--cannon',
    SlowTower:      'tower-cooldown-bar--slow',
    MortarTower:    'tower-cooldown-bar--mortar',
    PoisonTower:    'tower-cooldown-bar--poison',
    LightningTower: 'tower-cooldown-bar--lightning',
  }
  return map[type] ?? 'tower-cooldown-bar--basic'
}

/**
 * GameBoard — CSS-grid tile map component.
 * Renders a 20×15 grid of <div> tiles.
 * Accepts:
 *   tiles          — 2D array (15 rows × 20 cols) of tile-type strings
 *   onTileClick    — callback(row, col) invoked when an empty tower-slot tile is clicked
 *   onTowerClick   — callback(row, col) invoked when a tile with a tower is clicked
 *   towers         — array of tower objects { row, col, type, upgradeLevel, range, damage, fireRate, lastFiredAt } to render as overlays
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
 *   damageNumbers  — array of { id, value, row, col, expiresAt } for floating crit damage labels
 */
function GameBoard({
  tileSize = DEFAULT_TILE_PX,
  tiles,
  onTileClick,
  onTowerClick,
  onDeselect,
  towers = [],
  enemies = [],
  projectiles = [],
  deathAnimations = [],
  deathParticles = [],
  damageNumbers = [],
  poisonPuffs = [],
  placementPulses = [],
  screenShakeActive = false,
  selectedTower = null,
  hoveredSlot = null,
  onHoverSlot,
  hoverTowerType = null,
  selectedTowerType = 'BasicTower',
  gold = 0,
  onUpgrade,
  onSell,
  getUpgradeCost,
  canUpgrade,
  getNextUpgradeStats,
  getUpgradePreview,
  sellTower,
  maxGold = 9999,
  adjacencySynergies = null,
  synergyPartners = null,
  showSynergies = false,
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
  // Use the prop-driven tile size so all pixel calculations scale with viewport
  const TILE_PX = tileSize
  // hoveredTower: { row, col } | null — the tower tile the cursor is currently over
  const [hoveredTower, setHoveredTower] = useState(null)

  // Build a map from "row-col" key to tower object for O(1) lookup
  const towerMap = {}
  for (const t of towers) {
    towerMap[`${t.row}-${t.col}`] = t
  }

  // Synergy line color per effectType
  const SYNERGY_COLORS = {
    fireRate: '#00e5cc', // teal
    freeze:   '#ff4444', // red
    poison:   '#44dd44', // green
    range:    '#4488ff', // blue
  }

  // Active synergy focus: selected tower > hovered tower (neither if global overlay)
  const focusTower = selectedTower ?? hoveredTower

  // Partner tile keys for the focused tower (for border ring highlighting)
  const partnerKeys = new Set()
  if (synergyPartners && focusTower) {
    const key = `${focusTower.row}-${focusTower.col}`
    const partners = synergyPartners.get(key) ?? []
    for (const p of partners) {
      partnerKeys.add(`${p.partnerRow}-${p.partnerCol}`)
    }
  }

  const isSelectedTower = (rowIndex, colIndex) =>
    selectedTower !== null &&
    selectedTower.row === rowIndex &&
    selectedTower.col === colIndex

  const COLS = tiles[0]?.length ?? 20
  const ROWS = tiles.length

  return (
    <div className={`game-board-wrapper${screenShakeActive ? ' screen-shake' : ''}`}>
      <div className="game-board" style={{ '--tile-size': `${TILE_PX}px` }}>
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
              if (hasTower) {
                setHoveredTower({ row: rowIndex, col: colIndex })
              }
            }
            const handleMouseLeave = () => {
              if (isTowerSlot && !hasTower && onHoverSlot) {
                onHoverSlot(null)
              }
              if (hasTower) {
                setHoveredTower(null)
              }
            }

            // Partner ring: highlight this tile if it's a synergy partner of the focused tower
            const isPartner = partnerKeys.has(key)
            // Determine partner ring color from the focused tower's synergy list
            let partnerRingColor = null
            if (isPartner && synergyPartners && focusTower) {
              const focusKey = `${focusTower.row}-${focusTower.col}`
              const partners = synergyPartners.get(focusKey) ?? []
              const match = partners.find(p => p.partnerRow === rowIndex && p.partnerCol === colIndex)
              if (match) partnerRingColor = SYNERGY_COLORS[match.effectType] ?? null
            }

            // Enriched synergies for UpgradePanel: include partner position from synergyPartners
            const upgradePanelSynergies = synergyPartners
              ? (synergyPartners.get(towerKey({ row: rowIndex, col: colIndex })) ?? [])
              : (adjacencySynergies ? (adjacencySynergies.get(towerKey({ row: rowIndex, col: colIndex })) ?? []) : [])

            return (
              <div
                key={key}
                className={`tile ${tileType}`}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={isPartner && partnerRingColor ? { outline: `2px solid ${partnerRingColor}`, outlineOffset: '-2px' } : undefined}
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
                {hasTower && (() => {
                  const fireInterval = 1000 / tower.fireRate
                  const fraction = Math.min(1, (Date.now() - tower.lastFiredAt) / fireInterval)
                  const isIdle = fraction >= 1
                  const colourClass = cooldownBarClass(tower.type)
                  const idleClass = isIdle ? ' tower-cooldown-bar--idle' : ''
                  return (
                    <div
                      className={`tower-cooldown-bar ${colourClass}${idleClass}`}
                      style={{ width: `${fraction * 80}%` }}
                    />
                  )
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
                    getUpgradePreview={getUpgradePreview}
                    sellTower={sellTower}
                    maxGold={maxGold}
                    synergies={upgradePanelSynergies}
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

        // Ghost preview ring — shown when hovering a tower type in TowerPicker.
        // Centers on the nearest tower-slot tile under the cursor (hoveredSlot).
        // If no slot is hovered, defaults to center of board so the ring is still visible.
        let ghostCx = null
        let ghostCy = null
        let ghostR = null

        if (hoverTowerType !== null) {
          const ghostTypeDef = TOWER_TYPES[hoverTowerType]
          if (ghostTypeDef) {
            if (hoveredSlot !== null) {
              ghostCx = (hoveredSlot.col + 0.5) * TILE_PX
              ghostCy = (hoveredSlot.row + 0.5) * TILE_PX
            } else {
              // Fall back to board center so the ring appears even before a slot is hovered
              ghostCx = (COLS / 2) * TILE_PX
              ghostCy = (ROWS / 2) * TILE_PX
            }
            ghostR = ghostTypeDef.range * TILE_PX
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

        // Build synergy lines to render
        // Focal lines: from selected/hovered tower to its partners
        const synergyLines = []
        if (synergyPartners && focusTower) {
          const key = `${focusTower.row}-${focusTower.col}`
          const partners = synergyPartners.get(key) ?? []
          for (const p of partners) {
            synergyLines.push({
              id: `focal-${key}-${p.partnerRow}-${p.partnerCol}`,
              x1: (focusTower.col + 0.5) * TILE_PX,
              y1: (focusTower.row + 0.5) * TILE_PX,
              x2: (p.partnerCol + 0.5) * TILE_PX,
              y2: (p.partnerRow + 0.5) * TILE_PX,
              color: SYNERGY_COLORS[p.effectType] ?? '#00e5cc',
            })
          }
        }
        // Global overlay lines: all active synergy pairs
        const globalLines = []
        if (showSynergies && synergyPartners) {
          const seen = new Set()
          for (const [key, partners] of synergyPartners) {
            for (const p of partners) {
              const pairId = [key, `${p.partnerRow}-${p.partnerCol}`].sort().join('|')
              if (seen.has(pairId)) continue
              seen.add(pairId)
              const [srcRow, srcCol] = key.split('-').map(Number)
              globalLines.push({
                id: `global-${pairId}`,
                x1: (srcCol + 0.5) * TILE_PX,
                y1: (srcRow + 0.5) * TILE_PX,
                x2: (p.partnerCol + 0.5) * TILE_PX,
                y2: (p.partnerRow + 0.5) * TILE_PX,
                color: SYNERGY_COLORS[p.effectType] ?? '#00e5cc',
              })
            }
          }
        }

        const showSvg = projectiles.length > 0 || hoverR !== null || fireR !== null || ghostR !== null || placementPulses.length > 0 || synergyLines.length > 0 || globalLines.length > 0
        if (!showSvg) return null

        return (
          <svg
            className="projectile-layer"
            width={COLS * TILE_PX}
            height={ROWS * TILE_PX}
            aria-hidden="true"
          >
            <defs>
              <filter id="synergy-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="lightning-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <style>{`
                @keyframes synergy-dash {
                  from { stroke-dashoffset: 20; }
                  to   { stroke-dashoffset: 0; }
                }
                .synergy-line {
                  stroke-width: 2;
                  stroke-dasharray: 6 4;
                  animation: synergy-dash 0.6s linear infinite;
                  filter: url(#synergy-glow);
                  fill: none;
                  opacity: 0.85;
                }
                @keyframes lightning-flash {
                  0%   { opacity: 1; stroke-width: 3; }
                  50%  { opacity: 0.7; stroke-width: 2; }
                  100% { opacity: 0; stroke-width: 1; }
                }
                .projectile-lightning {
                  stroke: #ffe033;
                  stroke-width: 3;
                  stroke-linecap: round;
                  fill: none;
                  filter: url(#lightning-glow);
                  animation: lightning-flash 0.2s ease-out forwards;
                }
                .projectile-lightning-chain {
                  stroke: #b3d9ff;
                  stroke-width: 2;
                  opacity: 0.8;
                }
              `}</style>
            </defs>
            {/* Global synergy overlay lines */}
            {globalLines.map(l => (
              <line
                key={l.id}
                className="synergy-line"
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={l.color}
                strokeOpacity="0.6"
              />
            ))}
            {/* Focal synergy lines (selected / hovered tower) */}
            {synergyLines.map(l => (
              <line
                key={l.id}
                className="synergy-line"
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={l.color}
              />
            ))}
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
            {ghostR !== null && (
              <circle
                className="ghost-range-ring"
                cx={ghostCx}
                cy={ghostCy}
                r={ghostR}
              />
            )}
            {/* Placement pulse ripple rings */}
            {placementPulses.map(pulse => (
              <circle
                key={pulse.id}
                className="placement-pulse-ring"
                cx={(pulse.col + 0.5) * TILE_PX}
                cy={(pulse.row + 0.5) * TILE_PX}
                r={TILE_PX * 0.5}
              />
            ))}
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

              // LightningTower: render animated SVG bolt lines from tower → primary → chain targets
              if (p.towerType === 'LightningTower') {
                const segments = []
                // Segment 0: tower → primary target
                segments.push({
                  x1: (p.fromCol + 0.5) * TILE_PX,
                  y1: (p.fromRow + 0.5) * TILE_PX,
                  x2: (p.toCol + 0.5) * TILE_PX,
                  y2: (p.toRow + 0.5) * TILE_PX,
                })
                // Chain segments: primary → each chain target in order
                const chainPos = p.chainPositions ?? []
                let prevCol = p.toCol
                let prevRow = p.toRow
                for (const cp of chainPos) {
                  segments.push({
                    x1: (prevCol + 0.5) * TILE_PX,
                    y1: (prevRow + 0.5) * TILE_PX,
                    x2: (cp.col + 0.5) * TILE_PX,
                    y2: (cp.row + 0.5) * TILE_PX,
                  })
                  prevCol = cp.col
                  prevRow = cp.row
                }
                return (
                  <g key={p.id} className="lightning-bolt-group">
                    {segments.map((seg, si) => (
                      <line
                        key={si}
                        className={`projectile-lightning${si > 0 ? ' projectile-lightning-chain' : ''}`}
                        x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                      />
                    ))}
                  </g>
                )
              }

              // Crit projectile: bright yellow, 2× stroke width + 2 fading trail segments
              if (p.isCrit) {
                const x1 = (p.fromCol + 0.5) * TILE_PX
                const y1 = (p.fromRow + 0.5) * TILE_PX
                const x2 = (p.toCol + 0.5) * TILE_PX
                const y2 = (p.toRow + 0.5) * TILE_PX
                const mx1 = x1 + (x2 - x1) * 0.33
                const my1 = y1 + (y2 - y1) * 0.33
                const mx2 = x1 + (x2 - x1) * 0.66
                const my2 = y1 + (y2 - y1) * 0.66
                return (
                  <g key={p.id}>
                    <line className="projectile-trail projectile-trail-crit projectile-trail--far" x1={x1} y1={y1} x2={mx1} y2={my1} />
                    <line className="projectile-trail projectile-trail-crit projectile-trail--mid" x1={mx1} y1={my1} x2={mx2} y2={my2} />
                    <line className="projectile-crit" x1={mx2} y1={my2} x2={x2} y2={y2} />
                  </g>
                )
              }

              const className = `projectile projectile-${typeSlug}${levelSuffix}`
              // Trail: render 2 additional faded segments behind the main shot.
              // They use the 'projectile-trail' class (not 'projectile') so existing tests
              // querying '.projectile' still count only one element per shot.
              const x1 = (p.fromCol + 0.5) * TILE_PX
              const y1 = (p.fromRow + 0.5) * TILE_PX
              const x2 = (p.toCol + 0.5) * TILE_PX
              const y2 = (p.toRow + 0.5) * TILE_PX
              const mx1 = x1 + (x2 - x1) * 0.33
              const my1 = y1 + (y2 - y1) * 0.33
              const mx2 = x1 + (x2 - x1) * 0.66
              const my2 = y1 + (y2 - y1) * 0.66
              return (
                <g key={p.id}>
                  <line className={`projectile-trail projectile-trail-${typeSlug}${levelSuffix} projectile-trail--far`} x1={x1} y1={y1} x2={mx1} y2={my1} />
                  <line className={`projectile-trail projectile-trail-${typeSlug}${levelSuffix} projectile-trail--mid`} x1={mx1} y1={my1} x2={mx2} y2={my2} />
                  <line className={className} x1={mx2} y1={my2} x2={x2} y2={y2} />
                </g>
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
            const isFrozen = isEnemyFrozen(enemy)
            const isSlowed = isEnemySlowed(enemy)
            const isPoisoned = isEnemyPoisoned(enemy)
            const stealthClass = enemy.stealth ? ' enemy-stealth' : ' enemy-visible'
            const critFlashClass = enemy._critFlashAt != null ? ' enemy-crit-flash' : ''
            const statusClass = (isFrozen ? ' enemy--frozen' : isSlowed ? ' enemy--slowed' : '') + (isPoisoned ? ' enemy--poisoned' : '') + stealthClass + critFlashClass
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
                {isFrozen && (
                  <span className="enemy--status-icon enemy--freeze-icon" aria-hidden="true">❄</span>
                )}
                {isPoisoned && (
                  <span className="enemy--poison-drip" aria-hidden="true">• • •</span>
                )}
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
      {/* Death burst particles — 5 dots expanding radially from enemy death position */}
      {deathParticles.length > 0 && (
        <svg
          className="death-particle-layer"
          width={COLS * TILE_PX}
          height={ROWS * TILE_PX}
          aria-hidden="true"
        >
          {deathParticles.map(p => {
            const cx = (p.col + 0.5) * TILE_PX + Math.cos(p.angle) * 10
            const cy = (p.row + 0.5) * TILE_PX + Math.sin(p.angle) * 10
            return (
              <circle
                key={p.id}
                className="death-burst-dot"
                cx={cx}
                cy={cy}
                r={3}
              />
            )
          })}
        </svg>
      )}
      {/* Poison tick puffs — small green circles emitted on each poison DoT tick */}
      {poisonPuffs.length > 0 && (
        <svg
          className="poison-puff-layer"
          width={COLS * TILE_PX}
          height={ROWS * TILE_PX}
          aria-hidden="true"
        >
          {poisonPuffs.map(p => (
            <circle
              key={p.id}
              className="poison-puff-dot"
              cx={(p.col + 0.5) * TILE_PX}
              cy={(p.row + 0.5) * TILE_PX}
              r={5}
            />
          ))}
        </svg>
      )}
      {damageNumbers.length > 0 && (
        <div className="damage-number-layer" aria-hidden="true">
          {damageNumbers.map(dn => (
            <div
              key={dn.id}
              className="damage-number-crit"
              style={{
                left: (dn.col + 0.5) * TILE_PX,
                top: (dn.row + 0.5) * TILE_PX,
              }}
            >
              {dn.value}!
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
