import { useRef, useState } from 'react'
import { plural } from '../lib/format.js'
import { parseWorkbook } from '../lib/parseWorkbook.js'
import Icon from './Icon.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from './Toast.jsx'

/**
 * Picks the OPEN SHIFT .xlsx file and imports it entirely inside the browser — nothing is uploaded.
 * Existing records and edits are kept; the spreadsheet only adds new people and fills blanks.
 */
export default function ImportButton({ store, onDone, primary = false, label = 'Import spreadsheet' }) {
  const toast = useToast()
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const parsed = parseWorkbook(new Uint8Array(await file.arrayBuffer()), file.name)
      const s = store.importWorkbook(parsed)
      toast({
        title: `Imported ${file.name}`,
        details: `${plural(s.caregiversAdded, 'caregiver')} and ${plural(s.clientsAdded, 'client')} added · ${s.caregiversUpdated + s.clientsUpdated} filled in · your edits were kept`,
        actions: onDone ? [{ label: 'View caregivers', primary: true, onClick: () => onDone('caregivers') }] : undefined,
      })
    } catch (err) {
      setError(
        /Sheet not found|not an Excel/.test(err.message)
          ? `${file.name} doesn’t look like the OPEN SHIFT workbook (${err.message}). Choose the .xlsx file with the LIVEVIEW STATUS UPDATE tab.`
          : `Couldn’t read ${file.name}. Make sure it is an .xlsx file and try again.`,
      )
    }
    setBusy(false)
  }

  return (
    <div className="import-button">
      <button type="button" className={primary ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => ref.current.click()} disabled={busy}>
        {busy ? <Spinner size={14} /> : <Icon name="upload" size={16} />}
        {busy ? 'Importing…' : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={onFile}
      />
      {error && (
        <p className="tf-error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  )
}
