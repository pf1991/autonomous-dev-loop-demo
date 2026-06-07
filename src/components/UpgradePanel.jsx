/**
 * UpgradePanel — shown inside a tile when a tower is selected.
 * Displays current stats, next-level stats (when upgradable), and an "Upgrade (N gold)" button.
 */
function UpgradePanel({ tower, gold, onUpgrade, getUpgradeCost, canUpgrade, getNextUpgradeStats }) {
  const upgradable = canUpgrade ? canUpgrade(tower) : false
  const cost = getUpgradeCost ? getUpgradeCost(tower) : null
  const canAffordUpgrade = upgradable && cost !== null && gold >= cost
  const nextStats = getNextUpgradeStats ? getNextUpgradeStats(tower) : null

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
      {nextStats && (
        <div className="upgrade-panel-next-stats">
          <span className="upgrade-panel-next-label">Next level:</span>
          <span>Dmg: {nextStats.damage}</span>
          <span>Range: {nextStats.range}</span>
          <span>Rate: {nextStats.fireRate}</span>
        </div>
      )}
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

export default UpgradePanel
