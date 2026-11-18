import fs from 'node:fs'
import { G } from './analyze.mjs'
const alts = JSON.parse(fs.readFileSync(new URL('./alts.json', import.meta.url)))
for (const r of G) r.dur = alts[r.id][0].min
const P = ['am', 'mid', 'pm', 'night']
function lsq(X, y) {
  const n = X[0].length, A = Array.from({ length: n }, () => Array(n + 1).fill(0))
  X.forEach((x, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += x[i] * x[j]; A[i][n] += x[i] * y[k] } })
  for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]
    for (let k = 0; k < n; k++) if (k !== i) { const f = A[k][i] / A[i][i]; for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j] } }
  return A.map((row, i) => row[n] / row[i])
}
const feat = (r) => [1, ...P.map((p) => (r.t === p ? r.dur : 0))]
const out = {}
for (const k of ['lo', 'mid', 'hi']) { const W = lsq(G.map(feat), G.map((r) => r[k])); out[k] = { ov: +W[0].toFixed(1), ...Object.fromEntries(P.map((p, i) => [p, +W[i + 1].toFixed(2)])) } }
console.log(JSON.stringify(out, null, 1))
// coverage of predicted range vs Google's range midpoint
let cov = 0; for (const r of G) { const lo = out.lo.ov + out.lo[r.t] * r.dur, hi = out.hi.ov + out.hi[r.t] * r.dur; if (r.mid >= lo && r.mid <= hi) cov++ }
console.log('Google typical time inside the app range:', ((cov / G.length) * 100).toFixed(0) + '%')
