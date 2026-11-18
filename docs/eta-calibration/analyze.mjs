import fs from 'node:fs'
import { PAIRS } from './pairs.mjs'
const osrm = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('./osrm.json', import.meta.url))).map((x) => [x.id, x]))
const G = fs.readFileSync(new URL('./google.txt', import.meta.url), 'utf8').trim().split(';').map((s) => {
  const [tag, lo, hi, mi] = s.split(','); const [id, t] = tag.split('|'); return { id, t, lo: +lo, hi: +hi, mid: (+lo + +hi) / 2, gmi: +mi, o: osrm[id] }
})
const ids = PAIRS.slice(0, 16).map(([o, d]) => `${o}-${d}`)
export const TRAIN = new Set(ids.slice(0, 11)), TEST = new Set(ids.slice(11))
export { G }
const P = ['am', 'mid', 'pm', 'night']
const mae = (rows, f) => rows.reduce((s, r) => s + Math.abs(f(r) - r.mid), 0) / rows.length
const inRange = (rows, f) => rows.filter((r) => f(r) >= r.lo && f(r) <= r.hi).length / rows.length
export function report(name, f, rows) {
  const out = P.map((p) => { const rs = rows.filter((r) => r.t === p); return `${p}: MAE ${mae(rs, f).toFixed(1)}m, in-range ${(inRange(rs, f) * 100).toFixed(0)}%` })
  console.log(`${name.padEnd(28)} ALL MAE ${mae(rows, f).toFixed(2)}m in-range ${(inRange(rows, f) * 100).toFixed(0)}% | ${out.join(' | ')}`)
}
if (process.argv[2] === 'dist') {
  const night = G.filter((r) => r.t === 'night')
  for (const r of night) console.log(r.id.padEnd(8), 'osrm', r.o.mi.toFixed(1), 'google', r.gmi, 'diff', (r.o.mi - r.gmi).toFixed(1))
  const diffs = night.map((r) => Math.abs(r.o.mi - r.gmi) / r.gmi)
  console.log('mean abs % diff (night):', (diffs.reduce((a, b) => a + b) / diffs.length * 100).toFixed(1) + '%')
}
