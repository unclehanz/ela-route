import { useMemo, useState } from 'react'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SelectField from '../components/form/SelectField.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useToast } from '../components/Toast.jsx'
import { downloadFile, toCsv } from '../lib/files.js'
import { fmtDate, fmtMi, fmtMoney, fmtMonth, plural, today } from '../lib/format.js'
import TripForm from './TripForm.jsx'

export default function MileagePage({ store }) {
  const { data, addMany, remove, setSettings } = store
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [month, setMonth] = useState(today().slice(0, 7))
  const [cgFilter, setCgFilter] = useState('')
  const rate = data.settings.ratePerMile ?? 0.7
  const nameOf = useMemo(() => {
    const m = new Map([...data.caregivers, ...data.clients].map((x) => [x.id, x.name]))
    return (id) => m.get(id) || ''
  }, [data.caregivers, data.clients])

  const rows = useMemo(
    () => data.mileage.filter((m) => (!month || m.date.startsWith(month)) && (!cgFilter || m.caregiverId === cgFilter)),
    [data.mileage, month, cgFilter],
  )
  const total = rows.reduce((s, r) => s + (+r.miles || 0), 0)
  const byCaregiver = useMemo(() => {
    const t = new Map()
    for (const r of rows) t.set(r.caregiverId, (t.get(r.caregiverId) || 0) + (+r.miles || 0))
    return [...t].sort((a, b) => b[1] - a[1])
  }, [rows])
  const months = [...new Set([today().slice(0, 7), ...data.mileage.map((m) => m.date.slice(0, 7))])].sort().reverse()
  const loggedCgs = [...new Set(data.mileage.map((m) => m.caregiverId))].map((id) => ({ value: id, label: nameOf(id) }))

  function exportCsv() {
    const name = `mileage-${month || 'all'}.csv`
    downloadFile(
      name,
      toCsv([
        ['Date', 'Caregiver', 'Client', 'From', 'To', 'Miles', 'Round trip', 'Purpose', 'Reimbursement'],
        ...rows.map((r) => [r.date, nameOf(r.caregiverId), nameOf(r.clientId), r.from, r.to, r.miles, r.roundTrip ? 'Yes' : '', r.purpose, ((+r.miles || 0) * rate).toFixed(2)]),
      ]),
    )
    toast({ title: `Exported ${name}`, details: `${plural(rows.length, 'trip')} · ${fmtMi(total)} · ${fmtMoney(total * rate)}` })
  }

  function deleteTrip(r) {
    remove('mileage', r.id)
    toast({
      title: `Deleted trip for ${nameOf(r.caregiverId)}`,
      details: `${fmtDate(r.date)} · ${fmtMi(+r.miles)}`,
      tone: 'info',
      actions: [{ label: 'Undo', primary: true, onClick: () => addMany('mileage', [r]) }],
    })
  }

  const columns = [
    { key: 'date', header: 'Date', width: 130, render: (r) => fmtDate(r.date) },
    { key: 'caregiver', header: 'Caregiver', pin: 'left', card: 'title', width: 200, sortValue: (r) => nameOf(r.caregiverId), render: (r) => <span className="cell-strong">{nameOf(r.caregiverId)}</span> },
    { key: 'client', header: 'Client / purpose', width: 200, sortValue: (r) => nameOf(r.clientId) || r.purpose, render: (r) => nameOf(r.clientId) || r.purpose },
    { key: 'route', header: 'Route', truncate: true, width: 320, sortValue: (r) => r.from, render: (r) => `${r.from} → ${r.to}${r.roundTrip ? ' (round trip)' : ''}` },
    { key: 'miles', header: 'Miles', num: true, width: 100, sortValue: (r) => +r.miles, render: (r) => fmtMi(+r.miles) },
    { key: 'amount', header: 'Amount', num: true, width: 110, sortValue: (r) => +r.miles, render: (r) => fmtMoney((+r.miles || 0) * rate) },
    {
      key: 'del',
      header: 'Delete',
      width: 80,
      card: 'hidden',
      sortValue: () => 0,
      render: (r) => (
        <button type="button" className="btn-icon" aria-label={`Delete trip on ${fmtDate(r.date)}`} onClick={(e) => (e.stopPropagation(), deleteTrip(r))}>
          <Icon name="trash" size={18} />
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Mileage log" subtitle="Trips logged from Dispatch, the route planner, or entered by hand.">
        <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!rows.length}>
          <Icon name="download" size={18} /> Export CSV
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Log trip
        </button>
      </PageHeader>

      <div className="filter-bar">
        <SelectField label="Month" placeholder="All months" options={months.map((m) => ({ value: m, label: fmtMonth(m) }))} value={month} onChange={(e) => setMonth(e.target.value)} />
        <SelectField label="Caregiver" placeholder="All caregivers" options={loggedCgs} value={cgFilter} onChange={(e) => setCgFilter(e.target.value)} />
        <TextField label="Rate per mile ($)" type="number" step="0.01" min="0" className="filter-narrow" value={rate} onChange={(e) => setSettings({ ratePerMile: +e.target.value })} />
      </div>

      <div className="mileage-layout">
        <DataTable
          caption="Trips"
          minWidth={980}
          columns={columns}
          rows={rows}
          defaultSort={{ key: 'date', dir: 'desc' }}
          empty={
            <EmptyState
              icon="receipt"
              title={data.mileage.length ? 'No trips in this period' : 'No trips logged yet'}
              action={
                <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                  Log a trip
                </button>
              }
            >
              {data.mileage.length ? 'Pick another month, or log a trip.' : 'Trips appear here when you log them from Dispatch or the route planner.'}
            </EmptyState>
          }
        />
        <aside className="panel summary">
          <h2 className="panel-title">{month ? fmtMonth(month) : 'All time'}</h2>
          <dl className="summary-totals">
            <div>
              <dt>Miles</dt>
              <dd>{fmtMi(total)}</dd>
            </div>
            <div>
              <dt>Reimbursement</dt>
              <dd>{fmtMoney(total * rate)}</dd>
            </div>
          </dl>
          {byCaregiver.length > 0 && (
            <>
              <h3 className="panel-subtitle">By caregiver</h3>
              <ul className="summary-list">
                {byCaregiver.map(([id, mi]) => (
                  <li key={id}>
                    <span>{nameOf(id)}</span>
                    <span className="text-muted num">
                      {fmtMi(mi)} · {fmtMoney(mi * rate)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {adding && (
        <TripForm
          caregivers={data.caregivers}
          clients={data.clients}
          onClose={() => setAdding(false)}
          onSave={(trip) => {
            addMany('mileage', [trip])
            setAdding(false)
            setMonth(trip.date.slice(0, 7))
            toast({
              title: `Trip logged for ${nameOf(trip.caregiverId)}`,
              details: `${fmtDate(trip.date)} · ${fmtMi(trip.miles)} · ${fmtMoney(trip.miles * rate)}`,
              actions: [{ label: 'Log another trip', primary: true, onClick: () => setAdding(true) }],
            })
          }}
        />
      )}
    </>
  )
}
