import { TOWER_TYPES } from '../game/tower'
import TowerPickerIcon from './TowerPickerIcon'

/**
 * TowerPicker — 2-column icon grid of tower types.
 * Stats are shown on hover via the native title attribute (tooltip).
 *
 * Props:
 *   selectedType      — the currently selected tower type key (string)
 *   gold              — current player gold (number)
 *   onSelect          — callback(type: string) when a button is clicked
 *   onHoverTowerType  — callback(type: string | null) fired on mouseenter/mouseleave
 */
function TowerPicker({ selectedType, gold, onSelect, onHoverTowerType }) {
  return (
    <div className="tower-picker">
      {Object.entries(TOWER_TYPES).map(([type, config]) => {
        const affordable = gold >= config.cost
        const isSelected = type === selectedType

        // Build tooltip text with stats + special ability
        let specialLine = ''
        if (config.splashRadius != null) {
          specialLine = `Splash: ${config.splashRadius}t`
        } else if (config.slowFactor != null) {
          specialLine = `Slow: ${Math.round((1 - config.slowFactor) * 100)}%`
        } else if (config.poisonTickDamage != null) {
          specialLine = `Poison: ${config.poisonTicks}×${config.poisonTickDamage} DoT`
        } else if (config.chainRadius != null) {
          specialLine = `Chain: ${config.maxChains} hops (r=${config.chainRadius}t)`
        }
        const tooltip = [
          type,
          `Cost: ${config.cost}`,
          `Range: ${config.range}  Dmg: ${config.damage}  Rate: ${config.fireRate}`,
          specialLine,
        ]
          .filter(Boolean)
          .join('\n')

        const classes = [
          'tower-picker-btn',
          isSelected ? 'selected' : '',
          !affordable ? 'unaffordable' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={type}
            className={classes}
            disabled={!affordable}
            onClick={() => onSelect(type)}
            onMouseEnter={() => onHoverTowerType && onHoverTowerType(type)}
            onMouseLeave={() => onHoverTowerType && onHoverTowerType(null)}
            title={tooltip}
          >
            <span className="tower-picker-icon-wrap">
              <TowerPickerIcon type={type} />
              <span className="tower-picker-cost-badge">{config.cost}g</span>
            </span>
            {/* Keep the full type name for test selectors; CSS clips to compact size */}
            <span className="tower-picker-name">{type}</span>
          </button>
        )
      })}
    </div>
  )
}

export default TowerPicker
