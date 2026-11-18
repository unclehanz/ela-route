import { APP_NAME, NAV } from '../config.js'
import Icon from './Icon.jsx'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'

export default function Sidebar({ page, onNavigate, badges, theme, onToggleTheme, onOpenSettings, onOpenPalette, onSignOut, collapsed, onToggleCollapse }) {
  // When collapsed, labels are visually hidden but stay available to screen readers and as hover tooltips.
  const tip = (text) => (collapsed ? text : undefined)
  return (
    <aside className={'sidebar' + (collapsed ? ' is-collapsed' : '')}>
      <div className="sidebar-brand">
        <Icon name="logo" size={22} />
        <span className="nav-text">{APP_NAME}</span>
        <button
          type="button"
          className="btn-icon sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-keyshortcuts="Control+B"
          title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={18} />
        </button>
      </div>
      <button type="button" className="sidebar-search" onClick={onOpenPalette} title={tip('Quick find (Ctrl K)')} aria-label="Quick find">
        <Icon name="search" size={16} />
        <span className="nav-text">Quick find</span>
        <kbd className="nav-text">{MOD} K</kbd>
      </button>
      <nav aria-label="Main">
        <ul className="nav-list">
          {NAV.map((n, i) => {
            const on = page === n.id
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={'nav-item' + (on ? ' is-active' : '')}
                  aria-current={on ? 'page' : undefined}
                  aria-keyshortcuts={`Alt+${i + 1}`}
                  title={tip(n.title)}
                  onClick={() => onNavigate(n.id)}
                >
                  <Icon name={n.icon} filled={on} size={18} />
                  <span className="nav-text">{n.title}</span>
                  {badges[n.id] > 0 ? (
                    <span className="nav-count" aria-label={`${badges[n.id]} need attention`}>
                      {badges[n.id]}
                    </span>
                  ) : (
                    <kbd className="nav-kbd" aria-hidden="true">
                      Alt {i + 1}
                    </kbd>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="nav-item" onClick={onOpenSettings} title={tip('Data & settings')}>
          <Icon name="settings" size={18} />
          <span className="nav-text">Data &amp; settings</span>
        </button>
        <button type="button" className="nav-item" onClick={onToggleTheme} aria-pressed={theme === 'dark'} title={tip(theme === 'dark' ? 'Light theme' : 'Dark theme')}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          <span className="nav-text">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
        </button>
        <button type="button" className="nav-item" onClick={onSignOut} title={tip('Sign out')}>
          <Icon name="logout" size={18} />
          <span className="nav-text">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
