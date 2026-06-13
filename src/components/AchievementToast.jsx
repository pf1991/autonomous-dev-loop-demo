/**
 * AchievementToast — displays a brief "Achievement Unlocked" notification
 * that auto-dismisses after 3 seconds.
 *
 * Props:
 *   toasts  — array of { id: string, name: string } — active toast notifications
 */
function AchievementToast({ toasts = [] }) {
  if (toasts.length === 0) return null

  return (
    <div className="achievement-toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className="achievement-toast">
          <span className="achievement-toast-icon">🏆</span>
          <span className="achievement-toast-text">
            Achievement Unlocked: <strong>{toast.name}</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

export default AchievementToast
