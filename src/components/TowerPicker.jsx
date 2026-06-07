import { TOWER_TYPES } from '../game/tower'

/**
 * TowerPicker — renders one button per tower type.
 * Props:
 *   selectedType  — the currently selected tower type key (string)
 *   gold          — current player gold (number)
 *   onSelect      — callback(type: string) when a button is clicked
 */
function TowerPicker({ selectedType, gold, onSelect }) {
  return (
    <div className="tower-picker">
      {Object.entries(TOWER_TYPES).map(([type, config]) => {
        const affordable = gold >= config.cost
        const isSelected = type === selectedType
        const classes = [
          isSelected ? 'selected' : '',
          !affordable ? 'unaffordable' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={type}
            className={classes || undefined}
            disabled={!affordable}
            onClick={() => onSelect(type)}
          >
            <span className="tower-picker-name">{type}</span>
            <span className="tower-picker-stat">Cost: {config.cost}</span>
            <span className="tower-picker-stat">Range: {config.range}</span>
            <span className="tower-picker-stat">Dmg: {config.damage}</span>
          </button>
        )
      })}
    </div>
  )
}

export default TowerPicker
