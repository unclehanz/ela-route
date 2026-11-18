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
const oh = (r) => P.map((p) => (r.t === p ? 1 : 0))
const MODELS = {
  'M5 flat overhead + factor/period': (r) => [1, ...oh(r).map((v) => v * r.dur)],
  'M7 sqrt overhead + factor/period': (r) => [Math.sqrt(r.dur), ...oh(r).map((v) => v * r.dur)],
  'M8 sqrt ovh/period + factor/period': (r) => [...oh(r).map((v) => v * Math.sqrt(r.dur)), ...oh(r).map((v) => v * r.dur)],
}
const ids = [...new Set(G.map((r) => r.id))]
for (const [name, feat] of Object.entries(MODELS)) {
  let abs = 0, inr = 0, n = 0, worst = 0, short = [0, 0]
  for (const hold of ids) {
    const tr = G.filter((r) => r.id !== hold), te = G.filter((r) => r.id === hold)
    const W = lsq(tr.map(feat), tr.map((r) => r.mid))
    for (const r of te) { const y = feat(r).reduce((s, x, i) => s + x * W[i], 0); const e = Math.abs(y - r.mid)
      abs += e; inr += y >= r.lo && y <= r.hi; n++; worst = Math.max(worst, e); if (r.dur < 7) { short[0] += y - r.mid; short[1]++ } }
  }
  console.log(name.padEnd(36), `LOO MAE ${(abs / n).toFixed(2)}m  in-range ${((inr / n) * 100).toFixed(0)}%  worst ${worst.toFixed(1)}m  short-trip bias ${(short[0] / short[1]).toFixed(1)}m`)
}
const W7 = lsq(G.map(MODELS['M7 sqrt overhead + factor/period']), G.map((r) => r.mid))
console.log('\nM7 on all data: overhead', W7[0].toFixed(2), '× √(minutes); factors', P.map((p, i) => `${p} ${W7[i + 1].toFixed(2)}`).join(', '))
for (const d of [3, 5, 10, 15, 20, 30]) console.log(`  ${String(d).padStart(2)} min free-flow → `, P.map((p, i) => `${p} ${(W7[0] * Math.sqrt(d) + W7[i + 1] * d).toFixed(0)}`).join('  '))
