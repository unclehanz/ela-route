import { useCallback, useEffect, useState } from 'react'
import './App.css'
import BottomNav from './components/BottomNav.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import Footer from './components/Footer.jsx'
import Icon from './components/Icon.jsx'
import Sidebar from './components/Sidebar.jsx'
import Spinner from './components/Spinner.jsx'
import { useToast } from './components/Toast.jsx'
import { APP_NAME, NAV } from './config.js'
import { locateAll } from './lib/geo.js'
import { useDelayed, useTheme } from './lib/hooks.js'
import { load, save } from './lib/storage.js'
import { useStore } from './lib/store.js'
import CaregiverForm from './pages/CaregiverForm.jsx'
import CaregiversPage from './pages/CaregiversPage.jsx'
import ClientForm from './pages/ClientForm.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import DataSettings from './pages/DataSettings.jsx'
import DispatchPage from './pages/DispatchPage.jsx'

const UI_KEY = 'ela-route:ui:v2'

export default function App({ user, onSignOut }) {
  const store = useStore(user.uid)
  const { data, sync, upsert, remove } = store
  const showLoading = useDelayed(sync.state === 'loading')
  const toast = useToast()
  const [theme, toggleTheme] = useTheme()
  const saved = load(UI_KEY, {})
  const [page, setPage] = useState(NAV.some((n) => n.id === saved.page) ? saved.page : 'dispatch')
  const [dispatchClientId, setDispatchClientIdState] = useState(saved.clientId || '')
  const [editing, setEditing] = useState(null) // { kind, item }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => load('ela-route:sidebar-collapsed', false))
  // Auto-collapse: while the Dispatch route panel is open the sidebar folds to icons to give the map room.
  // Expanding it by hand during that time sticks until the panel closes. The user's own collapse choice always wins.
  const [routePanelOpen, setRoutePanelOpen] = useState(false)
  const [expandedByUser, setExpandedByUser] = useState(false)
  const autoCollapse = data.settings.autoCollapseSidebar !== false
  const autoCollapsed = autoCollapse && routePanelOpen && page === 'dispatch' && !expandedByUser
  const sidebarCollapsed = collapsed || autoCollapsed
  const handleRoutePanel = useCallback((open) => {
    setRoutePanelOpen(open)
    if (!open) setExpandedByUser(false)
  }, [])
  const toggleCollapsed = () => {
    if (autoCollapsed && !collapsed) {
      setExpandedByUser(true)
      return
    }
    setCollapsed((c) => {
      save('ela-route:sidebar-collapsed', !c)
      return !c
    })
  }

  const persist = (patch) => save(UI_KEY, { page, clientId: dispatchClientId, ...patch })
  const navigate = (id) => {
    setPage(id)
    persist({ page: id })
    window.scrollTo(0, 0)
  }
  const setDispatchClientId = (id) => {
    setDispatchClientIdState(id)
    persist({ clientId: id })
  }

  // Keyboard accelerators: Ctrl/Cmd+K opens quick find, Alt+1..N switch pages.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapsed()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (e.altKey && !e.ctrlKey && !e.metaKey && NAV[+e.key - 1]) {
        e.preventDefault()
        navigate(NAV[+e.key - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Tell the user when a save to the cloud fails (changes stay on this device until it works).
  const syncMessage = sync.state === 'error' && !sync.fatal ? sync.message : ''
  useEffect(() => {
    if (syncMessage)
      toast({ title: 'Changes not saved to the cloud yet', details: syncMessage, tone: 'danger', actions: [{ label: 'Try again', primary: true, onClick: store.retrySync }] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMessage])

  // Optional: quietly locate any address not on the map yet, so searches are instant.
  const bg = !!data.settings.backgroundLocate
  useEffect(() => {
    if (!bg) return
    const t = setTimeout(() => locateAll([...data.caregivers, ...data.clients].map((x) => x.address)), 2000)
    return () => clearTimeout(t)
  }, [bg, data.caregivers, data.clients])

  function runCommand(cmd) {
    setPaletteOpen(false)
    if (cmd.type === 'page') navigate(cmd.id)
    else if (cmd.type === 'client') {
      setDispatchClientId(cmd.item.id)
      navigate('dispatch')
    } else if (cmd.type === 'caregiver') setEditing({ kind: 'caregiver', item: cmd.item })
    else if (cmd.type === 'add-caregiver') setEditing({ kind: 'caregiver', item: null })
    else if (cmd.type === 'add-client') setEditing({ kind: 'client', item: null })
    else if (cmd.type === 'theme') toggleTheme()
  }

  const careManagers = [...new Set(data.clients.map((c) => c.careManager).filter(Boolean))].sort()
  const badges = { clients: data.clients.filter((c) => !c.address).length }
  const close = () => setEditing(null)

  function saveCaregiver(cg) {
    const isNew = !cg.id
    upsert('caregivers', cg)
    close()
    toast({
      title: isNew ? `${cg.name} added to caregivers` : `${cg.name} updated`,
      details: [cg.status, cg.level, cg.driver, cg.address || 'No address yet'].filter(Boolean).join(' · '),
      actions: isNew ? [{ label: 'Add another caregiver', primary: true, onClick: () => setEditing({ kind: 'caregiver', item: null }) }] : undefined,
    })
  }

  function saveClient(cl) {
    const isNew = !cl.id
    const id = upsert('clients', cl)
    close()
    toast({
      title: isNew ? `${cl.name} added to clients` : `${cl.name} updated`,
      details: [cl.address, cl.careManager && `Care manager: ${cl.careManager}`].filter(Boolean).join(' · '),
      actions: [
        {
          label: 'Find caregivers for this client',
          primary: true,
          onClick: () => {
            setDispatchClientId(id)
            navigate('dispatch')
          },
        },
      ],
    })
  }

  function deleteRecord(kind, item) {
    const coll = kind === 'caregiver' ? 'caregivers' : 'clients'
    remove(coll, item.id)
    close()
    toast({
      title: `${item.name} deleted`,
      details: kind === 'caregiver' ? 'Removed from the caregiver list.' : 'Removed from the client list.',
      tone: 'info',
      actions: [{ label: 'Undo', primary: true, onClick: () => upsert(coll, item) }],
    })
  }

  return (
    <div className={'shell' + (sidebarCollapsed ? ' sidebar-collapsed' : '')}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        page={page}
        onNavigate={navigate}
        badges={badges}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onSignOut={onSignOut}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <div className="shell-main">
        <header className="topbar">
          <span className="topbar-brand">
            <Icon name="logo" size={22} /> {APP_NAME}
          </span>
          <span className="spacer" />
          <button type="button" className="btn-icon" onClick={() => setPaletteOpen(true)} aria-label="Quick find">
            <Icon name="search" />
          </button>
          <button type="button" className="btn-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button type="button" className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Data and settings">
            <Icon name="settings" />
          </button>
          <button type="button" className="btn-icon" onClick={onSignOut} aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </header>

        <main id="main" key={page} className={'content content-' + page} aria-busy={sync.state === 'loading'}>
          {sync.state === 'loading' && (
            <div className="app-status">
              {showLoading && (
                <p className="status-line">
                  <Spinner size={14} /> Loading team data…
                </p>
              )}
            </div>
          )}
          {sync.fatal && (
            <div className="app-status">
              <div className="callout callout-danger" role="alert">
                <Icon name="alert" size={18} />
                <p>
                  {sync.message}{' '}
                  <button type="button" className="btn-link" onClick={() => window.location.reload()}>
                    Reload
                  </button>
                </p>
              </div>
            </div>
          )}
          {sync.state !== 'loading' && !sync.fatal && page === 'dispatch' && (
            <DispatchPage
              key={dispatchClientId}
              store={store}
              clientId={dispatchClientId}
              setClientId={setDispatchClientId}
              onEditClient={(item) => setEditing({ kind: 'client', item })}
              onAddClient={() => setEditing({ kind: 'client', item: null })}
              onViewCaregiver={(item) => setEditing({ kind: 'caregiver', item })}
              onNavigate={navigate}
              onRoutePanelChange={handleRoutePanel}
            />
          )}
          {sync.state !== 'loading' && !sync.fatal && page === 'caregivers' && (
            <CaregiversPage store={store} onView={(item) => setEditing({ kind: 'caregiver', item })} onAdd={() => setEditing({ kind: 'caregiver', item: null })} />
          )}
          {sync.state !== 'loading' && !sync.fatal && page === 'clients' && (
            <ClientsPage store={store} onView={(item) => setEditing({ kind: 'client', item })} onAdd={() => setEditing({ kind: 'client', item: null })} />
          )}
        </main>

        <Footer />
      </div>

      <BottomNav page={page} onNavigate={navigate} />

      {editing?.kind === 'caregiver' && (
        <CaregiverForm
          initial={editing.item}
          onClose={close}
          onSave={saveCaregiver}
          onDelete={editing.item?.id ? () => deleteRecord('caregiver', editing.item) : null}
        />
      )}
      {editing?.kind === 'client' && (
        <ClientForm
          initial={editing.item}
          careManagers={careManagers}
          onClose={close}
          onSave={saveClient}
          onDelete={editing.item?.id ? () => deleteRecord('client', editing.item) : null}
        />
      )}
      {paletteOpen && (
        <CommandPalette caregivers={data.caregivers} clients={data.clients} onClose={() => setPaletteOpen(false)} onRun={runCommand} />
      )}
      {settingsOpen && <DataSettings store={store} user={user} onClose={() => setSettingsOpen(false)} onNavigate={navigate} />}
    </div>
  )
}
