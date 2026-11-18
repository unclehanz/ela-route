import { NAV } from '../config.js'
import Icon from './Icon.jsx'

export default function BottomNav({ page, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV.map((n) => {
        const on = page === n.id
        return (
          <button
            key={n.id}
            type="button"
            className={'bottom-item' + (on ? ' is-active' : '')}
            aria-current={on ? 'page' : undefined}
            onClick={() => onNavigate(n.id)}
          >
            <Icon name={n.icon} filled={on} size={24} />
            <span>{n.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
