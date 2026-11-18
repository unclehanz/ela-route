// Reads the OPEN SHIFT.xlsx workbook (bytes) into caregivers, clients and spreadsheet distances.
// Runs in the browser (in-app import) and in Node (scripts/import-xlsx.mjs). No data leaves the device.
import { strFromU8, unzipSync } from 'fflate'

export function parseWorkbook(bytes, fileName = 'workbook.xlsx') {
  const zip = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  if (!zip['xl/workbook.xml']) throw new Error('This file is not an Excel workbook (.xlsx).')
  const read = (p) => strFromU8(zip[p])
  const dec = (s) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')),
  )
  const wb = read('xl/workbook.xml')
  const rels = read('xl/_rels/workbook.xml.rels')

  function sheet(name) {
    const m = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="(\w+)"/g)].find((x) => dec(x[1]).trim() === name)
    if (!m) throw new Error('Sheet not found: ' + name)
    const t = new RegExp(`<Relationship[^>]*Id="${m[2]}"[^>]*>`).exec(rels)[0]
    const target = /Target="([^"]+)"/.exec(t)[1].replace(/^\/?xl\//, '')
    const xml = read('xl/' + target)
    const rows = new Map()
    for (const r of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = {}
      for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] || '')
        const is = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] || '')
        let val = v ? v[1] : is ? is[1] : null
        if (val == null) continue
        val = /t="s"/.test(c[2]) ? shared[+val] : dec(val)
        val = String(val).replace(/\s+/g, ' ').trim()
        if (val) cells[c[1]] = val
      }
      rows.set(+r[1], cells)
    }
    return rows
  }

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const key = (s) => clean(s).toLowerCase().replace(/["'“”]/g, '')
  const titleCase = (s) =>
    clean(s)
      .toLowerCase()
      .replace(/(^|[\s(\-"'&])([a-z])/g, (_, a, b) => a + b.toUpperCase())
  const fixName = (s) => (s === s.toUpperCase() ? titleCase(s) : clean(s))

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
    for (let j = 1; j <= b.length; j++) d[0][j] = j
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return d[a.length][b.length]
  }

  function normStatus(raw) {
    const s = (raw || '').toUpperCase()
    if (s.includes('FULL')) return 'Full Schedule'
    if (s.includes('REG')) return 'Regular Schedule'
    if (s.includes('ACTIVE') && !s.includes('INACTIVE')) return 'Active'
    return null
  }
  function normDriver(raw) {
    const s = (raw || '').toUpperCase()
    if (!s || /HOSPICE|END OF LIFE/.test(s)) return ''
    if (s.includes('INSURANCE')) return 'No Car Insurance'
    if (s.includes('LICENSE')) return 'No License'
    if (s.includes('NON') || s.includes('NO DRIVER')) return 'Non-Driver'
    if (s.includes('DRIVER')) return 'Driver'
    return clean(raw)
  }
  function normLevel(raw) {
    const m = /(\d)/.exec(raw || '')
    return m ? 'Level ' + m[1] : ''
  }
  function normGender(raw) {
    const s = (raw || '').toUpperCase()
    return s.startsWith('F') ? 'Female' : s.startsWith('M') ? 'Male' : ''
  }
  const skillsOf = (raw) => (/HOSPICE|END OF LIFE/i.test(raw || '') ? ['Hospice'] : [])

  const caregivers = new Map()
  function upsert(name, data, { overwrite = false } = {}) {
    name = fixName(name)
    if (!name || /^caregiver$/i.test(name)) return null
    const k = key(name)
    const existing = caregivers.get(k)
    if (!existing) {
      const cg = {
        id: 'cg-' + (caregivers.size + 1),
        name,
        status: 'Active',
        statusReason: '',
        level: '',
        gender: '',
        driver: '',
        skills: [],
        languages: ['English'],
        availability: [],
        doNotAssign: false,
        address: '',
        notes: '',
        phone: '',
        source: '',
        ...data,
      }
      caregivers.set(k, cg)
      return cg
    }
    for (const [f, v] of Object.entries(data)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue
      if (overwrite || !existing[f] || (Array.isArray(existing[f]) && !existing[f].length)) existing[f] = v
    }
    return existing
  }

  // ---------- Main sheet ----------
  const legacyDistances = []
  const clientNames = []
  {
    const rows = sheet('LIVEVIEW STATUS UPDATE')
    const header = rows.get(2)
    const clientCols = Object.keys(header).filter((c) => c.length > 1 || c >= 'J')
    for (const c of clientCols) clientNames.push(header[c])
    for (const [r, row] of rows) {
      if (r < 3 || !row.C) continue
      const status = normStatus(row.B) || 'Active'
      const cg = upsert(
        row.C,
        {
          status,
          statusReason: normStatus(row.B) ? '' : clean(row.B),
          level: normLevel(row.D),
          gender: normGender(row.E),
          skills: skillsOf(row.F + ' ' + row.G),
          driver: normDriver(row.G),
          notes: clean(row.H),
          address: clean(row.I),
          source: 'LIVEVIEW STATUS UPDATE',
        },
        { overwrite: true },
      )
      for (const c of clientCols) {
        if (!row[c]) continue
        const m = /^\s*(\d+(?:\.\d+)?)\s*[-–]?\s*(.*)$/.exec(row[c])
        legacyDistances.push({
          caregiver: cg.id,
          client: header[c],
          miles: m ? +(+m[1]).toFixed(1) : null,
          note: clean(m ? m[2] : row[c]),
        })
      }
    }
  }

  // ---------- Status tabs ----------
  function statusTab(name, headerRow, status) {
    const rows = sheet(name)
    for (const [r, row] of rows) {
      if (r <= headerRow || !row.C) continue
      upsert(
        row.C,
        {
          status,
          statusReason: clean(row.B),
          level: normLevel(row.D),
          gender: normGender(row.E),
          driver: normDriver(row.F),
          skills: skillsOf(row.G + ' ' + row.F),
          address: clean(row.H),
          notes: clean(row.I),
          source: name,
        },
        { overwrite: true },
      )
    }
  }
  statusTab('DO NOT REACH OUT YET', 3, 'On Hold')
  statusTab('NON-RESPONSIVE CGS', 3, 'Non-Responsive')
  statusTab('INACTIVE CGS', 2, 'Inactive')

  // ---------- Orientation ----------
  {
    const rows = sheet('ORIENTATION')
    for (const [, row] of rows) {
      if (!row.B || /CALENDAR|^CAREGIVER$/i.test(row.B) || !row.C) continue
      const exists = caregivers.has(key(fixName(row.B)))
      upsert(row.B, {
        status: exists ? undefined : 'Orientation',
        statusReason: exists ? undefined : clean(row.E),
        address: clean(row.C),
        notes: clean(row.D),
        skills: skillsOf(row.D),
        level: normLevel(row.D),
        source: exists ? undefined : 'ORIENTATION',
      })
    }
  }

  // ---------- Spanish + availability ----------
  for (const [r, row] of sheet('SPANISH CAREGIVERS')) {
    if (r < 3 || !row.C) continue
    const cg = upsert(row.C, { source: 'SPANISH CAREGIVERS' })
    if (cg && !cg.languages.includes('Spanish')) cg.languages.push('Spanish')
  }
  for (const [r, row] of sheet('CAREGIVER AVAILABILITY')) {
    if (r < 3) continue
    const add = (name, tag, note) => {
      if (!name) return
      const cg = upsert(name, { source: 'CAREGIVER AVAILABILITY' })
      if (cg && !cg.availability.includes(tag)) cg.availability.push(tag)
      if (cg && note) cg.notes = [cg.notes, note].filter(Boolean).join(' • ')
    }
    add(row.C, 'Overnight')
    add(row.F, '12-Hour Shift')
    add(row.H, '12-Hour Shift', row.I)
    if (row.K) {
      const cg = upsert(row.K, { source: 'CAREGIVER AVAILABILITY' })
      if (cg) {
        cg.doNotAssign = true
        if (row.L) cg.notes = [cg.notes, 'DO NOT ASSIGN: ' + row.L].filter(Boolean).join(' • ')
      }
    }
  }

  // ---------- Older (hidden) lists: only caregivers not seen anywhere else ----------
  function oldList(name, cols) {
    for (const [r, row] of sheet(name)) {
      if (r < 3 || !row[cols.name]) continue
      if (caregivers.has(key(fixName(row[cols.name])))) continue
      upsert(row[cols.name], {
        status: 'Unverified',
        statusReason: clean(row[cols.status]) || 'From older LIVEVIEW list',
        level: normLevel(row[cols.level]),
        driver: normDriver(row[cols.driver]),
        address: clean(row[cols.address]),
        notes: clean(row[cols.notes]),
        skills: skillsOf(row[cols.notes]),
        source: name,
      })
    }
  }
  oldList('LIVEVIEW V.1', { status: 'B', name: 'C', level: 'D', driver: 'E', address: 'F', notes: 'G' })
  oldList('Copy of LIVEVIEW', { status: 'A', name: 'B', level: 'C', driver: 'D', address: 'E', notes: 'F' })

  // ---------- Clients ----------
  const careManagers = new Map()
  for (const [r, row] of sheet('DAILY OPEN SHIFT')) {
    if (r < 4 || !row.C || !row.D || /^client$/i.test(row.C)) continue
    clientNames.push(row.C)
    if (row.D) careManagers.set(key(row.C), titleCase(row.D))
  }
  const clients = []
  const clientIdByKey = new Map()
  for (const raw of clientNames) {
    const name = fixName(raw)
    const k = key(name)
    if (!k || clientIdByKey.has(k)) continue
    const near = clients.find((c) => k.length > 8 && lev(key(c.name), k) <= 1)
    if (near) {
      clientIdByKey.set(k, near.id)
      continue
    }
    const id = 'cl-' + (clients.length + 1)
    clientIdByKey.set(k, id)
    clients.push({ id, name, address: '', careManager: careManagers.get(k) || '', needs: [], genderPreference: '', notes: '' })
  }
  for (const d of legacyDistances) d.client = clientIdByKey.get(key(fixName(d.client)))

  return {
    importedAt: new Date().toISOString(),
    source: fileName,
    caregivers: [...caregivers.values()],
    clients,
    legacyDistances: legacyDistances.reduce((m, d) => {
      if (!d.client) return m
      ;(m[d.caregiver] ||= {})[d.client] = d.note ? [d.miles, d.note] : [d.miles]
      return m
    }, {}),
  }
}
