import fs from 'node:fs'
import { G } from './analyze.mjs'
const alts = JSON.parse(fs.readFileSync(new URL('./alts.json', import.meta.url)))
for (const r of G) { const a = alts[r.id][0]; r.dur = a.min; r.inter = a.inter }
const P = ['am', 'mid', 'pm', 'night']
function lsq(X, y) {
  const n = X[0].length, A = Array.from({ length: n }, () => Array(n + 1).fill(0))
  X.forEach((x, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += x[i] * x[j]; A[i][n] += x[i] * y[k] } })
  for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]
    for (let k = 0; k < n; k++) if (k !== i) { const f = A[k][i] / A[i][i]; for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j] } }
  return A.map((row, i) => row[n] / row[i])
}
// Models: features in a shared design where per-period columns are one-hot expanded.
const oh = (r) => P.map((p) => (r.t === p ? 1 : 0))
const MODELS = {
  'M0 current': null,
  'M1 factor/period': (r) => oh(r).map((v) => v * r.dur),
  'M2 overhead/period + factor/period': (r) => [...oh(r), ...oh(r).map((v) => v * r.dur)],
  'M5 shared overhead + factor/period': (r) => [1, ...oh(r).map((v) => v * r.dur)],
  'M6 shared ovh + factor/period + inter': (r) => [1, ...oh(r).map((v) => v * r.dur), r.inter],
}
const M0f = { night: 1, mid: 1.15, am: 1.4, pm: 1.55 }
const ids = [...new Set(G.map((r) => r.id))]
for (const [name, feat] of Object.entries(MODELS)) {
  let abs = 0, inr = 0, n = 0; const per = Object.fromEntries(P.map((p) => [p, [0, 0]]))
  for (const hold of ids) {
    const tr = G.filter((r) => r.id !== hold), te = G.filter((r) => r.id === hold)
    const W = feat && lsq(tr.map(feat), tr.map((r) => r.mid))
    for (const r of te) {
      const y = feat ? feat(r).reduce((s, x, i) => s + x * W[i], 0) : r.dur * M0f[r.t]
      abs += Math.abs(y - r.mid); inr += y >= r.lo && y <= r.hi; n++; per[r.t][0] += Math.abs(y - r.mid); per[r.t][1]++
    }
  }
  console.log(name.padEnd(40), `LOO MAE ${(abs / n).toFixed(2)}m  in-range ${((inr / n) * 100).toFixed(0)}%  |`, P.map((p) => `${p} ${(per[p][0] / per[p][1]).toFixed(1)}`).join(' '))
}
const W5 = lsq(G.map(MODELS['M5 shared overhead + factor/period']), G.map((r) => r.mid))
console.log('\nM5 fitted on all data: overhead', W5[0].toFixed(2), 'min; factors', P.map((p, i) => `${p} ${W5[i + 1].toFixed(2)}`).join(', '))
const W2 = lsq(G.map(MODELS['M2 overhead/period + factor/period']), G.map((r) => r.mid))
console.log('M2 fitted on all data:', P.map((p, i) => `${p}: ${W2[i].toFixed(1)} + ${W2[i + 4].toFixed(2)}x`).join(', '))
