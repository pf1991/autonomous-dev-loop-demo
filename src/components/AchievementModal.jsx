/**
 * AchievementModal — full achievement panel listing all 12 achievements.
 * Unlocked ones show full details; locked ones are greyed out.
 *
 * Props:
 *   achievements  — array of { id, name, description } (from ACHIEVEMENTS)
 *   unlocked      — Set or array of unlocked achievement IDs
 *   onClose       — callback to close the modal
 */
import { ACHIEVEMENTS } from '../game/achievements'

function AchievementModal({ unlocked = [], onClose }) {
  const unlockedSet = new Set(unlocked)
  const unlockedCount = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).length

  return (
    <div className="achievement-modal-overlay" onClick={onClose}>
      <div className="achievement-modal" onClick={e => e.stopPropagation()}>
        <div className="achievement-modal-header">
          <span className="achievement-modal-title">
            🏆 Achievements {unlockedCount}/{ACHIEVEMENTS.length}
          </span>
          <button className="achievement-modal-close" onClick={onClose}>✕</button>
        </div>
        <ul className="achievement-modal-list">
          {ACHIEVEMENTS.map(a => {
            const isUnlocked = unlockedSet.has(a.id)
            return (
              <li
                key={a.id}
                className={`achievement-item${isUnlocked ? ' achievement-item--unlocked' : ' achievement-item--locked'}`}
              >
                <span className="achievement-item-icon">{isUnlocked ? '🏆' : '🔒'}</span>
                <span className="achievement-item-info">
                  <span className="achievement-item-name">{isUnlocked ? a.name : '???'}</span>
                  <span className="achievement-item-desc">
                    {isUnlocked ? a.description : 'Keep playing to unlock'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default AchievementModal
