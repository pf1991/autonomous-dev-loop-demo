/**
 * UpgradePanel — shown inside a tile when a tower is selected.
 * Displays a two-column before/after stat comparison with deltas highlighted.
 * Maxed towers show "MAX LEVEL" without the diff table.
 */
function UpgradePanel({ tower, gold, onUpgrade, onSell, getUpgradeCost, canUpgrade, getNextUpgradeStats, getUpgradePreview, sellTower, synergies = [] }) {
  const upgradable = canUpgrade ? canUpgrade(tower) : false
  const cost = getUpgradeCost ? getUpgradeCost(tower) : null
  const canAffordUpgrade = upgradable && cost !== null && gold >= cost
  const preview = getUpgradePreview ? getUpgradePreview(tower) : null
  // Fallback to legacy getNextUpgradeStats when preview is unavailable
  const nextStats = (!preview && getNextUpgradeStats) ? getNextUpgradeStats(tower) : null
  const sellResult = sellTower ? sellTower(tower) : { refund: 0 }
  const refund = sellResult.refund

  function formatVal(val, isNew) {
    if (isNew || val == null) return '—'
    if (typeof val === 'number') {
      // Show integers without decimals; show up to 2 dp for floats
      return Number.isInteger(val) ? String(val) : val.toFixed(2)
    }
    return String(val)
  }

  function formatDelta(delta) {
    if (delta == null || delta === 0) return null
    const sign = delta > 0 ? '+' : ''
    return `${sign}${Number.isInteger(delta) ? delta : delta.toFixed(2)}`
  }

  return (
    <div className="upgrade-panel" onClick={e => e.stopPropagation()}>
      <div className="upgrade-panel-header">
        Lv {tower.upgradeLevel} {tower.type}
      </div>
      <div className="upgrade-panel-kills">Kills: {tower.kills ?? 0}</div>

      {/* Rich diff table when preview data is available */}
      {preview && (
        <table className="upgrade-panel-diff-table">
          <thead>
            <tr>
              <th className="upgrade-panel-diff-th upgrade-panel-diff-stat-col">Stat</th>
              <th className="upgrade-panel-diff-th upgrade-panel-diff-val-col">Now</th>
              <th className="upgrade-panel-diff-th upgrade-panel-diff-val-col">Next</th>
              <th className="upgrade-panel-diff-th upgrade-panel-diff-delta-col">Δ</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map(({ label, current, next, delta, isNew }) => {
              const deltaStr = isNew ? null : formatDelta(delta)
              return (
                <tr key={label} className="upgrade-panel-diff-row">
                  <td className="upgrade-panel-diff-label">{label}</td>
                  <td className="upgrade-panel-diff-current">{formatVal(current, isNew)}</td>
                  <td className={`upgrade-panel-diff-next${isNew ? ' upgrade-panel-diff-new-val' : ''}`}>
                    {formatVal(next, false)}
                  </td>
                  <td className="upgrade-panel-diff-delta">
                    {isNew
                      ? <span className="upgrade-panel-new-badge">NEW</span>
                      : deltaStr
                        ? <span className={deltaStr.startsWith('+') ? 'upgrade-panel-delta-positive' : 'upgrade-panel-delta-negative'}>{deltaStr}</span>
                        : <span className="upgrade-panel-delta-unchanged">—</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Fallback: legacy next-stats display when preview is unavailable */}
      {!preview && nextStats && (
        <div className="upgrade-panel-next-stats">
          <span className="upgrade-panel-next-label">Next level:</span>
          <span>Dmg: {nextStats.damage}</span>
          <span>Range: {nextStats.range}</span>
          <span>Rate: {nextStats.fireRate}</span>
        </div>
      )}

      {/* Fallback: current stats when no preview and no upgrade */}
      {!preview && !nextStats && (
        <div className="upgrade-panel-stats">
          <span>Dmg: {tower.damage}</span>
          <span>Range: {tower.range}</span>
          <span>Rate: {tower.fireRate}</span>
        </div>
      )}

      {synergies.length > 0 && (
        <div className="upgrade-panel-synergies">
          <span className="upgrade-panel-synergy-label">&#x26A1; Synergies:</span>
          {synergies.map((s, i) => {
            const coord = (s.partnerRow != null && s.partnerCol != null)
              ? ` (←col ${s.partnerCol}, row ${s.partnerRow})`
              : ''
            return (
              <span key={i} className="upgrade-panel-synergy-item">{s.description}{coord}</span>
            )
          })}
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
        <div className="upgrade-panel-max">MAX LEVEL</div>
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
