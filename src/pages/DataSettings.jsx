import { useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { downloadFile } from '../lib/files.js'
import { fmtDate, today } from '../lib/format.js'
import CsvMenu from '../components/CsvMenu.jsx'
import ImportButton from '../components/ImportButton.jsx'

const SYNC_TEXT = {
  saved: 'All changes are saved.',
  saving: 'Saving changes…',
  loading: 'Loading your data…',
}

export default function DataSettings({ store, user, onClose, onNavigate }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [restoreError, setRestoreError] = useState('')
  const { data } = store

  const backup = () => {
    const name = `ela-route-backup-${today()}.json`
    downloadFile(name, JSON.stringify(data, null, 1), 'application/json')
    toast({
      title: `Backup saved as ${name}`,
      details: `${data.caregivers.length} caregivers · ${data.clients.length} clients · ${data.contacts.length} contact notes`,
    })
  }

  const restore = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const obj = JSON.parse(await file.text())
      if (!Array.isArray(obj.caregivers) || !Array.isArray(obj.clients)) throw new Error()
      store.replaceAll(obj)
      setRestoreError('')
      onClose()
      toast({
        title: `Restored from ${file.name}`,
        details: `${obj.caregivers.length} caregivers · ${obj.clients.length} clients`,
        actions: [{ label: 'View caregivers', primary: true, onClick: () => onNavigate('caregivers') }],
      })
    } catch {
      setRestoreError(`${file.name} is not an ELA Route backup file. Choose a file made with “Download backup”.`)
    }
  }

  return (
    <Modal title="Data & settings" onClose={onClose}>
      <section className="settings-section">
        <h3>Account</h3>
        <p className="text-muted">
          Signed in as <strong>{user.email}</strong>. Caregivers, clients and contact notes are shared with everyone on the team: anyone can use and change them, and changes show up for everyone right away. The settings below are just for you.
        </p>
        <p className={store.sync.state === 'error' ? 'text-danger' : 'text-muted'} role="status">
          {store.sync.state === 'error' ? (
            <>
              <Icon name="alert" size={16} /> {store.sync.message}{' '}
              <button type="button" className="btn-link" onClick={store.retrySync}>
                Try again
              </button>
            </>
          ) : (
            SYNC_TEXT[store.sync.state]
          )}
        </p>
      </section>

      <section className="settings-section">
        <h3>Spreadsheet</h3>
        <p className="text-muted">
          {data.importInfo
            ? `Last imported: ${data.importInfo.source}, ${fmtDate(data.importInfo.importedAt)}.`
            : 'No spreadsheet imported yet.'}{' '}
          The file is read in this browser; the caregivers and clients in it are added to the team’s shared data. Re-importing adds new people and fills blanks; your edits are kept.
        </p>
        <ImportButton store={store} onDone={(p) => (onClose(), onNavigate(p))} />
      </section>

      <section className="settings-section">
        <h3>CSV files</h3>
        <p className="text-muted">
          Add or update caregivers and clients in bulk: download the template, fill in one person per row (Excel or Google Sheets, saved as CSV), then
          import it. People are matched by name: new ones are added and existing ones only get their blanks filled. Export gives you the same columns.
        </p>
        <div className="btn-row">
          <CsvMenu kind="caregivers" label="Caregivers CSV" store={store} onDone={(p) => (onClose(), onNavigate(p))} />
          <CsvMenu kind="clients" label="Clients CSV" store={store} onDone={(p) => (onClose(), onNavigate(p))} />
        </div>
      </section>

      <section className="settings-section">
        <h3>Backup</h3>
        <p className="text-muted">
          A copy you keep yourself. Restoring replaces the team’s shared data with the backup, for everyone.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={backup}>
            <Icon name="download" size={18} /> Download backup
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current.click()}>
            <Icon name="upload" size={18} /> Restore from backup
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={restore} />
        </div>
        {restoreError && (
          <p className="tf-error" role="alert">
            <Icon name="alert" size={16} /> {restoreError}
          </p>
        )}
      </section>

      <section className="settings-section">
        <h3>Dispatch search</h3>
        <TextField
          label="Caregivers to compare per search"
          type="number"
          min="5"
          max="150"
          value={data.settings.candidates || 40}
          onChange={(e) => store.setSettings({ candidates: Math.max(5, Math.min(150, +e.target.value || 40)) })}
          help="The closest caregivers in a straight line get a road-distance check. More is slower."
        />
      </section>

      <section className="settings-section">
        <h3>Layout</h3>
        <label className={'toggle-chip align-start' + (data.settings.autoCollapseSidebar !== false ? ' is-on' : '')}>
          <input
            type="checkbox"
            checked={data.settings.autoCollapseSidebar !== false}
            onChange={(e) => store.setSettings({ autoCollapseSidebar: e.target.checked })}
          />
          {data.settings.autoCollapseSidebar !== false && <Icon name="check" size={14} />}
          Collapse the sidebar automatically while route details are open
        </label>
      </section>

      <section className="settings-section">
        <h3>Background locating</h3>
        <label className={'toggle-chip align-start' + (data.settings.backgroundLocate ? ' is-on' : '')}>
          <input
            type="checkbox"
            checked={!!data.settings.backgroundLocate}
            onChange={(e) => store.setSettings({ backgroundLocate: e.target.checked })}
          />
          {data.settings.backgroundLocate && <Icon name="check" size={14} />}
          Locate new addresses automatically while the app is open
        </label>
        <p className="text-muted small">
          Makes every Dispatch search instant. When on, addresses that aren’t on the map yet are sent to the free lookup services in
          the background, without you clicking anything.
        </p>
      </section>

      <section className="settings-section">
        <h3>Start over</h3>
        <p className="text-muted">Removes all caregivers, clients and contact notes for the whole team. Your settings are kept.</p>
        <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmReset(true)}>
          <Icon name="trash" size={18} /> Clear all data
        </button>
      </section>

      <p className="fine-print">
        Maps and routing use OpenStreetMap, Nominatim, Photon, OSRM and the FOSSGIS walking router (free public services). Addresses are sent to them to be placed on the map,
        once per address; route lookups send map points only. Your caregiver and client records are stored in Firebase (Google Cloud), visible only to signed-in team members. Drive times are estimates from typical traffic, not live traffic.
        The transit and map links open Google or Apple Maps with the two map points.
      </p>

      {confirmReset && (
        <ConfirmDialog
          title="Clear all data?"
          message={`This erases ${data.caregivers.length} caregivers, ${data.clients.length} clients and ${data.contacts.length} contact notes for everyone on the team. It can't be undone — download a backup first if you might need them.`}
          confirmLabel="Erase everything"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            store.clearAll()
            setConfirmReset(false)
            onClose()
            toast({ title: 'All team data cleared', details: 'Import the spreadsheet or restore a backup to start again.', tone: 'info' })
          }}
        />
      )}
    </Modal>
  )
}
