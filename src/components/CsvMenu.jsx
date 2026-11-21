import { useRef, useState } from 'react'
import { caregiversToCsv, caregiverTemplate, parseCaregiverCsv } from '../lib/caregiverCsv.js'
import { clientsToCsv, clientTemplate, parseClientCsv } from '../lib/clientCsv.js'
import { downloadFile } from '../lib/files.js'
import { plural, today } from '../lib/format.js'
import Icon from './Icon.jsx'
import Popover from './Popover.jsx'
import { useToast } from './Toast.jsx'

const KINDS = {
  caregivers: { one: 'caregiver', parse: parseCaregiverCsv, toCsv: caregiversToCsv, template: caregiverTemplate },
  clients: { one: 'client', parse: parseClientCsv, toCsv: clientsToCsv, template: clientTemplate },
}

/**
 * CSV import / export / template for one list (`kind`: 'caregivers' | 'clients').
 * Imports match people by name: new ones are added, existing ones only get their blanks filled.
 */
export default function CsvMenu({ kind, store, onDone, label = 'CSV' }) {
  const k = KINDS[kind]
  const toast = useToast()
  const ref = useRef(null)
  const [error, setError] = useState('')
  const rows = store.data[kind]
  const view = onDone ? [{ label: `View ${kind}`, primary: true, onClick: () => onDone(kind) }] : undefined

  function downloadTemplate() {
    const { template, guide } = k.template()
    downloadFile(`${kind}-template.csv`, template)
    downloadFile(`${kind}-template-allowed-values.csv`, guide)
    toast({
      title: `${k.one[0].toUpperCase() + k.one.slice(1)} CSV template downloaded`,
      details: `${kind}-template.csv (one ${k.one} per row; delete the EXAMPLE row) and ${kind}-template-allowed-values.csv (what each column accepts).`,
      tone: 'info',
    })
  }

  function exportAll() {
    const name = `${kind}-${today()}.csv`
    downloadFile(name, k.toCsv(rows))
    toast({ title: `Exported ${plural(rows.length, k.one)} to ${name}`, details: 'Same columns as the template, so the file can be edited and imported again.', tone: 'info' })
  }

  async function onFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setError('')
    let parsed
    try {
      parsed = k.parse(await file.text())
    } catch (err) {
      return setError(err.message?.includes('column') || err.message?.includes('empty') ? `${file.name}: ${err.message}` : `Couldn’t read ${file.name}. Save it as CSV (comma separated) and try again.`)
    }
    if (!parsed.records.length) return setError(`${file.name} has no ${k.one} rows. Fill in the template below the header row.`)
    const s = store.importCsv(kind, parsed.records)
    const { problems, skipped } = parsed
    toast({
      title: `Imported ${file.name}`,
      details: [
        `${plural(s.added, k.one)} added · ${s.updated} existing filled in (matched by name; your edits were kept)`,
        skipped && `${plural(skipped, 'example or blank row')} skipped`,
        problems.length && `${plural(problems.length, 'value')} not recognised and left blank: ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '…' : ''}`,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: problems.length ? 'info' : 'success',
      actions: view,
    })
  }

  return (
    <div className="csv-menu">
      <Popover label={label} width={300}>
        <div className="menu-list">
          <button type="button" className="menu-item" onClick={() => ref.current.click()}>
            <Icon name="upload" size={16} /> Import {kind} from CSV
          </button>
          <button type="button" className="menu-item" onClick={exportAll} disabled={!rows.length}>
            <Icon name="download" size={16} /> Export {plural(rows.length, k.one)} to CSV
          </button>
          <button type="button" className="menu-item" onClick={downloadTemplate}>
            <Icon name="download" size={16} /> Download blank template
          </button>
        </div>
      </Popover>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      {error && (
        <p className="tf-error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  )
}
