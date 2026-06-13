/**
 * UpgradePanel — shown inside a tile when a tower is selected.
 * Displays current stats, next-level stats (when upgradable), an "Upgrade (N gold)" button,
 * a "Sell (Ng)" button that refunds 70% of the base cost, and any active synergy descriptions.
 */
function UpgradePanel({ tower, gold, onUpgrade, onSell, getUpgradeCost, canUpgrade, getNextUpgradeStats, sellTower, synergies = [] }) {
  const upgradable = canUpgrade ? canUpgrade(tower) : false
  const cost = getUpgradeCost ? getUpgradeCost(tower) : null
  const canAffordUpgrade = upgradable && cost !== null && gold >= cost
  const nextStats = getNextUpgradeStats ? getNextUpgradeStats(tower) : null
  const sellResult = sellTower ? sellTower(tower) : { refund: 0 }
  const refund = sellResult.refund

  return (
    <div className="upgrade-panel" onClick={e => e.stopPropagation()}>
      <div className="upgrade-panel-header">
        Lv {tower.upgradeLevel} {tower.type}
      </div>
      <div className="upgrade-panel-stats">
        <span>Dmg: {tower.damage}</span>
        <span>Range: {tower.range}</span>
        <span>Rate: {tower.fireRate}</span>
        <span>Kills: {tower.kills ?? 0}</span>
      </div>
      {nextStats && (
        <div className="upgrade-panel-next-stats">
          <span className="upgrade-panel-next-label">Next level:</span>
          <span>Dmg: {nextStats.damage}</span>
          <span>Range: {nextStats.range}</span>
          <span>Rate: {nextStats.fireRate}</span>
        </div>
      )}
      {synergies.length > 0 && (
        <div className="upgrade-panel-synergies">
          <span className="upgrade-panel-synergy-label">&#x26A1; Synergies:</span>
          {synergies.map((s, i) => (
            <span key={i} className="upgrade-panel-synergy-item">{s.description}</span>
          ))}
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
      <button
        className="upgrade-panel-sell-btn"
        onClick={() => onSell && onSell(tower.row, tower.col)}
      >
        Sell ({refund}g)
      </button>
    </div>
  )
}

export default UpgradePanel
