/**
 * TowerPickerIcon — small inline SVG silhouette for each tower type used in the picker grid.
 * These are simplified versions of the GameBoard icons, scaled to fit a 32×32 button icon area.
 */
function TowerPickerIcon({ type }) {
  if (type === 'BasicTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <rect className="tower-basic" x="6" y="11" width="12" height="8" rx="1" />
        <rect className="tower-basic" x="16" y="13" width="9" height="4" rx="1" />
        <rect className="tower-basic-muzzle" x="24" y="12" width="2" height="6" rx="1" />
      </svg>
    )
  }
  if (type === 'SniperTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <rect className="tower-sniper" x="4" y="14" width="22" height="2" rx="1" />
        <circle className="tower-sniper" cx="18" cy="11" r="4" />
        <circle className="tower-sniper-lens" cx="18" cy="11" r="2" />
        <rect className="tower-sniper" x="6" y="16" width="5" height="5" rx="1" />
      </svg>
    )
  }
  if (type === 'RapidTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <circle className="tower-rapid-hub" cx="10" cy="15" r="5" />
        <rect className="tower-rapid" x="10" y="8"  width="16" height="3" rx="1" />
        <rect className="tower-rapid" x="10" y="13" width="18" height="3" rx="1" />
        <rect className="tower-rapid" x="10" y="18" width="16" height="3" rx="1" />
      </svg>
    )
  }
  if (type === 'CannonTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <circle className="tower-cannon" cx="12" cy="15" r="8" />
        <rect className="tower-cannon" x="17" y="13" width="7" height="4" rx="1" />
        <path className="tower-cannon-muzzle" d="M23,11 L27,11 L28,19 L23,19 Z" />
      </svg>
    )
  }
  if (type === 'SlowTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <circle className="tower-slow" cx="15" cy="15" r="3" />
        <line className="tower-slow-arm" x1="15" y1="15" x2="15" y2="4" />
        <line className="tower-slow-arm" x1="15" y1="15" x2="15" y2="26" />
        <line className="tower-slow-arm" x1="15" y1="15" x2="24.5" y2="9.5" />
        <line className="tower-slow-arm" x1="15" y1="15" x2="5.5" y2="20.5" />
        <line className="tower-slow-arm" x1="15" y1="15" x2="5.5" y2="9.5" />
        <line className="tower-slow-arm" x1="15" y1="15" x2="24.5" y2="20.5" />
        <rect className="tower-slow" x="13.5" y="2.5" width="3" height="3" transform="rotate(45 15 4)" />
        <rect className="tower-slow" x="13.5" y="24.5" width="3" height="3" transform="rotate(45 15 26)" />
        <rect className="tower-slow" x="22.5" y="7.5" width="3" height="3" transform="rotate(45 24 9.5)" />
        <rect className="tower-slow" x="3.5" y="18.5" width="3" height="3" transform="rotate(45 5 20.5)" />
        <rect className="tower-slow" x="3.5" y="7.5" width="3" height="3" transform="rotate(45 5 9.5)" />
        <rect className="tower-slow" x="22.5" y="18.5" width="3" height="3" transform="rotate(45 24 20.5)" />
      </svg>
    )
  }
  if (type === 'MortarTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <rect className="tower-mortar" x="4" y="22" width="22" height="5" rx="1" />
        <rect className="tower-mortar" x="12" y="7" width="5" height="16" rx="2" transform="rotate(-30 14 15)" />
        <circle className="tower-mortar-opening" cx="20" cy="7" r="3" />
      </svg>
    )
  }
  if (type === 'PoisonTower') {
    return (
      <svg width="32" height="32" viewBox="0 0 30 30" aria-hidden="true">
        <ellipse className="tower-poison" cx="15" cy="20" rx="9" ry="8" />
        <rect className="tower-poison" x="12" y="8" width="6" height="8" rx="1" />
        <rect className="tower-poison-stopper" x="10" y="6" width="10" height="3" rx="1" />
        <ellipse className="tower-poison-drop" cx="15" cy="28" rx="2" ry="2.5" />
      </svg>
    )
  }
  return null
}

export default TowerPickerIcon
