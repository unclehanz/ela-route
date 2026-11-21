import { useMemo, useState } from 'react'
import CsvMenu from '../components/CsvMenu.jsx'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { plural } from '../lib/format.js'
import { cached, useGeoVersion } from '../lib/geo.js'

export default function ClientsPage({ store, onView, onAdd }) {
  const { data } = store
  useGeoVersion()
  const [search, setSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const missing = data.clients.filter((c) => !c.address).length
  const rows = useMemo(
    () =>
      data.clients.filter(
        (c) => (!missingOnly || !c.address) && `${c.name} ${c.address} ${c.careManager}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [data.clients, search, missingOnly],
  )

  const columns = [
    { key: 'name', header: 'Client', pin: 'left', card: 'title', width: 220, render: (r) => <span className="cell-strong">{r.name}</span> },
    {
      key: 'address',
      header: 'Address',
      width: 320,
      sortValue: (r) => r.address || '~',
      render: (r) =>
        r.address ? (
          cached(r.address)?.fail ? (
            <span className="text-danger">
              <Icon name="alert" size={16} /> {r.address} (not found on map)
            </span>
          ) : (
            r.address
          )
        ) : (
          <button type="button" className="btn-link" onClick={(e) => (e.stopPropagation(), onView(r))}>
            Add address
          </button>
        ),
    },
    { key: 'careManager', header: 'Care manager', width: 160 },
    {
      key: 'needs',
      header: 'Needs',
      sortValue: (r) => r.needs?.length || 0,
      render: (r) => (
        <span className="tags">
          {r.genderPreference && <span className="tag">{r.genderPreference} caregiver</span>}
          {r.needs?.map((n) => (
            <span key={n} className="tag">
              {n}
            </span>
          ))}
        </span>
      ),
    },
    { key: 'notes', header: 'Notes', truncate: true, width: 240 },
  ]

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={missing ? `${plural(data.clients.length, 'client')} · ${missing} still need an address` : `${plural(data.clients.length, 'client')}`}
      >
        <CsvMenu kind="clients" store={store} />
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          <Icon name="plus" size={18} /> Add client
        </button>
      </PageHeader>

      {missing > 0 && (
        <div className="callout callout-warning page-callout" role="note">
          <Icon name="alert" />
          <p>
            The spreadsheet didn’t include client addresses. Add an address to each client before you can calculate drive times to them.
          </p>
        </div>
      )}

      <div className="filter-bar">
        <TextField label="Search" type="search" example="Name, address or care manager" className="filter-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className={'toggle-chip' + (missingOnly ? ' is-on' : '')}>
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          {missingOnly && <Icon name="check" size={16} />}
          Missing address only
        </label>
      </div>

      <DataTable
        caption="Clients"
        minWidth={900}
        columns={columns}
        rows={rows}
        onView={onView}
        viewLabel="Open"
        defaultSort={{ key: 'name', dir: 'asc' }}
        empty={
          <EmptyState icon="home" title={search || missingOnly ? 'No clients match' : 'No clients yet'} action={<button type="button" className="btn btn-primary" onClick={onAdd}>Add client</button>}>
            {search || missingOnly ? 'Try a different search.' : 'Add your first client with their address.'}
          </EmptyState>
        }
      />
    </>
  )
}
