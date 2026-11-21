import { useMemo, useState } from 'react'
import CsvMenu from '../components/CsvMenu.jsx'
import CaregiverTags from '../components/CaregiverTags.jsx'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FilterBar from '../components/FilterBar.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { emptyFilters, matches, STATUSES } from '../lib/caregivers.js'
import { plural } from '../lib/format.js'
import { cached, locateAll, queue, useGeoVersion } from '../lib/geo.js'

function MapStatus({ address }) {
  const c = cached(address)
  if (!address) return <span className="text-muted">No address</span>
  if (!c) return <span className="text-muted">Pending</span>
  if (c.fail)
    return (
      <span className="text-danger">
        <Icon name="alert" size={16} /> Not found
      </span>
    )
  return (
    <span className="text-success">
      <Icon name="check" size={16} /> On map
    </span>
  )
}

export default function CaregiversPage({ store, onView, onAdd }) {
  const { data } = store
  useGeoVersion()
  const [filters, setFilters] = useState(() => ({ ...emptyFilters(), statuses: [...STATUSES] }))
  const [job, setJob] = useState(null)
  const rows = useMemo(() => data.caregivers.filter((c) => matches(c, filters)), [data.caregivers, filters])
  const notLocated = data.caregivers.filter((c) => c.address && !cached(c.address)).length
  const notFound = data.caregivers.filter((c) => cached(c.address)?.fail).length

  const locate = () => {
    const total = notLocated
    setJob({ total })
    locateAll(data.caregivers.map((c) => c.address)).then(() => setJob(null))
  }

  const columns = [
    { key: 'name', header: 'Name', pin: 'left', card: 'title', width: 200, render: (r) => <span className="cell-strong">{r.name}</span> },
    { key: 'status', header: 'Status', width: 170, sortValue: (r) => STATUSES.indexOf(r.status), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'level', header: 'Level', width: 90 },
    { key: 'driver', header: 'Transport', width: 150 },
    { key: 'tags', header: 'Qualifications', sortValue: (r) => r.skills?.length || 0, render: (r) => <CaregiverTags cg={{ ...r, level: '', driver: '' }} /> },
    { key: 'address', header: 'Address', truncate: true, width: 260 },
    { key: 'map', header: 'Map', width: 150, sortValue: (r) => (cached(r.address)?.fail ? 0 : cached(r.address) ? 2 : 1), render: (r) => <MapStatus address={r.address} /> },
    { key: 'notes', header: 'Notes', truncate: true, width: 240 },
  ]

  return (
    <>
      <PageHeader
        title="Caregivers"
        subtitle={`${plural(rows.length, 'caregiver')} shown of ${data.caregivers.length}${notFound ? ` · ${notFound} address${notFound === 1 ? '' : 'es'} not found on map` : ''}`}
      >
        {notLocated > 0 && !job && (
          <button type="button" className="btn btn-secondary" onClick={locate}>
            <Icon name="pin" size={18} /> Locate {plural(notLocated, 'address', 'addresses')}
          </button>
        )}
        <CsvMenu kind="caregivers" store={store} />
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          <Icon name="plus" size={18} /> Add caregiver
        </button>
      </PageHeader>

      {job && (
        <div className="panel page-callout">
          <ProgressBar
            label="Placing caregiver addresses on the map"
            value={job.total - queue.pending}
            max={job.total}
            meta={`${job.total - queue.pending} of ${job.total} · about ${Math.ceil((queue.pending * 1.1) / 60)} min left`}
          />
          <p className="text-muted small">Each address is looked up once and saved. You can keep working while this runs.</p>
        </div>
      )}

      <FilterBar filters={filters} setFilters={setFilters} />

      <DataTable
        caption="Caregivers"
        columns={columns}
        rows={rows}
        onView={onView}
        viewLabel="Open"
        empty={
          <EmptyState icon="search" title="No caregivers match these filters">
            Clear a filter or choose “Select all” under status.
          </EmptyState>
        }
      />
    </>
  )
}
