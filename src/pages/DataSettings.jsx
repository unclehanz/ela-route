import { useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'
import { downloadFile } from '../lib/files.js'
import { fmtDate, today } from '../lib/format.js'
import ImportButton from '../components/ImportButton.jsx'

export default function DataSettings({ store, onClose, onNavigate }) {
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
      details: `${data.caregivers.length} caregivers · ${data.clients.length} clients · ${data.mileage.length} trips`,
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
        details: `${obj.caregivers.length} caregivers · ${obj.clients.length} clients · ${obj.mileage?.length || 0} trips`,
        actions: [{ label: 'View caregivers', primary: true, onClick: () => onNavigate('caregivers') }],
      })
    } catch {
      setRestoreError(`${file.name} is not an ELA Route backup file. Choose a file made with “Download backup”.`)
    }
  }

  return (
    <Modal title="Data & settings" onClose={onClose}>
      <section className="settings-section">
        <h3>Spreadsheet</h3>
        <p className="text-muted">
          {data.importInfo
            ? `Last imported: ${data.importInfo.source}, ${fmtDate(data.importInfo.importedAt)}.`
            : 'No spreadsheet imported yet.'}{' '}
          The file is read inside this browser — nothing is uploaded. Re-importing adds new people and fills blanks; your edits are kept.
        </p>
        <ImportButton store={store} onDone={(p) => (onClose(), onNavigate(p))} />
      </section>

      <section className="settings-section">
        <h3>Backup</h3>
        <p className="text-muted">
          Your changes are saved in this browser only. Download a backup regularly, and restore it on another computer if needed.
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
        <p className="text-muted">Removes all caregivers, clients, trips and contact notes from this browser. Settings are kept.</p>
        <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmReset(true)}>
          <Icon name="trash" size={18} /> Clear all data on this device
        </button>
      </section>

      <p className="fine-print">
        Maps and routing use OpenStreetMap, Nominatim, Photon, OSRM and the FOSSGIS walking router (free public services). Addresses are sent to them to be placed on the map,
        once per address; route lookups send map points only. Drive times are estimates from typical traffic, not live traffic.
        The transit and map links open Google or Apple Maps with the two map points.
      </p>

      {confirmReset && (
        <ConfirmDialog
          title="Clear all data?"
          message={`This erases ${data.caregivers.length} caregivers, ${data.clients.length} clients, ${data.mileage.length} logged trips and ${data.contacts.length} contact notes from this browser. It can't be undone — download a backup first if you might need them.`}
          confirmLabel="Erase everything"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            store.clearAll()
            setConfirmReset(false)
            onClose()
            toast({ title: 'All data cleared from this browser', details: 'Import the spreadsheet or restore a backup to start again.', tone: 'info' })
          }}
        />
      )}
    </Modal>
  )
}
