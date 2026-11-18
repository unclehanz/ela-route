import Icon from './Icon.jsx'

export default function EmptyState({ icon = 'info', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} className="empty-icon" />
      <p className="empty-title">{title}</p>
      {children && <p className="empty-text">{children}</p>}
      {action}
    </div>
  )
}
