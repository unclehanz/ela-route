// Command-line preview of the spreadsheet import (the app itself imports in the browser).
// Usage: node scripts/import-xlsx.mjs "D:/Downloads/OPEN SHIFT.xlsx" [out.json]
// Writes nothing unless an output path is given — personal data should not be committed or deployed.
import fs from 'node:fs'
import path from 'node:path'
import { parseWorkbook } from '../src/lib/parseWorkbook.js'

const [file, outPath] = process.argv.slice(2)
if (!file) {
  console.error('Usage: node scripts/import-xlsx.mjs <path-to-xlsx> [out.json]')
  process.exit(1)
}
const out = parseWorkbook(new Uint8Array(fs.readFileSync(file)), path.basename(file))
const count = (f) => out.caregivers.reduce((m, c) => ((m[c[f]] = (m[c[f]] || 0) + 1), m), {})
console.log('Caregivers:', out.caregivers.length, count('status'))
console.log('Drivers:', count('driver'))
console.log('Missing address:', out.caregivers.filter((c) => !c.address).length)
console.log('Clients:', out.clients.length, 'with care manager:', out.clients.filter((c) => c.careManager).length)
console.log('Spreadsheet distances:', Object.values(out.legacyDistances).reduce((s, m) => s + Object.keys(m).length, 0))
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(out))
  console.log('Wrote', outPath)
}
